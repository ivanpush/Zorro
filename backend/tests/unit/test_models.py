"""
Phase 2: Pydantic Models Tests

Tests for:
- DocObj creation and methods
- Finding with camelCase serialization
- Anchor requires quoted_text
- BriefingOutput requires claims
- EvidencePack.empty() and has_content()
- ReviewMetrics aggregation and to_dev_banner()
"""

import pytest
from datetime import datetime


class TestDocObj:
    """Tests for DocObj model."""

    def test_create_docobj(self):
        """DocObj should be creatable with required fields."""
        from app.models import DocObj
        doc = DocObj(
            filename="test.pdf",
            type="pdf",
            title="Test Document"
        )
        assert doc.filename == "test.pdf"
        assert doc.type == "pdf"
        assert doc.title == "Test Document"
        assert doc.document_id is not None

    def test_docobj_get_paragraph(self):
        """DocObj.get_paragraph should return paragraph by ID."""
        from app.models import DocObj, Paragraph
        doc = DocObj(
            filename="test.pdf",
            type="pdf",
            title="Test",
            paragraphs=[
                Paragraph(paragraph_id="p_001", paragraph_index=0, text="First paragraph."),
                Paragraph(paragraph_id="p_002", paragraph_index=1, text="Second paragraph."),
            ]
        )
        p = doc.get_paragraph("p_001")
        assert p is not None
        assert p.text == "First paragraph."

        missing = doc.get_paragraph("p_999")
        assert missing is None

    def test_docobj_get_full_text(self):
        """DocObj.get_full_text should concatenate all paragraphs."""
        from app.models import DocObj, Paragraph
        doc = DocObj(
            filename="test.pdf",
            type="pdf",
            title="Test",
            paragraphs=[
                Paragraph(paragraph_id="p_001", paragraph_index=0, text="First."),
                Paragraph(paragraph_id="p_002", paragraph_index=1, text="Second."),
            ]
        )
        full_text = doc.get_full_text()
        assert full_text == "First.\n\nSecond."

    def test_docobj_get_text_with_ids(self):
        """DocObj.get_text_with_ids should include paragraph IDs."""
        from app.models import DocObj, Paragraph
        doc = DocObj(
            filename="test.pdf",
            type="pdf",
            title="Test",
            paragraphs=[
                Paragraph(paragraph_id="p_001", paragraph_index=0, text="First."),
            ]
        )
        text_with_ids = doc.get_text_with_ids()
        assert "[p_001]" in text_with_ids
        assert "First." in text_with_ids

    def test_docobj_validate_anchor_text(self):
        """DocObj.validate_anchor_text should check if text exists."""
        from app.models import DocObj, Paragraph
        doc = DocObj(
            filename="test.pdf",
            type="pdf",
            title="Test",
            paragraphs=[
                Paragraph(paragraph_id="p_001", paragraph_index=0, text="The quick brown fox."),
            ]
        )
        assert doc.validate_anchor_text("p_001", "quick brown") is True
        assert doc.validate_anchor_text("p_001", "slow red") is False
        assert doc.validate_anchor_text("p_999", "anything") is False


