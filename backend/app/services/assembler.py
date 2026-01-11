"""
Assembler - Deterministic deduplication, validation, and sorting.

Validation Rules:
1. All findings MUST have at least one anchor with paragraph_id
2. Findings with proposed_edit.type='replace' MUST have quoted_text that exists in document
3. Adversarial findings (Track C) can be comments without grounded text
4. Invalid findings are logged and filtered out

Dedup Rules:
1. Track B (Rigor) - NEVER deduplicated, all kept
2. Track A vs C overlap - Keep C (Adversary wins over Clarity), merge dimensions
3. Same track conflicts - keep higher priority (adversary > rigor > domain > clarity)

Priority for dedup (lower number = higher priority = wins on overlap):
- adversary, adversary_panel: 1
- rigor_find, rigor_rewrite, domain: 2
- clarity: 3
- briefing: 4

Presentation order (lower number = earlier in output):
- clarity: 1
- rigor_find, rigor_rewrite: 2
- domain: 3
- adversary, adversary_panel: 4
"""

import logging
from collections import defaultdict
from app.models import (
    Finding, Anchor, AgentMetrics, DocObj,
    ReviewOutput, ReviewSummary, ReviewMetadataOutput,
    AGENT_PRIORITY, PRESENTATION_ORDER
)

logger = logging.getLogger("zorro.assembler")


