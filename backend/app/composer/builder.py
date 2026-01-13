"""
Composer - Deterministic prompt builder.
"""

import json
from app.models import (
    DocObj, BriefingOutput, Finding, EvidencePack,
    ClarityChunk, RigorChunk, DomainTargets
)
from app.composer.library import PromptLibrary


class Composer:
    """Builds prompts from template library."""

    def __init__(self):
        self.lib = PromptLibrary()

    def _steering(self, memo: str | None) -> str:
        if not memo:
            return ""
        return f"\n<user_directive>\n{memo}\n</user_directive>"

    def _format_findings(self, findings: list[Finding]) -> str:
        if not findings:
            return "No findings."
        parts = []
        for f in findings:
            parts.append(f"[{f.severity.upper()}] {f.title}")
            parts.append(f"  ID: {f.id}")
            parts.append(f"  Paragraph: {f.anchors[0].paragraph_id}")
            parts.append(f"  Text: \"{f.anchors[0].quoted_text[:100]}...\"")
            parts.append(f"  Issue: {f.description[:200]}...")
            parts.append("")
        return "\n".join(parts)

    # -------------------------------------------------------------------------
    # BRIEFING
    # -------------------------------------------------------------------------

    def build_briefing_prompt(
        self, doc: DocObj, steering: str | None = None
    ) -> tuple[str, str]:
        return (
            self.lib.BRIEFING_SYSTEM,
            self.lib.BRIEFING_USER.format(
                document_text=doc.get_text_for_briefing(),
                steering_memo=self._steering(steering)
            )
        )

    # -------------------------------------------------------------------------
    # CLARITY (CHUNKED)
    # -------------------------------------------------------------------------

    def build_clarity_prompt(
        self,
        chunk: ClarityChunk,
        briefing: BriefingOutput | None,
        steering: str | None = None
    ) -> tuple[str, str]:
        briefing_context = briefing.format_for_prompt() if briefing else "(No briefing context available)"
        return (
            self.lib.CLARITY_SYSTEM,
            self.lib.CLARITY_USER.format(
                briefing_context=briefing_context,
                chunk_index=chunk.chunk_index + 1,
                chunk_total=chunk.chunk_total,
                chunk_text=chunk.get_text_with_ids(),
                steering_memo=self._steering(steering)
            )
        )

    # -------------------------------------------------------------------------
    # RIGOR (2-PHASE)
    # -------------------------------------------------------------------------

    def build_rigor_find_prompt(
        self,
        chunk: RigorChunk,
        briefing: BriefingOutput | None,
        steering: str | None = None
    ) -> tuple[str, str]:
        briefing_context = briefing.format_for_prompt() if briefing else "(No briefing context available)"
        return (
            self.lib.RIGOR_FIND_SYSTEM,
            self.lib.RIGOR_FIND_USER.format(
                briefing_context=briefing_context,
                section_name=chunk.section.section_title or "Untitled",
                chunk_index=chunk.chunk_index + 1,
                chunk_total=chunk.chunk_total,
                chunk_text=chunk.get_text_with_ids(),
                steering_memo=self._steering(steering)
            )
        )

    def build_rigor_rewrite_prompt(
        self,
        findings: list[Finding],
        doc: DocObj
    ) -> tuple[str, str]:
        return (
            self.lib.RIGOR_REWRITE_SYSTEM,
            self.lib.RIGOR_REWRITE_USER.format(
                rigor_findings=self._format_findings(findings),
                document_text=doc.get_text_with_ids()
            )
        )

    # -------------------------------------------------------------------------
    # DOMAIN PIPELINE
    # -------------------------------------------------------------------------

    def build_domain_target_prompt(self, doc: DocObj) -> tuple[str, str]:
        return (
            self.lib.DOMAIN_TARGET_SYSTEM,
            self.lib.DOMAIN_TARGET_USER.format(
                document_text=doc.get_text_for_briefing()
            )
        )

    def build_domain_query_prompt(self, targets: DomainTargets) -> tuple[str, str]:
        return (
            self.lib.DOMAIN_QUERY_SYSTEM,
            self.lib.DOMAIN_QUERY_USER.format(
                targets_json=targets.model_dump_json(indent=2)
            )
        )

    def build_domain_synth_prompt(
        self, targets: DomainTargets, search_results: list[dict]
    ) -> tuple[str, str]:
        return (
            self.lib.DOMAIN_SYNTH_SYSTEM,
            self.lib.DOMAIN_SYNTH_USER.format(
                targets_json=targets.model_dump_json(indent=2),
                search_results=json.dumps(search_results, indent=2)
            )
        )

    # -------------------------------------------------------------------------
    # ADVERSARY
    # -------------------------------------------------------------------------

    def build_adversary_prompt(
        self,
        doc: DocObj,
        briefing: BriefingOutput | None,
        rigor_findings: list[Finding],
        evidence: EvidencePack,
        steering: str | None = None
    ) -> tuple[str, str]:
        briefing_context = briefing.format_for_prompt() if briefing else "(No briefing context available)"
        return (
            self.lib.ADVERSARY_SYSTEM,
            self.lib.ADVERSARY_USER.format(
                briefing_context=briefing_context,
                rigor_findings=self._format_findings(rigor_findings),
                evidence_pack=evidence.format_for_prompt(),
                document_text=doc.get_text_with_ids(),
                steering_memo=self._steering(steering)
            )
        )

    # -------------------------------------------------------------------------
    # PANEL RECONCILIATION
    # -------------------------------------------------------------------------

    def build_reconcile_prompt(
        self,
        findings_by_model: list[tuple[str, list[Finding]]]
    ) -> tuple[str, str]:
        # findings_by_model: [(model_name, findings), ...]
        parts = []
        for i, (model, findings) in enumerate(findings_by_model, 1):
            parts.append(f"<reviewer_{i} model=\"{model}\">")
            parts.append(self._format_findings(findings))
            parts.append(f"</reviewer_{i}>")

        return (
            self.lib.RECONCILE_SYSTEM,
            self.lib.RECONCILE_USER.format(
                model_1=findings_by_model[0][0] if len(findings_by_model) > 0 else "",
                findings_1=self._format_findings(findings_by_model[0][1]) if len(findings_by_model) > 0 else "",
                model_2=findings_by_model[1][0] if len(findings_by_model) > 1 else "",
                findings_2=self._format_findings(findings_by_model[1][1]) if len(findings_by_model) > 1 else "",
                model_3=findings_by_model[2][0] if len(findings_by_model) > 2 else "",
                findings_3=self._format_findings(findings_by_model[2][1]) if len(findings_by_model) > 2 else "",
            )
        )
