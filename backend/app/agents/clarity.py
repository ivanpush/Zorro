"""
Clarity Agent - Identifies writing quality and clarity issues.

Chunked agent that runs in parallel over word-based chunks.
"""

import asyncio
from pydantic import BaseModel, Field

from app.agents.base import BaseAgent
from app.models import DocObj, BriefingOutput, Finding, AgentMetrics
from app.services.chunker import chunk_for_clarity


class ClarityOutput(BaseModel):
    """Structured output from Clarity agent for a single chunk."""
    findings: list[Finding] = Field(default_factory=list)


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
