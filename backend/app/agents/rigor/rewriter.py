"""
Rigor Rewriter Agent - Adds proposed edits to rigor findings.

Phase 2 of 2-phase rigor pipeline. Takes findings from Finder and adds fixes.
"""

from typing import Literal
from pydantic import BaseModel, Field

from app.agents.base import BaseAgent
from app.models import DocObj, Finding, Anchor, ProposedEdit, AgentMetrics


# =============================================================================
# LLM Response Models
# =============================================================================

class RigorRewriteItem(BaseModel):
    """Single rewrite from LLM."""
    issue_index: int = Field(description="Index of the issue being fixed (0, 1, 2...)")
    type: Literal["replace", "insert_before", "insert_after", "suggestion"]
    quoted_text: str = Field(description="EXACT text being replaced (copy from issue)")
    new_text: str | None = Field(None, description="Replacement text (null if not fixable)")
    rationale: str = Field(description="Why this fixes the problem")
    is_fixable: bool = Field(True, description="False if needs new data/experiments")


class RigorRewriteBatch(BaseModel):
    """Batch output from rewriter LLM."""
    rewrites: list[RigorRewriteItem] = Field(default_factory=list)


# =============================================================================
# Rewriter Agent
# =============================================================================

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

        # Call LLM with structured output - returns rewrites keyed by index
        batch, metrics = await self.client.call(
            agent_id=self.agent_id,
            system=system,
            user=user,
            response_model=RigorRewriteBatch,
        )

        # Merge rewrites back into original findings
        merged = self._merge_rewrites_into_findings(findings, batch.rewrites)

        return merged, [metrics]

    def _merge_rewrites_into_findings(
        self,
        findings: list[Finding],
        rewrites: list[RigorRewriteItem]
    ) -> list[Finding]:
        """
        Attach proposed_edit to each finding from rewrite phase.

        Preserves original finding IDs and all other fields.
        Only adds/updates proposed_edit.
        """
        # Build lookup by index
        rewrite_map = {r.issue_index: r for r in rewrites}

        merged = []
        for i, finding in enumerate(findings):
            if i in rewrite_map:
                rewrite = rewrite_map[i]

                # Build ProposedEdit from rewrite
                if rewrite.is_fixable and rewrite.new_text:
                    proposed_edit = ProposedEdit(
                        type=rewrite.type,
                        anchor=Anchor(
                            paragraph_id=finding.anchors[0].paragraph_id,
                            quoted_text=rewrite.quoted_text,
                            sentence_id=finding.anchors[0].sentence_id,
                        ),
                        new_text=rewrite.new_text,
                        rationale=rewrite.rationale,
                    )
                else:
                    # Not fixable - include as suggestion with rationale
                    proposed_edit = ProposedEdit(
                        type="suggestion",
                        anchor=finding.anchors[0],
                        new_text=None,
                        rationale=rewrite.rationale,
                    )

                # Create new finding with proposed_edit attached
                # Preserve all original fields, update agent_id
                merged.append(Finding(
                    id=finding.id,  # Keep original ID
                    agent_id="rigor_rewrite",
                    category=finding.category,
                    severity=finding.severity,
                    confidence=finding.confidence,
                    title=finding.title,
                    description=finding.description,
                    anchors=finding.anchors,
                    proposed_edit=proposed_edit,
                    metadata=finding.metadata,
                ))
            else:
                # No rewrite generated - keep original finding as-is
                merged.append(finding)

        return merged
