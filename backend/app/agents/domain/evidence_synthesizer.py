"""
Stage 4: Evidence Synthesizer

Synthesizes search results into structured evidence pack.
"""

from app.agents.base import BaseAgent
from app.models import (
    DomainTargets,
    SearchResult,
    SourceSnippet,
    EvidencePack,
    AgentMetrics,
)


class EvidenceSynthesizer(BaseAgent):
    """
    Stage 4: Synthesize search results into EvidencePack.

    Takes search results and synthesizes them into a structured
    evidence pack categorized by type (design limitations, contradictions, etc.)
    """

    @property
    def agent_id(self) -> str:
        return "domain_evidence_synthesizer"

    async def run(
        self,
        targets: DomainTargets,
        search_results: list[SearchResult],
        source_snippets: list[SourceSnippet],
    ) -> tuple[EvidencePack, AgentMetrics]:
        """
        Synthesize search results into evidence pack.

        Args:
            targets: Original domain targets
            search_results: Results from search executor
            source_snippets: Source snippets from searches

        Returns:
            Tuple of (EvidencePack, AgentMetrics)
        """
        # Convert search results to format for prompt
        search_data = [
            {
                "query_id": result.query_id,
                "response_text": result.response_text,
                "citations": result.citations,
            }
            for result in search_results
        ]

        # Build prompt using composer
        system, user = self.composer.build_domain_synth_prompt(targets, search_data)

        # Call LLM
        output, metrics = await self.client.call(
            agent_id=self.agent_id,
            system=system,
            user=user,
            response_model=EvidencePack,
        )

        # Add source snippets to the evidence pack
        output.sources = source_snippets

        return output, metrics