class Assembler:
    """Deterministic validation, deduplication with priority and track rules."""

    def assemble(
        self,
        findings: list[Finding],
        metrics: list[AgentMetrics] | None = None,
        doc: DocObj | None = None
    ) -> ReviewOutput:
        """
        Validate, deduplicate and sort findings, return ReviewOutput.

        Args:
            findings: All findings from all agents
            metrics: Optional agent metrics for metadata
            doc: Document for anchor validation (if provided, validates anchors)

        Returns:
            ReviewOutput with validated, deduplicated findings, summary, and metadata
        """
        if not findings:
            return ReviewOutput(
                findings=[],
                summary=ReviewSummary(total_findings=0),
                metadata=ReviewMetadataOutput.from_metrics(metrics or []),
            )

        input_count = len(findings)

        # Validate anchors if document provided
        if doc:
            validated = self._validate_findings(findings, doc)
            validated_count = len(validated)
            invalid_count = input_count - validated_count
            if invalid_count > 0:
                logger.warning(f"[assembler] Validation: {invalid_count} findings had invalid anchors")
        else:
            validated = findings

        # Deduplicate with track-aware rules
        deduped = self._deduplicate(validated)

        output_count = len(deduped)
        removed = len(validated) - output_count
        logger.info(f"[assembler] Dedup: {len(validated)} → {output_count} ({removed} removed)")

        # Build summary and metadata
        summary = ReviewSummary.from_findings(deduped)
        metadata = ReviewMetadataOutput.from_metrics(metrics or [])

        return ReviewOutput(
            findings=deduped,
            summary=summary,
            metadata=metadata,
        )

    def _validate_findings(self, findings: list[Finding], doc: DocObj) -> list[Finding]:
        """
        Validate finding anchors against document.

        Rules:
        - All findings must have at least one anchor with valid paragraph_id
        - If proposed_edit.type='replace', quoted_text MUST exist in the paragraph
        - Track C (adversarial) findings can have ungrounded text (comments)

        Returns:
            List of valid findings (invalid ones are filtered out with warnings)
        """
        valid: list[Finding] = []
        paragraph_ids = {p.paragraph_id for p in doc.paragraphs}

        for f in findings:
            is_valid = True
            issues: list[str] = []

            # Check all anchors have valid paragraph_id
            for anchor in f.anchors:
                if anchor.paragraph_id not in paragraph_ids:
                    issues.append(f"paragraph_id '{anchor.paragraph_id}' not in document")
                    is_valid = False

            # If it's a replace edit, quoted_text MUST exist in paragraph
            if f.proposed_edit and f.proposed_edit.type == 'replace':
                anchor = f.proposed_edit.anchor
                if anchor.paragraph_id in paragraph_ids:
                    if not doc.validate_anchor_text(anchor.paragraph_id, anchor.quoted_text):
                        # For Track C (adversarial), downgrade to suggestion but keep
                        if f.track == "C":
                            logger.warning(
                                f"[assembler] DOWNGRADED {f.agent_id} {f.id[:8]}: "
                                f"quoted_text not found → keeping as comment-only"
                            )
                            # Convert to suggestion type since we can't do replace
                            f.proposed_edit.type = "suggestion"
                        else:
                            issues.append(f"quoted_text not found (requires exact match for replace)")
                            is_valid = False

            if is_valid:
                valid.append(f)
            else:
                logger.warning(
                    f"[assembler] FILTERED {f.agent_id} {f.id[:8]}: {'; '.join(issues)}"
                )

        return valid

    def _deduplicate(self, findings: list[Finding]) -> list[Finding]:
        """
        Deduplicate with track-aware rules:
        1. Track B exempt from dedup (all Rigor findings kept)
        2. Track C wins over Track A on overlap (merge dimensions)
        3. Within same track, higher priority wins
        """
        # Separate Track B (exempt from dedup)
        track_b = [f for f in findings if f.track == "B"]
        others = [f for f in findings if f.track != "B"]

        logger.info(f"[assembler] Track B (exempt): {len(track_b)}, Others: {len(others)}")

        # Dedup Track A and C with C > A priority
        deduped_ac = self._dedup_with_track_priority(others)

        # Combine: Track B first, then deduped A/C
        all_kept = track_b + deduped_ac

        # Sort by presentation order
        all_kept.sort(key=lambda f: PRESENTATION_ORDER.get(f.agent_id, 99))

        return all_kept

    def _dedup_with_track_priority(self, findings: list[Finding]) -> list[Finding]:
        """
        Deduplicate Track A and C findings:
        - C wins over A on overlap (merge A's dimensions into C)
        - Same track: higher priority wins
        """
        if not findings:
            return []

        # Group by paragraph for overlap detection
        by_paragraph: dict[str, list[Finding]] = defaultdict(list)
        for f in findings:
            for anchor in f.anchors:
                by_paragraph[anchor.paragraph_id].append(f)

        removed_ids: set[str] = set()
        merged_dimensions: dict[str, list[str]] = {}  # finding_id -> merged dims

        for para_id, para_findings in by_paragraph.items():
            for i, f1 in enumerate(para_findings):
                if f1.id in removed_ids:
                    continue

                for f2 in para_findings[i+1:]:
                    if f2.id in removed_ids or f1.id == f2.id:
                        continue

                    # Check if anchors overlap
                    if self._findings_overlap(f1, f2, para_id):
                        winner, loser = self._resolve_conflict(f1, f2)

                        # Track dimension merging
                        if winner.id not in merged_dimensions:
                            merged_dimensions[winner.id] = list(winner.dimensions)
                        for dim in loser.dimensions:
                            if dim not in merged_dimensions[winner.id]:
                                merged_dimensions[winner.id].append(dim)

                        removed_ids.add(loser.id)
                        logger.info(
                            f"[assembler] Dedup: {loser.agent_id}:{loser.id[:8]} "
                            f"replaced by {winner.agent_id}:{winner.id[:8]} "
                            f"(merged dims: {merged_dimensions[winner.id]})"
                        )

        # Build result with merged dimensions
        seen_ids: set[str] = set()
        kept: list[Finding] = []

        for f in findings:
            if f.id not in removed_ids and f.id not in seen_ids:
                # Apply merged dimensions if any
                if f.id in merged_dimensions:
                    for dim in merged_dimensions[f.id]:
                        if dim not in f.dimensions:
                            f.dimensions.append(dim)
                kept.append(f)
                seen_ids.add(f.id)

        return kept

    def _resolve_conflict(self, f1: Finding, f2: Finding) -> tuple[Finding, Finding]:
        """
        Resolve conflict between two overlapping findings.
        Returns (winner, loser).

        Rules:
        - Track C wins over Track A
        - Same track: lower priority number wins
        """
        # Track C beats Track A
        if f1.track == "C" and f2.track == "A":
            return (f1, f2)
        if f2.track == "C" and f1.track == "A":
            return (f2, f1)

        # Same track or both C: use agent priority
        p1 = AGENT_PRIORITY.get(f1.agent_id, 99)
        p2 = AGENT_PRIORITY.get(f2.agent_id, 99)

        if p1 <= p2:
            return (f1, f2)
        return (f2, f1)

    def _findings_overlap(self, f1: Finding, f2: Finding, para_id: str) -> bool:
        """Check if two findings have overlapping anchors in a paragraph."""
        anchors1 = [a for a in f1.anchors if a.paragraph_id == para_id]
        anchors2 = [a for a in f2.anchors if a.paragraph_id == para_id]

        for a1 in anchors1:
            for a2 in anchors2:
                if self._detect_overlap(a1, a2):
                    return True
        return False

    def _detect_overlap(self, anchor1: Anchor, anchor2: Anchor) -> bool:
        """
        Check if two anchors reference overlapping text.

        Uses sentence_id if available (more precise), otherwise falls back
        to text comparison.
        """
        # Must be same paragraph
        if anchor1.paragraph_id != anchor2.paragraph_id:
            return False

        # If both have sentence_ids, use those (most precise)
        if anchor1.sentence_id and anchor2.sentence_id:
            return anchor1.sentence_id == anchor2.sentence_id

        # Fall back to text comparison
        text1 = anchor1.quoted_text.lower().strip()
        text2 = anchor2.quoted_text.lower().strip()

        # Exact match
        if text1 == text2:
            return True

        # One is substring of other
        if text1 in text2 or text2 in text1:
            return True

        # Partial overlap - check word overlap
        words1 = set(text1.split())
        words2 = set(text2.split())

        if not words1 or not words2:
            return False

        # Significant overlap if >50% of smaller set overlaps
        overlap = words1 & words2
        min_words = min(len(words1), len(words2))

        if min_words > 0 and len(overlap) / min_words > 0.5:
            return True

        # Check for contiguous word sequence overlap
        for length in range(min(len(words1), len(words2)), 1, -1):
            ngrams1 = self._get_ngrams(text1, length)
            ngrams2 = self._get_ngrams(text2, length)

            if ngrams1 & ngrams2:
                return True

        return False

    def _get_ngrams(self, text: str, n: int) -> set[str]:
        """Get word n-grams from text."""
        words = text.split()
        if len(words) < n:
            return set()
        return {" ".join(words[i:i+n]) for i in range(len(words) - n + 1)}
