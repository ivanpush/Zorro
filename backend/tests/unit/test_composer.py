"""
Tests for Composer - prompt library and builder.

Phase 5: TDD - tests first, then implementation.
"""

import pytest
from app.models import (
    DocObj, Paragraph, Section, BriefingOutput, Finding, Anchor,
    EvidencePack, ClarityChunk, RigorChunk
)


# ==============================================================================
# FIXTURES
# ==============================================================================

@pytest.fixture
def sample_doc() -> DocObj:
    """Minimal DocObj for testing."""
    return DocObj(
        document_id="doc_001",
        filename="test.pdf",
        type="pdf",
        title="Test Document",
        sections=[
            Section(
                section_id="sec_001",
                section_index=0,
                section_title="Introduction",
                paragraph_ids=["p_001", "p_002"]
            ),
            Section(
                section_id="sec_002",
                section_index=1,
                section_title="Methods",
                paragraph_ids=["p_003"]
            )
        ],
        paragraphs=[
            Paragraph(
                paragraph_id="p_001",
                section_id="sec_001",
                paragraph_index=0,
                text="This is the first paragraph of the introduction."
            ),
            Paragraph(
                paragraph_id="p_002",
                section_id="sec_001",
                paragraph_index=1,
                text="This is the second paragraph of the introduction."
            ),
            Paragraph(
                paragraph_id="p_003",
                section_id="sec_002",
                paragraph_index=2,
                text="This is the methods section."
            )
        ]
    )


@pytest.fixture
def sample_briefing() -> BriefingOutput:
    """Sample BriefingOutput for testing."""
    return BriefingOutput(
        summary="A study examining the effects of treatment X.",
        main_claims=["Treatment X improves outcomes", "Effect size is significant"],
        stated_scope="Limited to adult population",
        stated_limitations=["Small sample size"],
        methodology_summary="Randomized controlled trial",
        domain_keywords=["treatment", "RCT", "outcomes"]
    )


@pytest.fixture
def sample_clarity_chunk(sample_doc: DocObj) -> ClarityChunk:
    """Sample ClarityChunk for testing."""
    return ClarityChunk(
        chunk_index=0,
        chunk_total=1,
        paragraphs=sample_doc.paragraphs[:2],
        paragraph_ids=["p_001", "p_002"],
        word_count=100
    )


@pytest.fixture
def sample_rigor_chunk(sample_doc: DocObj) -> RigorChunk:
    """Sample RigorChunk for testing."""
    return RigorChunk(
        chunk_index=0,
        chunk_total=2,
        section=sample_doc.sections[1],  # Methods section
        paragraphs=[sample_doc.paragraphs[2]],
        paragraph_ids=["p_003"]
    )


@pytest.fixture
def sample_findings() -> list[Finding]:
    """Sample findings for testing."""
    return [
        Finding(
            id="finding_001",
            agent_id="rigor_find",
            category="rigor_logic",
            severity="major",
            title="Unsupported inference",
            description="The conclusion does not follow from the evidence.",
            anchors=[
                Anchor(paragraph_id="p_003", quoted_text="This is the methods")
            ]
        )
    ]


@pytest.fixture
def sample_evidence_pack() -> EvidencePack:
    """Sample EvidencePack for testing."""
    return EvidencePack(
        queries_used=["RCT limitations", "treatment X efficacy"],
        design_limitations=["RCTs cannot establish long-term effects"],
        contradictions=["Jones 2023 found no effect"],
        confidence="medium"
    )


# ==============================================================================
# PROMPT LIBRARY TESTS
# ==============================================================================

