# ZORRO Backend - Core Infrastructure

LLM client with metrics collection, Perplexity client, and chunking service.

---

## app/core/llm.py

```python
"""
Instructor-wrapped LLM client with automatic metrics collection.
"""

import time
from functools import lru_cache
from typing import TypeVar, Type

import instructor
from anthropic import Anthropic
from pydantic import BaseModel

from app.config import get_settings, get_model, calculate_cost
from app.models import AgentMetrics


T = TypeVar("T", bound=BaseModel)


class LLMClient:
    """
    LLM client wrapper that:
    1. Uses Instructor for structured outputs
    2. Automatically collects metrics (tokens, time, cost)
    """
    
    def __init__(self):
        settings = get_settings()
        self._anthropic = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        self._instructor = instructor.from_anthropic(self._anthropic)
    
    async def call(
        self,
        agent_id: str,
        system: str,
        user: str,
        response_model: Type[T],
        max_tokens: int = 4096,
        chunk_index: int | None = None,
        chunk_total: int | None = None,
    ) -> tuple[T, AgentMetrics]:
        """
        Make LLM call and return (response, metrics).
        
        Args:
            agent_id: Which agent is calling (for model lookup and metrics)
            system: System prompt
            user: User prompt
            response_model: Pydantic model for structured output
            max_tokens: Max output tokens
            chunk_index: Optional chunk index for parallelized agents
            chunk_total: Optional total chunks
        
        Returns:
            Tuple of (parsed response, metrics)
        """
        model = get_model(agent_id)
        
        start_time = time.perf_counter()
        
        # Make the call with Instructor
        response = self._instructor.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
            response_model=response_model,
        )
        
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        
        # Extract token usage from the raw response
        # Instructor wraps the response, but we can access usage
        input_tokens = getattr(response, '_raw_response', {}).get('usage', {}).get('input_tokens', 0)
        output_tokens = getattr(response, '_raw_response', {}).get('usage', {}).get('output_tokens', 0)
        
        # If we can't get tokens from response, estimate
        if input_tokens == 0:
            # Rough estimate: 4 chars per token
            input_tokens = (len(system) + len(user)) // 4
        if output_tokens == 0:
            output_tokens = max_tokens // 4  # Rough estimate
        
        cost = calculate_cost(model, input_tokens, output_tokens)
        
        metrics = AgentMetrics(
            agent_id=agent_id,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            time_ms=elapsed_ms,
            cost_usd=cost,
            chunk_index=chunk_index,
            chunk_total=chunk_total,
        )
        
        return response, metrics
    
    async def call_raw(
        self,
        agent_id: str,
        system: str,
        user: str,
        max_tokens: int = 4096,
    ) -> tuple[str, AgentMetrics]:
        """
        Make LLM call without structured output.
        Returns raw text response.
        """
        model = get_model(agent_id)
        
        start_time = time.perf_counter()
        
        response = self._anthropic.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        cost = calculate_cost(model, input_tokens, output_tokens)
        
        metrics = AgentMetrics(
            agent_id=agent_id,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            time_ms=elapsed_ms,
            cost_usd=cost,
        )
        
        text = response.content[0].text if response.content else ""
        return text, metrics


@lru_cache()
def get_llm_client() -> LLMClient:
    """Get cached LLM client instance."""
    return LLMClient()
```

---

## app/core/perplexity.py

