"""
Domain Pipeline Orchestrator

Orchestrates all 4 stages of the domain evidence gathering pipeline.
"""

from app.agents.base import BaseAgent
from app.models import DocObj, EvidencePack, AgentMetrics
from app.agents.domain.target_extractor import TargetExtractor
from app.agents.domain.query_generator import QueryGenerator
from app.agents.domain.search_executor import SearchExecutor
from app.agents.domain.evidence_synthesizer import EvidenceSynthesizer


class DomainPipeline(BaseAgent):
    """
    Domain Pipeline Orchestrator.

    Coordinates all 4 stages:
    1. TargetExtractor - identify what to search for
    2. QueryGenerator - generate search queries
    3. SearchExecutor - execute searches via Perplexity
    4. EvidenceSynthesizer - synthesize into EvidencePack

    Returns final EvidencePack and metrics from all stages.
    """

    @property
    def agent_id(self) -> str:
        return "domain_pipeline"

    async def run(self, doc: DocObj) -> tuple[EvidencePack, list[AgentMetrics]]:
        """
        Run complete domain pipeline.

        Args:
            doc: Document to analyze

        Returns:
            Tuple of (EvidencePack, list[AgentMetrics])
        """
        all_metrics = []

        # Stage 1: Extract targets
        target_extractor = TargetExtractor(client=self.client, composer=self.composer)
        targets, metrics = await target_extractor.run(doc)
        all_metrics.append(metrics)

        # Stage 2: Generate queries
        query_generator = QueryGenerator(client=self.client, composer=self.composer)
        query_output, metrics = await query_generator.run(targets)
        all_metrics.append(metrics)

        # Stage 3: Execute searches
        search_executor = SearchExecutor(client=self.client, composer=self.composer)
        (search_results, source_snippets), search_metrics = await search_executor.run(query_output)
        all_metrics.extend(search_metrics)

        # Stage 4: Synthesize evidence
        evidence_synthesizer = EvidenceSynthesizer(client=self.client, composer=self.composer)
        evidence_pack, metrics = await evidence_synthesizer.run(
            targets, search_results, source_snippets
        )
        all_metrics.append(metrics)

        return evidence_pack, all_metrics
