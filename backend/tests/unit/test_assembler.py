"""
Tests for assembler service.
TDD Phase 6: Assembler
"""

import pytest
from app.models import Finding, Anchor
from app.services.assembler import Assembler


# ============================================================
# FIXTURES
# ============================================================

@pytest.fixture
def assembler() -> Assembler:
    """Create an Assembler instance."""
    return Assembler()


@pytest.fixture
def clarity_finding() -> Finding:
    """Create a clarity finding."""
    return Finding(
        id="clarity_1",
        agent_id="clarity",
        category="clarity_sentence",
        severity="minor",
        title="Unclear sentence",
        description="This sentence is confusing.",
        anchors=[
            Anchor(
                paragraph_id="p_001",
                quoted_text="The quick brown fox jumps over the lazy dog.",
            )
        ],
    )


@pytest.fixture
def rigor_finding() -> Finding:
    """Create a rigor finding on same text as clarity."""
    return Finding(
        id="rigor_1",
        agent_id="rigor_find",
        category="rigor_logic",
        severity="major",
        title="Logic issue",
        description="The logic here is flawed.",
        anchors=[
            Anchor(
                paragraph_id="p_001",
                quoted_text="The quick brown fox jumps over the lazy dog.",
            )
        ],
    )


@pytest.fixture
def adversary_finding() -> Finding:
    """Create an adversary finding on same text as others."""
    return Finding(
        id="adversary_1",
        agent_id="adversary",
        category="adversarial_weakness",
        severity="critical",
        title="Critical weakness",
        description="This argument has a fundamental flaw.",
        anchors=[
            Anchor(
                paragraph_id="p_001",
                quoted_text="The quick brown fox jumps over the lazy dog.",
            )
        ],
    )


@pytest.fixture
def different_para_finding() -> Finding:
    """Create a finding on a different paragraph."""
    return Finding(
        id="other_1",
        agent_id="clarity",
        category="clarity_paragraph",
        severity="minor",
        title="Different paragraph issue",
        description="Another issue.",
        anchors=[
            Anchor(
                paragraph_id="p_002",
                quoted_text="A completely different text.",
            )
        ],
    )


# ============================================================
# TEST: Empty Input
# ============================================================

class TestEmptyInput:
    """Tests for empty input handling."""

    def test_empty_returns_empty(self, assembler):
        """Empty input should return empty list."""
        result = assembler.assemble([])
        assert result == []


# ============================================================
# TEST: No Overlap
# ============================================================

class TestNoOverlap:
    """Tests when findings don't overlap."""

    def test_no_overlap_returns_all_findings(self, assembler, clarity_finding, different_para_finding):
        """Findings on different paragraphs should all be kept."""
        findings = [clarity_finding, different_para_finding]
        result = assembler.assemble(findings)

        assert len(result) == 2
        result_ids = {f.id for f in result}
        assert "clarity_1" in result_ids
        assert "other_1" in result_ids


# ============================================================
# TEST: Priority Dedup
# ============================================================

class TestPriorityDedup:
    """Tests for priority-based deduplication."""

    def test_rigor_beats_clarity(self, assembler, clarity_finding, rigor_finding):
        """Rigor (priority 2) should beat clarity (priority 3) on overlap."""
        findings = [clarity_finding, rigor_finding]
        result = assembler.assemble(findings)

        assert len(result) == 1
        assert result[0].id == "rigor_1"

    def test_adversary_beats_rigor(self, assembler, rigor_finding, adversary_finding):
        """Adversary (priority 1) should beat rigor (priority 2) on overlap."""
        findings = [rigor_finding, adversary_finding]
        result = assembler.assemble(findings)

        assert len(result) == 1
        assert result[0].id == "adversary_1"

    def test_adversary_beats_clarity(self, assembler, clarity_finding, adversary_finding):
        """Adversary (priority 1) should beat clarity (priority 3) on overlap."""
        findings = [clarity_finding, adversary_finding]
        result = assembler.assemble(findings)

        assert len(result) == 1
        assert result[0].id == "adversary_1"

    def test_all_three_overlap(self, assembler, clarity_finding, rigor_finding, adversary_finding):
        """When all three overlap, adversary wins."""
        findings = [clarity_finding, rigor_finding, adversary_finding]
        result = assembler.assemble(findings)

        assert len(result) == 1
        assert result[0].id == "adversary_1"


# ============================================================
# TEST: Presentation Order
# ============================================================

