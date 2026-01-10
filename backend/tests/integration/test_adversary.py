"""
Tests for adversary agents.
TDD Phase 11: Adversary Agent (Single + Panel + Reconcile)
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.models import (
    DocObj, Paragraph, Section, Finding, Anchor, ProposedEdit,
    BriefingOutput, EvidencePack, AgentMetrics
)
from app.agents.adversary import AdversaryAgent
from app.agents.adversary.single import SingleAdversary
from app.agents.adversary.panel import PanelAdversary
from app.agents.adversary.reconcile import Reconciler
from app.agents.base import BaseAgent


# ============================================================
# FIXTURES
# ============================================================

@pytest.fixture
def sample_doc() -> DocObj:
    """Create a sample document."""
    return DocObj(
        filename="test.pdf",
        type="pdf",
        title="Test Document",
        paragraphs=[
            Paragraph(
                paragraph_id="p_001",
                section_id="sec_001",
                paragraph_index=0,
                text="This study claims to show significant results.",
                sentences=[],
            ),
            Paragraph(
                paragraph_id="p_002",
                section_id="sec_001",
                paragraph_index=1,
                text="The methodology involves statistical analysis.",
                sentences=[],
            ),
        ],
        sections=[
            Section(
                section_id="sec_001",
                section_index=0,
                section_title="Introduction",
                paragraph_ids=["p_001", "p_002"],
            ),
        ],
    )


@pytest.fixture
def sample_briefing() -> BriefingOutput:
    """Create a sample briefing."""
    return BriefingOutput(
        summary="A study about testing methodologies.",
        main_claims=["Testing is effective", "Results are significant"],
        stated_scope="Unit testing only",
        methodology_summary="Statistical analysis",
        domain_keywords=["testing", "methodology"],
    )


@pytest.fixture
def sample_evidence() -> EvidencePack:
    """Create sample evidence pack."""
    return EvidencePack(
        supporting_evidence=[],
        contradicting_evidence=[],
        methodology_concerns=[],
        knowledge_gaps=["Limited sample size"],
    )


@pytest.fixture
def mock_finding() -> Finding:
    """Create a mock adversary finding."""
    return Finding(
        id="adv_001",
        agent_id="adversary",
        category="adversarial_weakness",
        severity="critical",
        title="Critical flaw in methodology",
        description="The statistical approach is flawed.",
        anchors=[
            Anchor(
                paragraph_id="p_002",
                quoted_text="statistical analysis",
            )
        ],
    )


@pytest.fixture
def mock_metrics() -> AgentMetrics:
    """Create mock metrics."""
    return AgentMetrics(
        agent_id="adversary",
        model="claude-opus-4-20250514",
        input_tokens=200,
        output_tokens=100,
        time_ms=1000.0,
        cost_usd=0.01,
    )


# ============================================================
# TEST: SingleAdversary
# ============================================================

class TestSingleAdversary:
    """Tests for SingleAdversary agent."""

    def test_agent_id_returns_adversary(self):
        """SingleAdversary.agent_id should return 'adversary'."""
        agent = SingleAdversary()
        assert agent.agent_id == "adversary"

    def test_is_base_agent(self):
        """SingleAdversary should be a subclass of BaseAgent."""
        agent = SingleAdversary()
        assert isinstance(agent, BaseAgent)

    @pytest.mark.asyncio
    async def test_run_returns_tuple(
        self, sample_doc, sample_briefing, sample_evidence, mock_finding, mock_metrics
    ):
        """run() should return tuple of (list[Finding], AgentMetrics)."""
        agent = SingleAdversary()

        with patch.object(agent, 'client') as mock_client:
            mock_client.call = AsyncMock(return_value=([mock_finding], mock_metrics))

            result = await agent.run(
                sample_doc, sample_briefing, [], sample_evidence
            )

            assert isinstance(result, tuple)
            assert len(result) == 2

    @pytest.mark.asyncio
    async def test_run_returns_findings_list(
        self, sample_doc, sample_briefing, sample_evidence, mock_finding, mock_metrics
    ):
        """run() should return list of Finding as first element."""
        agent = SingleAdversary()

        with patch.object(agent, 'client') as mock_client:
            mock_client.call = AsyncMock(return_value=([mock_finding], mock_metrics))

            findings, _ = await agent.run(
                sample_doc, sample_briefing, [], sample_evidence
            )

            assert isinstance(findings, list)
            assert all(isinstance(f, Finding) for f in findings)

    @pytest.mark.asyncio
    async def test_findings_have_critical_or_major_severity(
        self, sample_doc, sample_briefing, sample_evidence, mock_metrics
    ):
        """Adversary findings should have severity critical or major."""
        critical_finding = Finding(
            id="adv_001",
            agent_id="adversary",
            category="adversarial_weakness",
            severity="critical",
            title="Critical issue",
            description="A critical problem.",
            anchors=[Anchor(paragraph_id="p_001", quoted_text="significant results")],
        )
        major_finding = Finding(
            id="adv_002",
            agent_id="adversary",
            category="adversarial_gap",
            severity="major",
            title="Major gap",
            description="A major gap.",
            anchors=[Anchor(paragraph_id="p_002", quoted_text="methodology")],
        )

        agent = SingleAdversary()

        with patch.object(agent, 'client') as mock_client:
            mock_client.call = AsyncMock(
                return_value=([critical_finding, major_finding], mock_metrics)
            )

            findings, _ = await agent.run(
                sample_doc, sample_briefing, [], sample_evidence
            )

            for f in findings:
                assert f.severity in ["critical", "major"]


# ============================================================
# TEST: PanelAdversary
# ============================================================

class TestPanelAdversary:
    """Tests for PanelAdversary (3-model panel)."""

    def test_agent_id_returns_adversary_panel(self):
        """PanelAdversary.agent_id should return 'adversary_panel'."""
        agent = PanelAdversary()
        assert agent.agent_id == "adversary_panel"

    def test_is_base_agent(self):
        """PanelAdversary should be a subclass of BaseAgent."""
        agent = PanelAdversary()
        assert isinstance(agent, BaseAgent)

    @pytest.mark.asyncio
    async def test_runs_three_models_in_parallel(
        self, sample_doc, sample_briefing, sample_evidence, mock_finding, mock_metrics
    ):
        """PanelAdversary should run 3 models in parallel."""
        agent = PanelAdversary()

        with patch.object(agent, 'client') as mock_client:
            mock_client.call = AsyncMock(return_value=([mock_finding], mock_metrics))

            findings, metrics = await agent.run(
                sample_doc, sample_briefing, [], sample_evidence
            )

            # Should have called 3 times (one per model)
            assert mock_client.call.call_count == 3

    @pytest.mark.asyncio
    async def test_returns_findings_from_all_models(
        self, sample_doc, sample_briefing, sample_evidence, mock_metrics
    ):
        """Should return findings from all 3 models."""
        finding1 = Finding(
            id="f1", agent_id="adversary_panel_claude",
            category="adversarial_weakness", severity="critical",
            title="Issue 1", description="Desc",
            anchors=[Anchor(paragraph_id="p_001", quoted_text="results")],
        )
        finding2 = Finding(
            id="f2", agent_id="adversary_panel_openai",
            category="adversarial_gap", severity="major",
            title="Issue 2", description="Desc",
            anchors=[Anchor(paragraph_id="p_001", quoted_text="results")],
        )
        finding3 = Finding(
            id="f3", agent_id="adversary_panel_google",
            category="adversarial_alternative", severity="major",
            title="Issue 3", description="Desc",
            anchors=[Anchor(paragraph_id="p_002", quoted_text="methodology")],
        )

        agent = PanelAdversary()

        with patch.object(agent, 'client') as mock_client:
            mock_client.call = AsyncMock(
                side_effect=[
                    ([finding1], mock_metrics),
                    ([finding2], mock_metrics),
                    ([finding3], mock_metrics),
                ]
            )

            findings, metrics = await agent.run(
                sample_doc, sample_briefing, [], sample_evidence
            )

            # Should have findings from all 3
            assert len(findings) >= 3
            assert len(metrics) == 3


# ============================================================
# TEST: Reconciler
# ============================================================

class TestReconciler:
    """Tests for Reconciler agent."""

    def test_agent_id_returns_adversary_reconcile(self):
        """Reconciler.agent_id should return 'adversary_reconcile'."""
        agent = Reconciler()
        assert agent.agent_id == "adversary_reconcile"

    def test_is_base_agent(self):
        """Reconciler should be a subclass of BaseAgent."""
        agent = Reconciler()
        assert isinstance(agent, BaseAgent)

    @pytest.mark.asyncio
    async def test_merges_similar_findings(self, mock_metrics):
        """Reconciler should merge similar findings."""
        # Two findings about the same issue
        finding1 = Finding(
            id="f1", agent_id="adversary_panel_claude",
            category="adversarial_weakness", severity="critical",
            title="Statistical flaw", description="Stats are wrong",
            anchors=[Anchor(paragraph_id="p_001", quoted_text="statistical analysis")],
        )
        finding2 = Finding(
            id="f2", agent_id="adversary_panel_openai",
            category="adversarial_weakness", severity="critical",
            title="Statistics issue", description="Statistical problems",
            anchors=[Anchor(paragraph_id="p_001", quoted_text="statistical analysis")],
        )

        findings_by_model = [
            ("claude", [finding1]),
            ("openai", [finding2]),
            ("google", []),
        ]

        agent = Reconciler()

        # Mock returns merged finding with votes
        merged_finding = Finding(
            id="merged_1", agent_id="adversary_panel",
            category="adversarial_weakness", severity="critical",
            title="Statistical flaw", description="Stats are wrong",
            anchors=[Anchor(paragraph_id="p_001", quoted_text="statistical analysis")],
            votes=2,
        )

        with patch.object(agent, 'client') as mock_client:
            mock_client.call = AsyncMock(return_value=([merged_finding], mock_metrics))

            findings, _ = await agent.run(findings_by_model)

            assert len(findings) >= 1

    @pytest.mark.asyncio
    async def test_sets_votes_count(self, mock_metrics):
        """Reconciler should set votes field (1, 2, or 3)."""
        finding_voted = Finding(
            id="f1", agent_id="adversary_panel",
            category="adversarial_weakness", severity="critical",
            title="Issue", description="Desc",
            anchors=[Anchor(paragraph_id="p_001", quoted_text="text")],
            votes=3,
        )

        agent = Reconciler()

        with patch.object(agent, 'client') as mock_client:
            mock_client.call = AsyncMock(return_value=([finding_voted], mock_metrics))

            findings, _ = await agent.run([("claude", []), ("openai", []), ("google", [])])

            for f in findings:
                if f.votes is not None:
                    assert f.votes in [1, 2, 3]


# ============================================================
# TEST: AdversaryAgent (Main Interface)
# ============================================================

class TestAdversaryAgent:
    """Tests for AdversaryAgent main interface."""

    def test_agent_id_returns_adversary(self):
        """AdversaryAgent.agent_id should return 'adversary'."""
        agent = AdversaryAgent(panel_mode=False)
        assert agent.agent_id == "adversary"

    def test_panel_mode_agent_id(self):
        """AdversaryAgent in panel mode should return 'adversary_panel'."""
        agent = AdversaryAgent(panel_mode=True)
        assert agent.agent_id == "adversary_panel"

    def test_is_base_agent(self):
        """AdversaryAgent should be a subclass of BaseAgent."""
        agent = AdversaryAgent()
        assert isinstance(agent, BaseAgent)

    @pytest.mark.asyncio
    async def test_panel_mode_false_uses_single(
        self, sample_doc, sample_briefing, sample_evidence, mock_finding, mock_metrics
    ):
        """panel_mode=False should use SingleAdversary."""
        agent = AdversaryAgent(panel_mode=False)

        with patch.object(agent, '_single') as mock_single:
            mock_single.run = AsyncMock(return_value=([mock_finding], mock_metrics))

            await agent.run(sample_doc, sample_briefing, [], sample_evidence)

            mock_single.run.assert_called_once()

    @pytest.mark.asyncio
    async def test_panel_mode_true_uses_panel_and_reconcile(
        self, sample_doc, sample_briefing, sample_evidence, mock_finding, mock_metrics
    ):
        """panel_mode=True should use PanelAdversary then Reconciler."""
        agent = AdversaryAgent(panel_mode=True)

        with patch.object(agent, '_panel') as mock_panel, \
             patch.object(agent, '_reconciler') as mock_reconciler:

            mock_panel.run = AsyncMock(
                return_value=([mock_finding], [mock_metrics, mock_metrics, mock_metrics])
            )
            mock_reconciler.run = AsyncMock(
                return_value=([mock_finding], mock_metrics)
            )

            await agent.run(sample_doc, sample_briefing, [], sample_evidence)

            mock_panel.run.assert_called_once()
            mock_reconciler.run.assert_called_once()

    @pytest.mark.asyncio
    async def test_run_returns_tuple(
        self, sample_doc, sample_briefing, sample_evidence, mock_finding, mock_metrics
    ):
        """run() should return (list[Finding], AgentMetrics or list[AgentMetrics])."""
        agent = AdversaryAgent(panel_mode=False)

        with patch.object(agent, '_single') as mock_single:
            mock_single.run = AsyncMock(return_value=([mock_finding], mock_metrics))

            result = await agent.run(sample_doc, sample_briefing, [], sample_evidence)

            assert isinstance(result, tuple)
            assert len(result) == 2
            assert isinstance(result[0], list)
