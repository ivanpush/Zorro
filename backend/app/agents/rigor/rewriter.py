"""
Rigor Rewriter Agent - Adds proposed edits to rigor findings.

Phase 2 of 2-phase rigor pipeline. Takes findings from Finder and adds fixes.
Groups findings by section and processes in parallel (mirrors rigor_find batching).
"""

import asyncio
import logging
from collections import defaultdict
from typing import AsyncGenerator, Literal
from pydantic import BaseModel, Field

from app.agents.base import BaseAgent
from app.models import DocObj, Finding, Anchor, ProposedEdit, AgentMetrics

logger = logging.getLogger("zorro.agents.rigor")


# =============================================================================
# LLM Response Models
# =============================================================================

class RigorRewriteItem(BaseModel):
    """Single rewrite from LLM."""
    issue_index: int = Field(description="Index of the issue being fixed (0, 1, 2...)")
    type: Literal["replace", "insert_before", "insert_after", "suggestion"]
    quoted_text: str = Field(description="EXACT text being replaced (copy from issue)")
    new_text: str | None = Field(None, description="Replacement text (null if not fixable)")
    rationale: str = Field(description="WHY this suggestion/fix is a good one")
    suggestion: str = Field(description="WHAT to do - actionable guidance for the author")
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
    Processes findings in batches for parallelism and to avoid timeouts.
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
        if not findings:
            return [], []

        # Collect results from streaming
        all_merged: list[Finding] = []
        all_metrics: list[AgentMetrics] = []

        async for result in self.run_streaming(findings, doc):
            batch_idx, batch_findings, metrics, error = result
            if error:
                logger.error(f"[rigor_rewrite] Batch {batch_idx} failed: {error}")
            else:
                all_merged.extend(batch_findings)
                if metrics:
                    all_metrics.append(metrics)

        return all_merged, all_metrics

    async def run_streaming(
        self,
        findings: list[Finding],
        doc: DocObj
    ) -> AsyncGenerator[tuple[int, list[Finding], AgentMetrics | None, str | None], None]:
        """
        Stream batch completions for real-time progress.

        Yields:
            Tuple of (batch_index, findings, metrics, error)
            On error, findings is empty list from original batch, metrics is None
        """
        if not findings:
            return

        # Group findings by section (mirrors rigor_find batching)
        batches = self._group_by_section(findings, doc)
        total_batches = len(batches)

        logger.info(f"[rigor_rewrite] Processing {len(findings)} findings in {total_batches} section batches")

        # Log input state - how many already have proposed_edit?
        with_edit = sum(1 for f in findings if f.proposed_edit)
        logger.info(f"[rigor_rewrite] Input state: {with_edit}/{len(findings)} already have proposed_edit")

        # Process all batches in parallel, yield as they complete
        async def process_with_index(batch_idx: int, batch: list[Finding]):
            """Wrapper to preserve batch_idx through as_completed."""
            try:
                merged, metrics = await self._process_batch(batch, batch_idx, total_batches, doc)
                return (batch_idx, merged, metrics, None)
            except Exception as e:
                logger.error(f"[rigor_rewrite] Batch {batch_idx} FAILED: {e}")
                logger.error(f"[rigor_rewrite] Batch {batch_idx}: Returning {len(batch)} findings WITHOUT proposed_edit!")
                return (batch_idx, batch, None, str(e))

        tasks = [
            process_with_index(batch_idx, batch)
            for batch_idx, batch in enumerate(batches)
        ]

        for coro in asyncio.as_completed(tasks):
            result = await coro
            yield result

    async def _process_batch(
        self,
        batch: list[Finding],
        batch_idx: int,
        total_batches: int,
        doc: DocObj
    ) -> tuple[list[Finding], AgentMetrics]:
        """Process a single batch of findings."""
        logger.debug(f"[rigor_rewrite] Processing batch {batch_idx}/{total_batches} ({len(batch)} findings)")

        # Build prompt for this batch
        system, user = self.composer.build_rigor_rewrite_prompt(batch, doc)

        # Call LLM
        output, metrics = await self.client.call(
            agent_id=self.agent_id,
            system=system,
            user=user,
            response_model=RigorRewriteBatch,
            chunk_index=batch_idx,
            chunk_total=total_batches,
        )

        # Log LLM response
        logger.info(f"[rigor_rewrite] Batch {batch_idx}: LLM returned {len(output.rewrites)} rewrites for {len(batch)} findings")

        # Merge rewrites into findings
        merged = self._merge_rewrites_into_findings(batch, output.rewrites)

        # Log output state
        with_edit = sum(1 for f in merged if f.proposed_edit)
        logger.info(f"[rigor_rewrite] Batch {batch_idx}: Output {with_edit}/{len(merged)} have proposed_edit")

        return merged, metrics

    def _group_by_section(
        self,
        findings: list[Finding],
        doc: DocObj
    ) -> list[list[Finding]]:
        """
        Group findings by their section (mirrors rigor_find batching).

        Falls back to batches of 6 if section lookup fails.
        """
        # Build paragraph_id -> section_id lookup
        para_to_section: dict[str, str] = {}
        for p in doc.paragraphs:
            if p.section_id:
                para_to_section[p.paragraph_id] = p.section_id

        # Group findings by section
        by_section: dict[str, list[Finding]] = defaultdict(list)
        no_section: list[Finding] = []

        for f in findings:
            if f.anchors:
                para_id = f.anchors[0].paragraph_id
                section_id = para_to_section.get(para_id)
                if section_id:
                    by_section[section_id].append(f)
                else:
                    no_section.append(f)
            else:
                no_section.append(f)

        # Convert to list of batches
        batches = list(by_section.values())

        # Add findings with no section as separate batch
        if no_section:
            batches.append(no_section)

        return batches

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
        # Build lookup by index (indices are relative to this batch)
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
                        suggestion=rewrite.suggestion,
                    )
                else:
                    # Not fixable - include as suggestion type
                    proposed_edit = ProposedEdit(
                        type="suggestion",
                        anchor=finding.anchors[0],
                        new_text=None,
                        rationale=rewrite.rationale,
                        suggestion=rewrite.suggestion,
                    )

                # Create new finding with proposed_edit attached
                merged.append(Finding(
                    id=finding.id,
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
                # LLM skipped this finding - keep it without proposed_edit
                logger.warning(f"[rigor_rewrite] Missing rewrite for finding {i} (LLM skipped), keeping without suggestion")
                merged.append(finding)

        return merged