class TestFinding:
    """Tests for Finding model with camelCase serialization."""

    def test_finding_creation(self):
        """Finding should be creatable with required fields."""
        from app.models import Finding, Anchor
        finding = Finding(
            agent_id="clarity",
            category="clarity_sentence",
            severity="minor",
            title="Test Finding",
            description="A test description",
            anchors=[Anchor(paragraph_id="p_001", quoted_text="test text")]
        )
        assert finding.agent_id == "clarity"
        assert finding.id is not None

    def test_finding_camelcase_serialization(self):
        """Finding.model_dump() should output camelCase keys."""
        from app.models import Finding, Anchor
        finding = Finding(
            agent_id="clarity",
            category="clarity_sentence",
            severity="minor",
            title="Test",
            description="Desc",
            anchors=[Anchor(paragraph_id="p_001", quoted_text="text")]
        )
        data = finding.model_dump()
        # Should have camelCase keys
        assert "agentId" in data
        assert "createdAt" in data
        # Should NOT have snake_case keys
        assert "agent_id" not in data
        assert "created_at" not in data

    def test_finding_requires_anchor(self):
        """Finding must have at least one anchor."""
        from app.models import Finding
        with pytest.raises(Exception):  # ValidationError
            Finding(
                agent_id="clarity",
                category="clarity_sentence",
                severity="minor",
                title="Test",
                description="Desc",
                anchors=[]  # Empty - should fail
            )

    def test_finding_proposed_edit_serialization(self):
        """Finding with proposed_edit should serialize correctly."""
        from app.models import Finding, Anchor, ProposedEdit
        finding = Finding(
            agent_id="rigor_rewrite",
            category="rigor_methodology",
            severity="major",
            title="Test",
            description="Desc",
            anchors=[Anchor(paragraph_id="p_001", quoted_text="original")],
            proposed_edit=ProposedEdit(
                type="replace",
                anchor=Anchor(paragraph_id="p_001", quoted_text="original"),
                new_text="improved",
                rationale="Better wording"
            )
        )
        data = finding.model_dump()
        assert "proposedEdit" in data
        assert data["proposedEdit"]["newText"] == "improved"

    def test_finding_votes_field(self):
        """Finding votes should be 1-3 when set."""
        from app.models import Finding, Anchor
        finding = Finding(
            agent_id="adversary_panel",
            category="adversarial_weakness",
            severity="critical",
            title="Test",
            description="Desc",
            anchors=[Anchor(paragraph_id="p_001", quoted_text="text")],
            votes=3
        )
        data = finding.model_dump()
        assert data["votes"] == 3


class TestAnchor:
    """Tests for Anchor model."""

    def test_anchor_requires_quoted_text(self):
        """Anchor must have non-empty quoted_text."""
        from app.models import Anchor
        with pytest.raises(Exception):  # ValidationError
            Anchor(paragraph_id="p_001", quoted_text="")

        with pytest.raises(Exception):  # ValidationError
            Anchor(paragraph_id="p_001", quoted_text="   ")

    def test_anchor_valid(self):
        """Anchor with valid quoted_text should work."""
        from app.models import Anchor
        anchor = Anchor(paragraph_id="p_001", quoted_text="valid text")
        assert anchor.paragraph_id == "p_001"
        assert anchor.quoted_text == "valid text"


class TestBriefingOutput:
    """Tests for BriefingOutput model."""

    def test_briefing_requires_claims(self):
        """BriefingOutput must have at least one main_claim."""
        from app.models import BriefingOutput
        with pytest.raises(Exception):  # ValidationError
            BriefingOutput(
                summary="Test summary",
                main_claims=[]  # Empty - should fail
            )

    def test_briefing_valid(self):
        """BriefingOutput with valid fields should work."""
        from app.models import BriefingOutput
        briefing = BriefingOutput(
            summary="A test summary",
            main_claims=["Claim 1", "Claim 2"]
        )
        assert briefing.summary == "A test summary"
        assert len(briefing.main_claims) == 2

    def test_briefing_format_for_prompt(self):
        """BriefingOutput.format_for_prompt should include key info."""
        from app.models import BriefingOutput
        briefing = BriefingOutput(
            summary="Summary text",
            main_claims=["Claim A"],
            stated_scope="Scope text"
        )
        prompt = briefing.format_for_prompt()
        assert "Summary: Summary text" in prompt
        assert "Claim A" in prompt
        assert "Stated scope: Scope text" in prompt


class TestEvidencePack:
    """Tests for EvidencePack model."""

    def test_evidence_pack_empty(self):
        """EvidencePack.empty() should create empty pack."""
        from app.models import EvidencePack
        pack = EvidencePack.empty()
        assert pack.confidence == "low"
        assert pack.has_content() is False

    def test_evidence_pack_has_content_with_data(self):
        """EvidencePack.has_content() should return True with data."""
        from app.models import EvidencePack
        pack = EvidencePack(
            design_limitations=["Cannot establish causation"]
        )
        assert pack.has_content() is True

    def test_evidence_pack_has_content_with_gaps(self):
        """EvidencePack.has_content() should return True with gaps."""
        from app.models import EvidencePack
        pack = EvidencePack(
            gaps="No evidence found for X"
        )
        assert pack.has_content() is True

    def test_evidence_pack_format_for_prompt(self):
        """EvidencePack.format_for_prompt should format nicely."""
        from app.models import EvidencePack
        pack = EvidencePack(
            design_limitations=["This is observational"],
            contradictions=["Jones 2023 found opposite"]
        )
        formatted = pack.format_for_prompt()
        assert "DESIGN LIMITATIONS" in formatted
        assert "observational" in formatted
        assert "CONTRADICTIONS" in formatted
        assert "Jones 2023" in formatted


