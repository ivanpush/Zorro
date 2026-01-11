"""
Rigor Finder Agent - Identifies methodology, logic, and evidence issues.

Phase 1 of 2-phase rigor pipeline. Finds issues but doesn't propose fixes.
Supports streaming results as sections complete.
"""

import asyncio
from typing import AsyncGenerator
from app.agents.base import BaseAgent
from app.models import DocObj, BriefingOutput, Finding, AgentMetrics
from app.models.chunks import RigorChunk
from app.services.chunker import chunk_for_rigor


# Type for streaming results: (chunk_index, findings, metrics, error_msg)
ChunkResult = tuple[int, list[Finding], AgentMetrics | None, str | None]


class RigorFinder(BaseAgent):
    """
    Identifies rigor issues in document sections.

    This is the first phase of the rigor pipeline:
    1. RigorFinder: Identifies issues (no edits)
    2. RigorRewriter: Adds proposed_edit to findings

    Chunks by section and processes in parallel.
    """

    @property
    def agent_id(self) -> str:
        return "rigor_find"

    def get_sections(self, doc: DocObj) -> list[RigorChunk]:
        """Get section chunks for this document (for progress reporting)."""
        return chunk_for_rigor(doc)

    async def run(
        self,
        doc: DocObj,
        briefing: BriefingOutput,
        steering: str | None = None
    ) -> tuple[list[Finding], list[AgentMetrics]]:
        """
        Find rigor issues in document.

        Args:
            doc: Document to analyze
            briefing: Context from BriefingAgent
            steering: Optional user steering memo

        Returns:
            Tuple of (list[Finding], list[AgentMetrics])
            Findings have NO proposed_edit (finder just finds issues)
        """
        # Chunk document by section
        chunks = chunk_for_rigor(doc)

        # Process chunks in parallel
        tasks = [self._process_chunk(chunk, briefing, steering) for chunk in chunks]
        results = await asyncio.gather(*tasks)

        # Flatten results
        all_findings = []
        all_metrics = []

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
        Find rigor issues, yielding results as sections complete.

        Yields:
            Tuple of (chunk_index, findings, metrics, error) for each section
        """
        chunks = chunk_for_rigor(doc)

        async def process_with_index(chunk: RigorChunk) -> ChunkResult:
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
        """Process a single chunk."""
        # Build prompt
        system, user = self.composer.build_rigor_find_prompt(chunk, briefing, steering)

        # Call LLM with structured output
        # Note: LLM returns list[Finding] without proposed_edit
        findings, metrics = await self.client.call(
            agent_id=self.agent_id,
            system=system,
            user=user,
            response_model=list[Finding],
        )

        # Update metrics with chunk info
        metrics.chunk_index = chunk.chunk_index
        metrics.chunk_total = chunk.chunk_total

        return findings, metrics
