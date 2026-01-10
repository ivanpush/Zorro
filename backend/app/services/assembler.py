"""
Assembler - Deterministic deduplication and sorting.

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

from collections import defaultdict
from app.models import Finding, Anchor, AGENT_PRIORITY, PRESENTATION_ORDER


class Assembler:
    """Deterministic deduplication with priority rules."""

    def assemble(self, findings: list[Finding]) -> list[Finding]:
        """
        Deduplicate and sort findings.

        1. Group by paragraph_id
        2. Within each paragraph, check for anchor overlaps
        3. When overlap detected, keep higher priority (lower number)
        4. Sort by presentation order
        """
        if not findings:
            return []

        # Group findings by paragraph
        by_paragraph: dict[str, list[Finding]] = defaultdict(list)
        for f in findings:
            for anchor in f.anchors:
                by_paragraph[anchor.paragraph_id].append(f)

        # Deduplicate within each paragraph
        kept_ids: set[str] = set()
        removed_ids: set[str] = set()

        for para_id, para_findings in by_paragraph.items():
            # Compare each pair
            for i, f1 in enumerate(para_findings):
                if f1.id in removed_ids:
                    continue

                for f2 in para_findings[i+1:]:
                    if f2.id in removed_ids:
                        continue
                    if f1.id == f2.id:
                        continue

                    # Check if anchors overlap
                    if self._findings_overlap(f1, f2, para_id):
                        # Keep higher priority (lower number)
                        p1 = AGENT_PRIORITY.get(f1.agent_id, 99)
                        p2 = AGENT_PRIORITY.get(f2.agent_id, 99)

                        if p1 <= p2:
                            removed_ids.add(f2.id)
                        else:
                            removed_ids.add(f1.id)

        # Filter to kept findings (dedupe by id since grouped by para)
        seen_ids: set[str] = set()
        kept: list[Finding] = []
        for f in findings:
            if f.id not in removed_ids and f.id not in seen_ids:
                kept.append(f)
                seen_ids.add(f.id)

        # Sort by presentation order
        kept.sort(key=lambda f: PRESENTATION_ORDER.get(f.agent_id, 99))

        return kept

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

        Returns True if:
        - Same paragraph AND
        - Text overlaps (exact match, substring, or partial overlap)
        """
        # Must be same paragraph
        if anchor1.paragraph_id != anchor2.paragraph_id:
            return False

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
        # e.g., "the quick brown" and "quick brown fox" overlap on "quick brown"
        for length in range(min(len(words1), len(words2)), 1, -1):
            # Get all n-grams of each text
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
