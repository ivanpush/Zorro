"""
PanelAdversary - 3-model panel adversarial review.

Runs Claude, GPT-5, and Gemini in parallel for diverse perspectives.
"""

import asyncio
import json
from typing import Any
from pydantic import BaseModel, Field, field_validator

from app.agents.base import BaseAgent
from app.models import (
    DocObj, BriefingOutput, Finding, Anchor, ProposedEdit, EvidencePack, AgentMetrics
)
from app.config import get_panel_models


class AdversaryFinding(BaseModel):
    """Single adversarial finding from LLM."""
    category: str = Field(description="overclaim, assumption, alternative, interpretation, methodology, limitation, contradiction, or feasibility")
    severity: str = Field(description="critical or major")
    title: str = Field(max_length=100)
    description: str
    paragraph_id: str
    quoted_text: str
    new_text: str | None = Field(None, description="Concrete rewrite if simple fix, otherwise None")
    suggestion: str = Field(description="WHAT the author should do to address this")
    rationale: str = Field(description="WHY this suggestion would strengthen the argument")


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


class PanelAdversary(BaseAgent):
    """
    3-model panel adversarial reviewer.

    Runs Claude Opus, GPT-5, and Gemini-3-Opus in parallel
    to get diverse critical perspectives.
    """

    @property
    def agent_id(self) -> str:
        return "adversary_panel"

    async def run(
        self,
        doc: DocObj,
        briefing: BriefingOutput,
        rigor_findings: list[Finding],
        evidence: EvidencePack,
        steering: str | None = None
    ) -> tuple[list[Finding], list[AgentMetrics]]:
        """
        Run 3-model panel review in parallel.

        Returns:
            Tuple of (all findings from all models, list of metrics per model)
        """
        system, user = self.composer.build_adversary_prompt(
            doc, briefing, rigor_findings, evidence, steering
        )

        # Get panel models
        panel_models = get_panel_models()

        # Run all 3 in parallel
        tasks = [
            self._run_single_model(agent_id, system, user)
            for agent_id, model in panel_models
        ]

        results = await asyncio.gather(*tasks)

        # Collect all findings and metrics
        all_findings = []
        all_metrics = []

        for agent_id, findings, metrics in results:
            # Tag findings with their source model
            for f in findings:
                f.agent_id = agent_id
            all_findings.extend(findings)
            all_metrics.append(metrics)

        return all_findings, all_metrics

    async def _run_single_model(
        self,
        agent_id: str,
        system: str,
        user: str
    ) -> tuple[str, list[Finding], AgentMetrics]:
        """Run a single model and return its findings."""
        output, metrics = await self.client.call(
            agent_id=agent_id,
            system=system,
            user=user,
            response_model=AdversaryOutput,
        )

        findings = self._convert_findings(output, agent_id)

        return agent_id, findings, metrics

    def _convert_findings(
        self, output: AdversaryOutput | list, agent_id: str
    ) -> list[Finding]:
        """Convert LLM output to Finding objects."""
        if isinstance(output, list):
            return output

        findings = []
        for f in output.findings:
            anchor = Anchor(
                paragraph_id=f.paragraph_id,
                quoted_text=f.quoted_text,
            )
            # Use "replace" if concrete rewrite provided, otherwise "suggestion"
            edit_type = "replace" if f.new_text else "suggestion"
            findings.append(Finding(
                agent_id=agent_id,
                category=f.category,
                severity=f.severity,
                title=f.title,
                description=f.description,
                anchors=[anchor],
                proposed_edit=ProposedEdit(
                    type=edit_type,
                    anchor=anchor,
                    new_text=f.new_text,
                    rationale=f.rationale,
                    suggestion=f.suggestion,
                ),
            ))

        return findings
