"""
Reconciler - Merges findings from 3-model panel.

Deduplicates similar findings and sets vote counts.
"""

import json
from typing import Any
from pydantic import BaseModel, Field, field_validator

from app.agents.base import BaseAgent
from app.models import Finding, Anchor, AgentMetrics


class ReconciledFinding(BaseModel):
    """Reconciled finding with vote count."""
    category: str
    severity: str
    title: str
    description: str
    paragraph_id: str
    quoted_text: str
    votes: int = Field(ge=1, le=3, description="How many models flagged this (1-3)")


class ReconcileOutput(BaseModel):
    """Output from reconciliation."""
    findings: list[ReconciledFinding] = Field(default_factory=list)

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


class Reconciler(BaseAgent):
    """
    Merges findings from 3-model panel.

    - Groups similar findings across models
    - Sets votes (1, 2, or 3) based on how many models flagged it
    - Higher votes = higher confidence
    """

    @property
    def agent_id(self) -> str:
        return "adversary_reconcile"

    async def run(
        self,
        findings_by_model: list[tuple[str, list[Finding]]]
    ) -> tuple[list[Finding], AgentMetrics]:
        """
        Reconcile findings from multiple models.

        Args:
            findings_by_model: List of (model_name, findings) tuples

        Returns:
            Tuple of (merged findings with votes, metrics)
        """
        system, user = self.composer.build_reconcile_prompt(findings_by_model)

        output, metrics = await self.client.call(
            agent_id=self.agent_id,
            system=system,
            user=user,
            response_model=ReconcileOutput,
        )

        findings = self._convert_findings(output)

        return findings, metrics

    def _convert_findings(self, output: ReconcileOutput | list) -> list[Finding]:
        """Convert reconciled output to Finding objects."""
        if isinstance(output, list):
            return output

        findings = []
        for f in output.findings:
            findings.append(Finding(
                agent_id="adversary_panel",
                category=f.category,
                severity=f.severity,
                title=f.title,
                description=f.description,
                anchors=[
                    Anchor(
                        paragraph_id=f.paragraph_id,
                        quoted_text=f.quoted_text,
                    )
                ],
                votes=f.votes,
            ))

        return findings