class TestPromptLibrary:
    """Tests for PromptLibrary class."""

    def test_library_exists(self):
        """PromptLibrary class exists and can be imported."""
        from app.composer import PromptLibrary
        lib = PromptLibrary()
        assert lib is not None

    def test_has_briefing_prompts(self):
        """PromptLibrary has BRIEFING_SYSTEM and BRIEFING_USER."""
        from app.composer import PromptLibrary
        lib = PromptLibrary()

        assert hasattr(lib, 'BRIEFING_SYSTEM')
        assert hasattr(lib, 'BRIEFING_USER')
        assert isinstance(lib.BRIEFING_SYSTEM, str)
        assert isinstance(lib.BRIEFING_USER, str)
        assert len(lib.BRIEFING_SYSTEM) > 0
        assert len(lib.BRIEFING_USER) > 0

    def test_has_clarity_prompts(self):
        """PromptLibrary has CLARITY_SYSTEM and CLARITY_USER."""
        from app.composer import PromptLibrary
        lib = PromptLibrary()

        assert hasattr(lib, 'CLARITY_SYSTEM')
        assert hasattr(lib, 'CLARITY_USER')
        assert isinstance(lib.CLARITY_SYSTEM, str)
        assert isinstance(lib.CLARITY_USER, str)

    def test_has_rigor_find_prompts(self):
        """PromptLibrary has RIGOR_FIND_SYSTEM and RIGOR_FIND_USER."""
        from app.composer import PromptLibrary
        lib = PromptLibrary()

        assert hasattr(lib, 'RIGOR_FIND_SYSTEM')
        assert hasattr(lib, 'RIGOR_FIND_USER')
        assert isinstance(lib.RIGOR_FIND_SYSTEM, str)
        assert isinstance(lib.RIGOR_FIND_USER, str)

    def test_has_rigor_rewrite_prompts(self):
        """PromptLibrary has RIGOR_REWRITE_SYSTEM and RIGOR_REWRITE_USER."""
        from app.composer import PromptLibrary
        lib = PromptLibrary()

        assert hasattr(lib, 'RIGOR_REWRITE_SYSTEM')
        assert hasattr(lib, 'RIGOR_REWRITE_USER')
        assert isinstance(lib.RIGOR_REWRITE_SYSTEM, str)
        assert isinstance(lib.RIGOR_REWRITE_USER, str)

    def test_has_domain_target_prompts(self):
        """PromptLibrary has DOMAIN_TARGET_SYSTEM and DOMAIN_TARGET_USER."""
        from app.composer import PromptLibrary
        lib = PromptLibrary()

        assert hasattr(lib, 'DOMAIN_TARGET_SYSTEM')
        assert hasattr(lib, 'DOMAIN_TARGET_USER')

    def test_has_domain_query_prompts(self):
        """PromptLibrary has DOMAIN_QUERY_SYSTEM and DOMAIN_QUERY_USER."""
        from app.composer import PromptLibrary
        lib = PromptLibrary()

        assert hasattr(lib, 'DOMAIN_QUERY_SYSTEM')
        assert hasattr(lib, 'DOMAIN_QUERY_USER')

    def test_has_domain_synth_prompts(self):
        """PromptLibrary has DOMAIN_SYNTH_SYSTEM and DOMAIN_SYNTH_USER."""
        from app.composer import PromptLibrary
        lib = PromptLibrary()

        assert hasattr(lib, 'DOMAIN_SYNTH_SYSTEM')
        assert hasattr(lib, 'DOMAIN_SYNTH_USER')

    def test_has_adversary_prompts(self):
        """PromptLibrary has ADVERSARY_SYSTEM and ADVERSARY_USER."""
        from app.composer import PromptLibrary
        lib = PromptLibrary()

        assert hasattr(lib, 'ADVERSARY_SYSTEM')
        assert hasattr(lib, 'ADVERSARY_USER')
        assert isinstance(lib.ADVERSARY_SYSTEM, str)
        assert isinstance(lib.ADVERSARY_USER, str)

    def test_has_reconcile_prompts(self):
        """PromptLibrary has RECONCILE_SYSTEM and RECONCILE_USER."""
        from app.composer import PromptLibrary
        lib = PromptLibrary()

        assert hasattr(lib, 'RECONCILE_SYSTEM')
        assert hasattr(lib, 'RECONCILE_USER')


# ==============================================================================
# COMPOSER TESTS
# ==============================================================================

class TestComposer:
    """Tests for Composer builder class."""

    def test_composer_exists(self):
        """Composer class exists and can be imported."""
        from app.composer import Composer
        composer = Composer()
        assert composer is not None

    def test_composer_has_library(self):
        """Composer has a PromptLibrary instance."""
        from app.composer import Composer
        composer = Composer()
        assert hasattr(composer, 'lib')


