"""
Briefing Agent - Extracts context from document.

First agent in the pipeline. Produces BriefingOutput that other agents use.
"""

from app.agents.base import BaseAgent
from app.models import DocObj, BriefingOutput, AgentMetrics


class BriefingAgent(BaseAgent):
    """
    Extracts document context for downstream agents.

    Produces:
    - Summary of document
    - Main claims
    - Stated scope and limitations
    - Methodology summary
    - Domain keywords for search
    """

    @property
    def agent_id(self) -> str:
        return "briefing"

    async def run(
        self,
        doc: DocObj,
        steering: str | None = None
    ) -> tuple[BriefingOutput, AgentMetrics]:
        """
        Extract context from document.

        Args:
            doc: Document to analyze
            steering: Optional user steering memo

        Returns:
            Tuple of (BriefingOutput, AgentMetrics)
        """
        # Build prompt
        system, user = self.composer.build_briefing_prompt(doc, steering)

        # Call LLM with structured output
        output, metrics = await self.client.call(
            agent_id=self.agent_id,
            system=system,
            user=user,
            response_model=BriefingOutput,
        )

        return output, metrics
