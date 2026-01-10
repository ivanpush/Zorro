"""
Stage 1: Target Extractor

Identifies what to search for in the literature based on document analysis.
"""

from app.agents.base import BaseAgent
from app.models import DocObj, DomainTargets, AgentMetrics


class TargetExtractor(BaseAgent):
    """
    Stage 1: Extract search targets from document.

    Analyzes the document to identify:
    - Study design and its limitations
    - What the design CAN and CANNOT establish
    - Search priorities for literature review
    """

    @property
    def agent_id(self) -> str:
        return "domain_target_extractor"

    async def run(self, doc: DocObj) -> tuple[DomainTargets, AgentMetrics]:
        """
        Extract domain search targets from document.

        Args:
            doc: The document to analyze

        Returns:
            Tuple of (DomainTargets, AgentMetrics)
        """
        # Build prompt using composer
        system, user = self.composer.build_domain_target_prompt(doc)

        # Call LLM
        output, metrics = await self.client.call(
            agent_id=self.agent_id,
            system_prompt=system,
            user_prompt=user,
            response_model=DomainTargets,
        )

        return output, metrics