class TestBriefingPrompt:
    """Tests for build_briefing_prompt."""

    def test_returns_tuple(self, sample_doc: DocObj):
        """build_briefing_prompt returns (system, user) tuple."""
        from app.composer import Composer
        composer = Composer()

        result = composer.build_briefing_prompt(sample_doc)

        assert isinstance(result, tuple)
        assert len(result) == 2
        system, user = result
        assert isinstance(system, str)
        assert isinstance(user, str)

    def test_includes_document_tag(self, sample_doc: DocObj):
        """build_briefing_prompt includes <document> tag."""
        from app.composer import Composer
        composer = Composer()

        _, user = composer.build_briefing_prompt(sample_doc)

        assert "<document>" in user
        assert "</document>" in user

    def test_includes_document_text(self, sample_doc: DocObj):
        """build_briefing_prompt includes actual document text."""
        from app.composer import Composer
        composer = Composer()

        _, user = composer.build_briefing_prompt(sample_doc)

        assert "first paragraph of the introduction" in user
        assert "methods section" in user

    def test_includes_steering_memo(self, sample_doc: DocObj):
        """build_briefing_prompt includes steering memo when provided."""
        from app.composer import Composer
        composer = Composer()

        steering = "Focus on statistical methods"
        _, user = composer.build_briefing_prompt(sample_doc, steering=steering)

        assert "<user_directive>" in user
        assert steering in user
        assert "</user_directive>" in user

    def test_no_steering_when_none(self, sample_doc: DocObj):
        """build_briefing_prompt has no steering section when None."""
        from app.composer import Composer
        composer = Composer()

        _, user = composer.build_briefing_prompt(sample_doc, steering=None)

        assert "<user_directive>" not in user


class TestClarityPrompt:
    """Tests for build_clarity_prompt."""

    def test_returns_tuple(
        self, sample_clarity_chunk: ClarityChunk, sample_briefing: BriefingOutput
    ):
        """build_clarity_prompt returns (system, user) tuple."""
        from app.composer import Composer
        composer = Composer()

        result = composer.build_clarity_prompt(sample_clarity_chunk, sample_briefing)

        assert isinstance(result, tuple)
        assert len(result) == 2

    def test_includes_chunk_tag(
        self, sample_clarity_chunk: ClarityChunk, sample_briefing: BriefingOutput
    ):
        """build_clarity_prompt includes <chunk> tag."""
        from app.composer import Composer
        composer = Composer()

        _, user = composer.build_clarity_prompt(sample_clarity_chunk, sample_briefing)

        assert "<chunk" in user  # <chunk info=...>
        assert "</chunk>" in user

    def test_includes_briefing_tag(
        self, sample_clarity_chunk: ClarityChunk, sample_briefing: BriefingOutput
    ):
        """build_clarity_prompt includes <briefing> tag."""
        from app.composer import Composer
        composer = Composer()

        _, user = composer.build_clarity_prompt(sample_clarity_chunk, sample_briefing)

        assert "<briefing>" in user
        assert "</briefing>" in user

    def test_includes_briefing_content(
        self, sample_clarity_chunk: ClarityChunk, sample_briefing: BriefingOutput
    ):
        """build_clarity_prompt includes briefing content."""
        from app.composer import Composer
        composer = Composer()

        _, user = composer.build_clarity_prompt(sample_clarity_chunk, sample_briefing)

        # BriefingOutput.format_for_prompt includes summary
        assert "treatment X" in user.lower() or "Treatment X" in user

    def test_includes_chunk_index(
        self, sample_clarity_chunk: ClarityChunk, sample_briefing: BriefingOutput
    ):
        """build_clarity_prompt includes chunk index info."""
        from app.composer import Composer
        composer = Composer()

        _, user = composer.build_clarity_prompt(sample_clarity_chunk, sample_briefing)

        # Should show "1 of 1" (1-indexed)
        assert "1 of 1" in user

    def test_includes_steering_memo(
        self, sample_clarity_chunk: ClarityChunk, sample_briefing: BriefingOutput
    ):
        """build_clarity_prompt includes steering memo when provided."""
        from app.composer import Composer
        composer = Composer()

        steering = "Be strict about grammar"
        _, user = composer.build_clarity_prompt(
            sample_clarity_chunk, sample_briefing, steering=steering
        )

        assert "<user_directive>" in user
        assert steering in user


