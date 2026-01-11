"""
SingleAdversary - Single model adversarial reviewer.

Acts as "Reviewer 2" - the skeptical expert reviewer.
"""

import asyncio
import json
import logging
from typing import Any
from pydantic import BaseModel, Field, field_validator

from app.agents.base import BaseAgent
from app.models import (
    DocObj, BriefingOutput, Finding, Anchor, EvidencePack, AgentMetrics
)

logger = logging.getLogger("zorro.agents.adversary")


class AdversaryFinding(BaseModel):
    """Single adversarial finding from LLM."""
    category: str = Field(description="adversarial_weakness, adversarial_gap, or adversarial_alternative")
    severity: str = Field(description="critical or major")
    title: str = Field(max_length=100)
    description: str
    paragraph_id: str
    quoted_text: str


class AdversaryOutput(BaseModel):
    """Structured output from adversary agent."""
    findings: list[AdversaryFinding] = Field(default_factory=list)

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


class SingleAdversary(BaseAgent):
    """
    Single-model adversarial reviewer.

    Uses Claude Opus to act as "Reviewer 2" - finding critical
    weaknesses, gaps, and alternative interpretations.
    """

    @property
    def agent_id(self) -> str:
        return "adversary"

    async def run(
        self,
        doc: DocObj,
        briefing: BriefingOutput,
        rigor_findings: list[Finding],
        evidence: EvidencePack,
        steering: str | None = None
    ) -> tuple[list[Finding], AgentMetrics]:
        """
        Run adversarial review.

        Args:
            doc: Document to review
            briefing: Context from briefing agent
            rigor_findings: Findings from rigor agents
            evidence: External evidence pack
            steering: Optional user steering

        Returns:
            Tuple of (list[Finding], AgentMetrics)
        """
        evidence_count = len(evidence.sources) if evidence.has_content() else 0
        logger.info(
            f"[adversary] Starting: {len(rigor_findings)} rigor findings, "
            f"{evidence_count} evidence sources"
        )

        system, user = self.composer.build_adversary_prompt(
            doc, briefing, rigor_findings, evidence, steering
        )

        output, metrics = await self.client.call(
            agent_id=self.agent_id,
            system=system,
            user=user,
            response_model=AdversaryOutput,
        )

        # Convert to Finding objects
        findings = self._convert_findings(output)

        logger.info(
            f"[adversary] Complete: {len(findings)} findings, "
            f"{metrics.time_ms:.0f}ms, ${metrics.cost_usd:.3f}"
        )

        return findings, metrics

    def _convert_findings(self, output: AdversaryOutput | list) -> list[Finding]:
        """Convert LLM output to Finding objects."""
        # Handle mock returns
        if isinstance(output, list):
            return output

        findings = []
        for f in output.findings:
            findings.append(Finding(
                agent_id=self.agent_id,
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
            ))

        return findings