class TestPresentationOrder:
    """Tests for output sorting by presentation order."""

    def test_sorted_by_presentation_order(self, assembler):
        """Output should be sorted: clarity → rigor → adversary."""
        # Create findings on different paragraphs (no overlap)
        clarity = Finding(
            id="c1",
            agent_id="clarity",
            category="clarity_sentence",
            severity="minor",
            title="Clarity issue",
            description="Desc",
            anchors=[Anchor(paragraph_id="p_001", quoted_text="text one")],
        )
        rigor = Finding(
            id="r1",
            agent_id="rigor_find",
            category="rigor_logic",
            severity="major",
            title="Rigor issue",
            description="Desc",
            anchors=[Anchor(paragraph_id="p_002", quoted_text="text two")],
        )
        adversary = Finding(
            id="a1",
            agent_id="adversary",
            category="adversarial_weakness",
            severity="critical",
            title="Adversary issue",
            description="Desc",
            anchors=[Anchor(paragraph_id="p_003", quoted_text="text three")],
        )
        domain = Finding(
            id="d1",
            agent_id="domain",
            category="rigor_evidence",
            severity="major",
            title="Domain issue",
            description="Desc",
            anchors=[Anchor(paragraph_id="p_004", quoted_text="text four")],
        )

        # Input in random order
        findings = [adversary, domain, clarity, rigor]
        result = assembler.assemble(findings)

        assert len(result) == 4
        # clarity (1) → rigor (2) → domain (3) → adversary (4)
        assert result[0].agent_id == "clarity"
        assert result[1].agent_id == "rigor_find"
        assert result[2].agent_id == "domain"
        assert result[3].agent_id == "adversary"


# ============================================================
# TEST: _detect_overlap
# ============================================================

class TestDetectOverlap:
    """Tests for _detect_overlap helper."""

    def test_exact_match(self, assembler):
        """Exact same text should be detected as overlap."""
        a1 = Anchor(paragraph_id="p_001", quoted_text="The quick brown fox")
        a2 = Anchor(paragraph_id="p_001", quoted_text="The quick brown fox")

        assert assembler._detect_overlap(a1, a2) is True

    def test_exact_match_case_insensitive(self, assembler):
        """Overlap detection should be case insensitive."""
        a1 = Anchor(paragraph_id="p_001", quoted_text="The Quick Brown Fox")
        a2 = Anchor(paragraph_id="p_001", quoted_text="the quick brown fox")

        assert assembler._detect_overlap(a1, a2) is True

    def test_different_paragraphs_no_overlap(self, assembler):
        """Different paragraphs should not overlap even with same text."""
        a1 = Anchor(paragraph_id="p_001", quoted_text="The quick brown fox")
        a2 = Anchor(paragraph_id="p_002", quoted_text="The quick brown fox")

        assert assembler._detect_overlap(a1, a2) is False

    def test_substring_overlap(self, assembler):
        """One text being substring of other should be overlap."""
        a1 = Anchor(paragraph_id="p_001", quoted_text="The quick brown fox jumps over")
        a2 = Anchor(paragraph_id="p_001", quoted_text="quick brown fox")

        assert assembler._detect_overlap(a1, a2) is True

    def test_substring_overlap_reverse(self, assembler):
        """Substring detection should work in either direction."""
        a1 = Anchor(paragraph_id="p_001", quoted_text="quick brown fox")
        a2 = Anchor(paragraph_id="p_001", quoted_text="The quick brown fox jumps over")

        assert assembler._detect_overlap(a1, a2) is True

    def test_partial_word_overlap(self, assembler):
        """Contiguous word sequence should be detected as overlap."""
        a1 = Anchor(paragraph_id="p_001", quoted_text="The quick brown fox")
        a2 = Anchor(paragraph_id="p_001", quoted_text="quick brown fox jumps")

        assert assembler._detect_overlap(a1, a2) is True

    def test_significant_word_overlap(self, assembler):
        """Significant (>50%) word overlap should be detected."""
        a1 = Anchor(paragraph_id="p_001", quoted_text="fox jumps over the lazy dog")
        a2 = Anchor(paragraph_id="p_001", quoted_text="the lazy dog sleeps")

        # "the lazy dog" is 3 words, "the lazy dog sleeps" is 4
        # overlap is 3/4 = 75% of smaller
        assert assembler._detect_overlap(a1, a2) is True

    def test_no_overlap_different_text(self, assembler):
        """Completely different text should not overlap."""
        a1 = Anchor(paragraph_id="p_001", quoted_text="The quick brown fox")
        a2 = Anchor(paragraph_id="p_001", quoted_text="A slow red cat")

        assert assembler._detect_overlap(a1, a2) is False

    def test_minimal_overlap_not_detected(self, assembler):
        """Single common word should not count as overlap."""
        a1 = Anchor(paragraph_id="p_001", quoted_text="The quick brown fox jumps")
        a2 = Anchor(paragraph_id="p_001", quoted_text="The slow red cat sleeps")

        # Only "The" overlaps, which is 1/5 = 20% < 50%
        assert assembler._detect_overlap(a1, a2) is False