class TestRigorFindPrompt:
    """Tests for build_rigor_find_prompt."""

    def test_returns_tuple(
        self, sample_rigor_chunk: RigorChunk, sample_briefing: BriefingOutput
    ):
        """build_rigor_find_prompt returns (system, user) tuple."""
        from app.composer import Composer
        composer = Composer()

        result = composer.build_rigor_find_prompt(sample_rigor_chunk, sample_briefing)

        assert isinstance(result, tuple)
        assert len(result) == 2

    def test_includes_section_tag(
        self, sample_rigor_chunk: RigorChunk, sample_briefing: BriefingOutput
    ):
        """build_rigor_find_prompt includes <section> tag."""
        from app.composer import Composer
        composer = Composer()

        _, user = composer.build_rigor_find_prompt(sample_rigor_chunk, sample_briefing)

        assert "<section" in user  # <section name=...>
        assert "</section>" in user

    def test_includes_section_name(
        self, sample_rigor_chunk: RigorChunk, sample_briefing: BriefingOutput
    ):
        """build_rigor_find_prompt includes section name."""
        from app.composer import Composer
        composer = Composer()

        _, user = composer.build_rigor_find_prompt(sample_rigor_chunk, sample_briefing)

        assert "Methods" in user

    def test_includes_chunk_index(
        self, sample_rigor_chunk: RigorChunk, sample_briefing: BriefingOutput
    ):
        """build_rigor_find_prompt includes chunk index."""
        from app.composer import Composer
        composer = Composer()

        _, user = composer.build_rigor_find_prompt(sample_rigor_chunk, sample_briefing)

        # Should show "1 of 2" (1-indexed)
        assert "1 of 2" in user


class TestRigorRewritePrompt:
    """Tests for build_rigor_rewrite_prompt."""

    def test_returns_tuple(self, sample_findings: list[Finding], sample_doc: DocObj):
        """build_rigor_rewrite_prompt returns (system, user) tuple."""
        from app.composer import Composer
        composer = Composer()

        result = composer.build_rigor_rewrite_prompt(sample_findings, sample_doc)

        assert isinstance(result, tuple)
        assert len(result) == 2

    def test_includes_issues_tag(self, sample_findings: list[Finding], sample_doc: DocObj):
        """build_rigor_rewrite_prompt includes <issues> tag."""
        from app.composer import Composer
        composer = Composer()

        _, user = composer.build_rigor_rewrite_prompt(sample_findings, sample_doc)

        assert "<issues>" in user
        assert "</issues>" in user

    def test_includes_finding_content(
        self, sample_findings: list[Finding], sample_doc: DocObj
    ):
        """build_rigor_rewrite_prompt includes finding details."""
        from app.composer import Composer
        composer = Composer()

        _, user = composer.build_rigor_rewrite_prompt(sample_findings, sample_doc)

        assert "Unsupported inference" in user


class TestAdversaryPrompt:
    """Tests for build_adversary_prompt."""

    def test_returns_tuple(
        self,
        sample_doc: DocObj,
        sample_briefing: BriefingOutput,
        sample_findings: list[Finding],
        sample_evidence_pack: EvidencePack
    ):
        """build_adversary_prompt returns (system, user) tuple."""
        from app.composer import Composer
        composer = Composer()

        result = composer.build_adversary_prompt(
            sample_doc, sample_briefing, sample_findings, sample_evidence_pack
        )

        assert isinstance(result, tuple)
        assert len(result) == 2

    def test_includes_rigor_findings_tag(
        self,
        sample_doc: DocObj,
        sample_briefing: BriefingOutput,
        sample_findings: list[Finding],
        sample_evidence_pack: EvidencePack
    ):
        """build_adversary_prompt includes <rigor_findings> tag."""
        from app.composer import Composer
        composer = Composer()

        _, user = composer.build_adversary_prompt(
            sample_doc, sample_briefing, sample_findings, sample_evidence_pack
        )

        assert "<rigor_findings>" in user
        assert "</rigor_findings>" in user

    def test_includes_external_evidence_tag(
        self,
        sample_doc: DocObj,
        sample_briefing: BriefingOutput,
        sample_findings: list[Finding],
        sample_evidence_pack: EvidencePack
    ):
        """build_adversary_prompt includes <external_evidence> tag."""
        from app.composer import Composer
        composer = Composer()

        _, user = composer.build_adversary_prompt(
            sample_doc, sample_briefing, sample_findings, sample_evidence_pack
        )

        assert "<external_evidence>" in user
        assert "</external_evidence>" in user

    def test_includes_evidence_content(
        self,
        sample_doc: DocObj,
        sample_briefing: BriefingOutput,
        sample_findings: list[Finding],
        sample_evidence_pack: EvidencePack
    ):
        """build_adversary_prompt includes evidence pack content."""
        from app.composer import Composer
        composer = Composer()

        _, user = composer.build_adversary_prompt(
            sample_doc, sample_briefing, sample_findings, sample_evidence_pack
        )

        # EvidencePack.format_for_prompt includes design limitations
        assert "long-term effects" in user or "DESIGN LIMITATIONS" in user

    def test_includes_document_tag(
        self,
        sample_doc: DocObj,
        sample_briefing: BriefingOutput,
        sample_findings: list[Finding],
        sample_evidence_pack: EvidencePack
    ):
        """build_adversary_prompt includes <document> tag."""
        from app.composer import Composer
        composer = Composer()

        _, user = composer.build_adversary_prompt(
            sample_doc, sample_briefing, sample_findings, sample_evidence_pack
        )

        assert "<document>" in user
        assert "</document>" in user

    def test_includes_steering_memo(
        self,
        sample_doc: DocObj,
        sample_briefing: BriefingOutput,
        sample_findings: list[Finding],
        sample_evidence_pack: EvidencePack
    ):
        """build_adversary_prompt includes steering memo when provided."""
        from app.composer import Composer
        composer = Composer()

        steering = "Focus on methodology weaknesses"
        _, user = composer.build_adversary_prompt(
            sample_doc, sample_briefing, sample_findings, sample_evidence_pack,
            steering=steering
        )

        assert "<user_directive>" in user
        assert steering in user


