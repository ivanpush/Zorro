"""
Adversary Agents - Skeptical expert review.

Single mode: One model (Claude Opus)
Panel mode: 3 models in parallel + reconciliation
"""

from typing import Union

from app.agents.base import BaseAgent
from app.models import (
    DocObj, BriefingOutput, Finding, EvidencePack, AgentMetrics
)
from app.agents.adversary.single import SingleAdversary
from app.agents.adversary.panel import PanelAdversary
from app.agents.adversary.reconcile import Reconciler


class AdversaryAgent(BaseAgent):
    """
    Main adversary agent interface.

    Supports two modes:
    - panel_mode=False: Single model (Claude Opus)
    - panel_mode=True: 3-model panel + reconciliation
    """

    def __init__(self, panel_mode: bool = False, **kwargs):
        super().__init__(**kwargs)
        self.panel_mode = panel_mode
        self._single = SingleAdversary(client=self.client, composer=self.composer)
        self._panel = PanelAdversary(client=self.client, composer=self.composer)
        self._reconciler = Reconciler(client=self.client, composer=self.composer)

    @property
    def agent_id(self) -> str:
        return "adversary_panel" if self.panel_mode else "adversary"

    async def run(
        self,
        doc: DocObj,
        briefing: BriefingOutput,
        rigor_findings: list[Finding],
        evidence: EvidencePack,
        steering: str | None = None
    ) -> tuple[list[Finding], Union[AgentMetrics, list[AgentMetrics]]]:
        """
        Run adversarial review.

        In single mode: Returns (findings, single AgentMetrics)
        In panel mode: Returns (findings, list of AgentMetrics)
        """
        if not self.panel_mode:
            return await self._single.run(
                doc, briefing, rigor_findings, evidence, steering
            )

        # Panel mode: run 3 models then reconcile
        panel_findings, panel_metrics = await self._panel.run(
            doc, briefing, rigor_findings, evidence, steering
        )

        # Group findings by model for reconciliation
        findings_by_model = self._group_by_model(panel_findings)

        # Reconcile
        reconciled_findings, reconcile_metrics = await self._reconciler.run(
            findings_by_model
        )

        # Combine all metrics
        all_metrics = panel_metrics + [reconcile_metrics]

        return reconciled_findings, all_metrics

    def _group_by_model(
        self, findings: list[Finding]
    ) -> list[tuple[str, list[Finding]]]:
        """Group findings by their source model."""
        by_model = {}
        for f in findings:
            model = f.agent_id
            if model not in by_model:
                by_model[model] = []
            by_model[model].append(f)

        return list(by_model.items())


__all__ = [
    "AdversaryAgent",
    "SingleAdversary",
    "PanelAdversary",
    "Reconciler",
]