```python
"""
Perplexity API client for domain searches.
"""

import time
import httpx
from pydantic import BaseModel

from app.config import get_settings, calculate_cost
from app.models import AgentMetrics, SearchResult, SourceSnippet


class PerplexityClient:
    """Client for Perplexity Sonar API."""
    
    BASE_URL = "https://api.perplexity.ai/chat/completions"
    
    def __init__(self):
        settings = get_settings()
        self.api_key = settings.PERPLEXITY_API_KEY
        self.model = "sonar"  # or "sonar-pro" for deeper searches
    
    async def search(
        self,
        query_id: str,
        query_text: str,
    ) -> tuple[SearchResult, list[SourceSnippet], AgentMetrics]:
        """
        Execute a single search query.
        
        Returns:
            Tuple of (SearchResult, list of SourceSnippets, AgentMetrics)
        """
        start_time = time.perf_counter()
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.BASE_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "user", "content": query_text}
                    ],
                    "return_citations": True,
                },
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()
        
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        
        # Extract response text
        response_text = ""
        if data.get("choices"):
            response_text = data["choices"][0].get("message", {}).get("content", "")
        
        # Extract citations
        citations = data.get("citations", [])
        
        # Build source snippets
        sources = []
        for i, citation in enumerate(citations):
            if isinstance(citation, str):
                sources.append(SourceSnippet(
                    text=f"Source {i+1}",
                    url=citation,
                    query_id=query_id,
                ))
            elif isinstance(citation, dict):
                sources.append(SourceSnippet(
                    text=citation.get("snippet", ""),
                    url=citation.get("url"),
                    title=citation.get("title"),
                    query_id=query_id,
                ))
        
        # Build result
        result = SearchResult(
            query_id=query_id,
            response_text=response_text,
            citations=[s.url for s in sources if s.url],
        )
        
        # Metrics
        usage = data.get("usage", {})
        input_tokens = usage.get("prompt_tokens", len(query_text) // 4)
        output_tokens = usage.get("completion_tokens", len(response_text) // 4)
        
        metrics = AgentMetrics(
            agent_id="domain_search",
            model=self.model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            time_ms=elapsed_ms,
            cost_usd=calculate_cost(self.model, input_tokens, output_tokens),
        )
        
        return result, sources, metrics
    
    async def search_batch(
        self,
        queries: list[tuple[str, str]],  # [(query_id, query_text), ...]
    ) -> tuple[list[SearchResult], list[SourceSnippet], list[AgentMetrics]]:
        """
        Execute multiple searches.
        Currently sequential - could be parallelized with rate limiting.
        """
        all_results = []
        all_sources = []
        all_metrics = []
        
        for query_id, query_text in queries:
            result, sources, metrics = await self.search(query_id, query_text)
            all_results.append(result)
            all_sources.extend(sources)
            all_metrics.append(metrics)
        
        return all_results, all_sources, all_metrics


def get_perplexity_client() -> PerplexityClient:
    """Get Perplexity client instance."""
    return PerplexityClient()
```

---

## app/services/chunker.py

