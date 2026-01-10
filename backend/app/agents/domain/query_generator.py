"""
Stage 2: Query Generator

Generates search queries based on identified targets.
"""

from app.agents.base import BaseAgent
from app.models import DomainTargets, QueryGeneratorOutput, AgentMetrics


class QueryGenerator(BaseAgent):
    """
    Stage 2: Generate search queries from targets.

    Takes the identified targets and generates specific search queries
    to find relevant literature and evidence.
    """

    @property
    def agent_id(self) -> str:
        return "domain_query_generator"

    async def run(self, targets: DomainTargets) -> tuple[QueryGeneratorOutput, AgentMetrics]:
        """
        Generate search queries from domain targets.

        Args:
            targets: Domain targets identified in stage 1

        Returns:
            Tuple of (QueryGeneratorOutput, AgentMetrics)
        """
        # Build prompt using composer
        system, user = self.composer.build_domain_query_prompt(targets)

        # Call LLM
        output, metrics = await self.client.call(
            agent_id=self.agent_id,
            system_prompt=system,
            user_prompt=user,
            response_model=QueryGeneratorOutput,
        )

        return output, metrics