class TestReviewMetrics:
    """Tests for ReviewMetrics aggregation."""

    def test_review_metrics_add(self):
        """ReviewMetrics.add() should aggregate metrics."""
        from app.models import ReviewMetrics, AgentMetrics
        metrics = ReviewMetrics()

        m1 = AgentMetrics(
            agent_id="clarity",
            model="claude-sonnet-4",
            input_tokens=1000,
            output_tokens=500,
            time_ms=2000,
            cost_usd=0.01
        )
        m2 = AgentMetrics(
            agent_id="rigor_find",
            model="claude-sonnet-4",
            input_tokens=2000,
            output_tokens=1000,
            time_ms=3000,
            cost_usd=0.02
        )

        metrics.add(m1)
        metrics.add(m2)

        assert metrics.total_input_tokens == 3000
        assert metrics.total_output_tokens == 1500
        assert metrics.total_time_ms == 5000
        assert metrics.total_cost_usd == 0.03
        assert len(metrics.agent_metrics) == 2

    def test_review_metrics_by_agent(self):
        """ReviewMetrics.by_agent() should group by agent_id."""
        from app.models import ReviewMetrics, AgentMetrics
        metrics = ReviewMetrics()

        metrics.add(AgentMetrics(
            agent_id="clarity", model="claude-sonnet-4",
            input_tokens=1000, output_tokens=500, time_ms=2000, cost_usd=0.01
        ))
        metrics.add(AgentMetrics(
            agent_id="clarity", model="claude-sonnet-4",
            input_tokens=1000, output_tokens=500, time_ms=2000, cost_usd=0.01
        ))

        by_agent = metrics.by_agent()
        assert "clarity" in by_agent
        assert by_agent["clarity"]["calls"] == 2
        assert by_agent["clarity"]["input_tokens"] == 2000

    def test_review_metrics_to_dev_banner(self):
        """ReviewMetrics.to_dev_banner() should format for frontend."""
        from app.models import ReviewMetrics, AgentMetrics
        metrics = ReviewMetrics()

        metrics.add(AgentMetrics(
            agent_id="clarity", model="claude-sonnet-4",
            input_tokens=1000, output_tokens=500, time_ms=2000, cost_usd=0.01
        ))

        banner = metrics.to_dev_banner()
        assert "total" in banner
        assert "agents" in banner
        assert banner["total"]["time_s"] == 2.0
        assert banner["total"]["tokens"] == 1500
        assert "clarity" in banner["agents"]


class TestReviewConfig:
    """Tests for ReviewConfig model."""

    def test_review_config_defaults(self):
        """ReviewConfig should have sensible defaults."""
        from app.models import ReviewConfig
        config = ReviewConfig()
        assert config.panel_mode is False
        assert config.enable_domain is True
        assert config.focus_chips == []


class TestSSEEvents:
    """Tests for SSE event models."""

    def test_phase_started_event(self):
        """PhaseStartedEvent should serialize correctly."""
        from app.models import PhaseStartedEvent
        event = PhaseStartedEvent(phase="briefing")
        assert event.type == "phase_started"
        assert event.phase == "briefing"

        sse = event.to_sse()
        assert "data:" in sse
        assert "phase_started" in sse

    def test_finding_discovered_event(self):
        """FindingDiscoveredEvent should include Finding."""
        from app.models import FindingDiscoveredEvent, Finding, Anchor
        finding = Finding(
            agent_id="clarity",
            category="clarity_sentence",
            severity="minor",
            title="Test",
            description="Desc",
            anchors=[Anchor(paragraph_id="p_001", quoted_text="text")]
        )
        event = FindingDiscoveredEvent(finding=finding)
        assert event.type == "finding_discovered"