```python
"""
Document chunking for parallelized agents.
"""

from app.models import DocObj, Paragraph, Section, ClarityChunk, RigorChunk, ContextOverlap
from app.config import get_settings


def get_last_n_sentences(paragraphs: list[Paragraph], n: int = 3) -> ContextOverlap | None:
    """Extract last n sentences from a list of paragraphs."""
    if not paragraphs:
        return None
    
    sentences = []
    for para in reversed(paragraphs):
        if para.sentences:
            for sent in reversed(para.sentences):
                sentences.insert(0, sent.text)
                if len(sentences) >= n:
                    break
        else:
            # No sentence breakdown - use whole paragraph text
            # Split on periods as fallback
            parts = para.text.split('. ')
            for part in reversed(parts):
                if part.strip():
                    sentences.insert(0, part.strip() + ('.' if not part.endswith('.') else ''))
                    if len(sentences) >= n:
                        break
        if len(sentences) >= n:
            break
    
    if not sentences:
        return None
    
    return ContextOverlap(sentences=sentences[:n], source="previous")


def get_first_n_sentences(paragraphs: list[Paragraph], n: int = 3) -> ContextOverlap | None:
    """Extract first n sentences from a list of paragraphs."""
    if not paragraphs:
        return None
    
    sentences = []
    for para in paragraphs:
        if para.sentences:
            for sent in para.sentences:
                sentences.append(sent.text)
                if len(sentences) >= n:
                    break
        else:
            # Fallback
            parts = para.text.split('. ')
            for part in parts:
                if part.strip():
                    sentences.append(part.strip() + ('.' if not part.endswith('.') else ''))
                    if len(sentences) >= n:
                        break
        if len(sentences) >= n:
            break
    
    if not sentences:
        return None
    
    return ContextOverlap(sentences=sentences[:n], source="next")


def chunk_for_clarity(
    doc: DocObj,
    target_words: int | None = None
) -> list[ClarityChunk]:
    """
    Chunk document by word count for Clarity agent.
    Respects paragraph boundaries.
    Includes 3-sentence context overlap.
    """
    settings = get_settings()
    target = target_words or settings.DEFAULT_CHUNK_WORDS
    n_context = settings.CONTEXT_OVERLAP_SENTENCES
    
    chunks: list[ClarityChunk] = []
    current_paras: list[Paragraph] = []
    current_words = 0
    
    for para in doc.paragraphs:
        para_words = len(para.text.split())
        
        # If adding this paragraph exceeds target and we have content, finalize chunk
        if current_words + para_words > target and current_paras:
            chunks.append(_build_clarity_chunk(
                paragraphs=current_paras,
                all_paragraphs=doc.paragraphs,
                chunk_index=len(chunks),
                n_context=n_context,
            ))
            current_paras = []
            current_words = 0
        
        current_paras.append(para)
        current_words += para_words
    
    # Don't forget last chunk
    if current_paras:
        chunks.append(_build_clarity_chunk(
            paragraphs=current_paras,
            all_paragraphs=doc.paragraphs,
            chunk_index=len(chunks),
            n_context=n_context,
        ))
    
    # Set total count
    for chunk in chunks:
        chunk.chunk_total = len(chunks)
    
    return chunks


def _build_clarity_chunk(
    paragraphs: list[Paragraph],
    all_paragraphs: list[Paragraph],
    chunk_index: int,
    n_context: int,
) -> ClarityChunk:
    """Build a ClarityChunk with context overlap."""
    first_idx = all_paragraphs.index(paragraphs[0])
    last_idx = all_paragraphs.index(paragraphs[-1])
    
    # Get context before (from previous paragraphs)
    context_before = get_last_n_sentences(all_paragraphs[:first_idx], n=n_context)
    
    # Get context after (from following paragraphs)
    context_after = get_first_n_sentences(all_paragraphs[last_idx + 1:], n=n_context)
    
    return ClarityChunk(
        chunk_index=chunk_index,
        chunk_total=0,  # Set later
        paragraphs=paragraphs,
        paragraph_ids=[p.paragraph_id for p in paragraphs],
        word_count=sum(len(p.text.split()) for p in paragraphs),
        context_before=context_before,
        context_after=context_after,
    )


def chunk_for_rigor(doc: DocObj) -> list[RigorChunk]:
    """
    Chunk document by section for Rigor agent.
    Each section becomes one chunk with context overlap.
    """
    settings = get_settings()
    n_context = settings.CONTEXT_OVERLAP_SENTENCES
    
    chunks: list[RigorChunk] = []
    
    for section in doc.sections:
        section_paras = doc.get_section_paragraphs(section.section_id)
        
        if not section_paras:
            continue
        
        section_idx = doc.sections.index(section)
        
        # Get context from adjacent sections
        context_before = None
        if section_idx > 0:
            prev_section = doc.sections[section_idx - 1]
            prev_paras = doc.get_section_paragraphs(prev_section.section_id)
            context_before = get_last_n_sentences(prev_paras, n=n_context)
        
        context_after = None
        if section_idx < len(doc.sections) - 1:
            next_section = doc.sections[section_idx + 1]
            next_paras = doc.get_section_paragraphs(next_section.section_id)
            context_after = get_first_n_sentences(next_paras, n=n_context)
        
        chunks.append(RigorChunk(
            chunk_index=len(chunks),
            chunk_total=0,  # Set later
            section=section,
            paragraphs=section_paras,
            paragraph_ids=[p.paragraph_id for p in section_paras],
            context_before=context_before,
            context_after=context_after,
        ))
    
    # Set total count
    for chunk in chunks:
        chunk.chunk_total = len(chunks)
    
    return chunks
```

---

## app/core/__init__.py

```python
from .llm import LLMClient, get_llm_client
from .perplexity import PerplexityClient, get_perplexity_client

__all__ = [
    "LLMClient", "get_llm_client",
    "PerplexityClient", "get_perplexity_client",
]
```
