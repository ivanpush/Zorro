"""
Perplexity API client for domain searches.
"""

import time
import httpx

from app.config import get_settings, calculate_cost
from app.models import AgentMetrics, SearchResult, SourceSnippet


class PerplexityClient:
    """Client for Perplexity Sonar API."""

    BASE_URL = "https://api.perplexity.ai/chat/completions"

    def __init__(self):
        settings = get_settings()
        self.api_key = settings.perplexity_api_key
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
