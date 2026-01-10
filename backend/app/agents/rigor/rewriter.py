"""
Rigor Rewriter Agent - Adds proposed edits to rigor findings.

Phase 2 of 2-phase rigor pipeline. Takes findings from Finder and adds fixes.
"""

from app.agents.base import BaseAgent
from app.models import DocObj, Finding, AgentMetrics


class RigorRewriter(BaseAgent):
    """
    Enhances rigor findings with proposed edits.

    This is the second phase of the rigor pipeline:
    1. RigorFinder: Identifies issues (no edits)
    2. RigorRewriter: Adds proposed_edit to findings

    Takes findings from Finder and returns them with proposed_edit populated.
    """

    @property
    def agent_id(self) -> str:
        return "rigor_rewrite"

    async def run(
        self,
        findings: list[Finding],
        doc: DocObj
    ) -> tuple[list[Finding], list[AgentMetrics]]:
        """
        Add proposed edits to rigor findings.

        Args:
            findings: Findings from RigorFinder (without proposed_edit)
            doc: Original document

        Returns:
            Tuple of (list[Finding], list[AgentMetrics])
            Findings have proposed_edit populated
        """
        # If no findings, return empty
        if not findings:
            return [], []

        # Build prompt with all findings
        system, user = self.composer.build_rigor_rewrite_prompt(findings, doc)

        # Call LLM with structured output
        # LLM returns findings with proposed_edit added
        enhanced_findings, metrics = await self.client.call(
            agent_id=self.agent_id,
            system=system,
            user=user,
            response_model=list[Finding],
        )

        return enhanced_findings, [metrics]
