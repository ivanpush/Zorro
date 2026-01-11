"""
Clarity Agent - Identifies writing quality and clarity issues.

Chunked agent that runs in parallel over word-based chunks.
Supports streaming results as chunks complete.
"""

import asyncio
import json
from typing import AsyncGenerator, Any
from pydantic import BaseModel, Field, field_validator

from app.agents.base import BaseAgent
from app.models import DocObj, BriefingOutput, Finding, AgentMetrics
from app.models.chunks import ClarityChunk
from app.services.chunker import chunk_for_clarity


class ClarityOutput(BaseModel):
    """Structured output from Clarity agent for a single chunk."""
    findings: list[Finding] = Field(default_factory=list)

    @field_validator('findings', mode='before')
    @classmethod
    def parse_findings(cls, v: Any) -> list:
        """Handle case where model returns JSON string instead of list."""
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return []
        return v


# Type for streaming results: (chunk_index, findings, metrics, error_msg)
ChunkResult = tuple[int, list[Finding], AgentMetrics | None, str | None]


class ClarityAgent(BaseAgent):
    """
    Analyzes document for writing quality and clarity issues.

    Operates on word-based chunks with context overlap.
    Runs chunks in parallel for speed.

    Categories:
    - clarity_sentence: Grammar, phrasing, ambiguity
    - clarity_paragraph: Topic sentences, coherence
    - clarity_flow: Transitions, organization
    """

    @property
    def agent_id(self) -> str:
        return "clarity"

    def get_chunks(self, doc: DocObj) -> list[ClarityChunk]:
        """Get chunks for this document (for progress reporting)."""
        return chunk_for_clarity(doc)

    async def run(
        self,
        doc: DocObj,
        briefing: BriefingOutput,
        steering: str | None = None
    ) -> tuple[list[Finding], list[AgentMetrics]]:
        """
        Analyze document for clarity issues.

        Args:
            doc: Document to analyze
            briefing: Context from briefing agent
            steering: Optional user steering memo

        Returns:
            Tuple of (list[Finding], list[AgentMetrics])
        """
        # Chunk the document
        chunks = chunk_for_clarity(doc)

        # Process all chunks in parallel
        tasks = [
            self._process_chunk(chunk, briefing, steering)
            for chunk in chunks
        ]
        results = await asyncio.gather(*tasks)

        # Merge findings and metrics from all chunks
        all_findings: list[Finding] = []
        all_metrics: list[AgentMetrics] = []

        for findings, metrics in results:
            all_findings.extend(findings)
            all_metrics.append(metrics)

        return all_findings, all_metrics

    async def run_streaming(
        self,
        doc: DocObj,
        briefing: BriefingOutput,
        steering: str | None = None
    ) -> AsyncGenerator[ChunkResult, None]:
        """
        Analyze document for clarity issues, yielding results as chunks complete.

        Yields:
            Tuple of (chunk_index, findings, metrics, error) for each chunk
        """
        chunks = chunk_for_clarity(doc)

        # Limit concurrent API calls to avoid rate limiting
        semaphore = asyncio.Semaphore(8)

        async def process_with_index(chunk: ClarityChunk) -> ChunkResult:
            async with semaphore:
                try:
                    findings, metrics = await self._process_chunk(chunk, briefing, steering)
                    return (chunk.chunk_index, findings, metrics, None)
                except Exception as e:
                    return (chunk.chunk_index, [], None, str(e))

        tasks = [
            asyncio.create_task(process_with_index(chunk))
            for chunk in chunks
        ]

        # Yield results as they complete
        for coro in asyncio.as_completed(tasks):
            result = await coro
            yield result

    async def _process_chunk(
        self,
        chunk,
        briefing: BriefingOutput,
        steering: str | None
    ) -> tuple[list[Finding], AgentMetrics]:
        """
        Process a single chunk.

        Args:
            chunk: ClarityChunk to process
            briefing: Context from briefing agent
            steering: Optional user steering memo

        Returns:
            Tuple of (findings for this chunk, metrics)
        """
        # Build prompt using composer
        system, user = self.composer.build_clarity_prompt(
            chunk=chunk,
            briefing=briefing,
            steering=steering
        )

        # Call LLM with structured output
        output, metrics = await self.client.call(
            agent_id=self.agent_id,
            system=system,
            user=user,
            response_model=ClarityOutput,
            chunk_index=chunk.chunk_index,
            chunk_total=chunk.chunk_total,
        )

        # Handle both ClarityOutput and direct list (for testing)
        if isinstance(output, ClarityOutput):
            findings = output.findings
        else:
            # If mock returns list directly, use it
            findings = output if isinstance(output, list) else []

        return findings, metrics