class TestDomainPrompts:
    """Tests for Domain pipeline prompts."""

    def test_domain_target_prompt(self, sample_doc: DocObj):
        """build_domain_target_prompt returns tuple with document."""
        from app.composer import Composer
        composer = Composer()

        result = composer.build_domain_target_prompt(sample_doc)

        assert isinstance(result, tuple)
        assert len(result) == 2
        _, user = result
        assert "<document>" in user

    def test_domain_query_prompt(self):
        """build_domain_query_prompt returns tuple with targets."""
        from app.composer import Composer
        from app.models import DomainTargets, SearchPriority
        composer = Composer()

        targets = DomainTargets(
            document_type="research paper",
            study_design="RCT",
            design_can_establish=["Treatment effect"],
            design_cannot_establish=["Long-term effects"],
            summary="Test study",
            search_priorities=[
                SearchPriority(
                    search_for="RCT limitations",
                    why_it_matters="Design constraints",
                    search_type="design_limitation"
                )
            ],
            field="Medicine",
            subfield="Oncology"
        )

        result = composer.build_domain_query_prompt(targets)

        assert isinstance(result, tuple)
        assert len(result) == 2
        _, user = result
        assert "<targets>" in user

    def test_domain_synth_prompt(self):
        """build_domain_synth_prompt returns tuple with targets and results."""
        from app.composer import Composer
        from app.models import DomainTargets, SearchPriority
        composer = Composer()

        targets = DomainTargets(
            document_type="research paper",
            study_design="RCT",
            design_can_establish=["Treatment effect"],
            design_cannot_establish=["Long-term effects"],
            summary="Test study",
            search_priorities=[
                SearchPriority(
                    search_for="RCT limitations",
                    why_it_matters="Design constraints",
                    search_type="design_limitation"
                )
            ],
            field="Medicine",
            subfield="Oncology"
        )
        search_results = [{"query": "test", "results": []}]

        result = composer.build_domain_synth_prompt(targets, search_results)

        assert isinstance(result, tuple)
        assert len(result) == 2
        _, user = result
        assert "<targets>" in user
        assert "<search_results>" in user


class TestReconcilePrompt:
    """Tests for Panel mode reconciliation prompt."""

    def test_reconcile_prompt(self, sample_findings: list[Finding]):
        """build_reconcile_prompt returns tuple with all 3 reviewers."""
        from app.composer import Composer
        composer = Composer()

        findings_by_model = [
            ("gpt-5", sample_findings),
            ("gemini-3", sample_findings),
            ("claude-opus-4", sample_findings)
        ]

        result = composer.build_reconcile_prompt(findings_by_model)

        assert isinstance(result, tuple)
        assert len(result) == 2
        _, user = result
        assert "<reviewer_1" in user or "reviewer_1" in user
        assert "gpt-5" in user
        assert "gemini-3" in user
        assert "claude-opus-4" in user
