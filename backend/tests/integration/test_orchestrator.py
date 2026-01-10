"""
Tests for Orchestrator - Pipeline coordination.

Tests:
- Runs Briefing and Domain in parallel
- Runs Clarity and Rigor-Find after Briefing
- Runs Rigor-Rewrite and Adversary in parallel
- Runs Assembler at end
- Returns ReviewJob with findings and metrics
- Metrics aggregated for dev banner
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

from app.services.orchestrator import Orchestrator
from app.models import (
    DocObj, Paragraph, Section, Sentence,
    ReviewConfig, ReviewJob,
    BriefingOutput, EvidencePack, Finding, Anchor,
    AgentMetrics, ReviewMetrics,
)


# ============================================================
# FIXTURES
# ============================================================

@pytest.fixture
def sample_doc():
    """Sample document for testing."""
    return DocObj(
        document_id="test-doc-001",
        filename="test.pdf",
        type="pdf",
        title="Test Document",
        sections=[
            Section(section_id="sec_1", section_title="Introduction", section_index=0),
            Section(section_id="sec_2", section_title="Methods", section_index=1),
        ],
        paragraphs=[
            Paragraph(
                paragraph_id="p_001",
                section_id="sec_1",
                paragraph_index=0,
                text="This is the introduction.",
                sentences=[
                    Sentence(
                        sentence_id="p_001_s_001",
                        paragraph_id="p_001",
                        sentence_index=0,
                        text="This is the introduction.",
                        start_char=0,
                        end_char=25,
                    )
                ],
            ),
            Paragraph(
                paragraph_id="p_002",
                section_id="sec_2",
                paragraph_index=1,
                text="Methods paragraph.",
                sentences=[
                    Sentence(
                        sentence_id="p_002_s_001",
                        paragraph_id="p_002",
                        sentence_index=0,
                        text="Methods paragraph.",
                        start_char=0,
                        end_char=18,
                    )
                ],
            ),
        ],
    )


@pytest.fixture
def sample_config():
    """Sample review configuration."""
    return ReviewConfig(
        panel_mode=False,
        focus_chips=["clarity", "rigor"],
        steering_memo="Focus on methodology",
        enable_domain=True,
    )


@pytest.fixture
def sample_briefing():
    """Sample briefing output."""
    return BriefingOutput(
        summary="Test document about methods",
        main_claims=["Claim 1", "Claim 2"],
        stated_scope="Limited scope",
        domain_keywords=["testing", "methods"],
    )


@pytest.fixture
def sample_evidence():
    """Sample evidence pack."""
    return EvidencePack(
        queries_used=["test query"],
        design_limitations=["Cannot establish causation"],
        confidence="medium",
    )


@pytest.fixture
def sample_finding():
    """Sample finding."""
    return Finding(
        id="finding-001",
        agent_id="clarity",
        category="clarity_sentence",
        severity="minor",
        title="Test finding",
        description="Test description",
        anchors=[Anchor(paragraph_id="p_001", quoted_text="introduction")],
    )


@pytest.fixture
def sample_metrics():
    """Sample agent metrics."""
    return AgentMetrics(
        agent_id="clarity",
        model="claude-sonnet",
        input_tokens=100,
        output_tokens=50,
        time_ms=500,
        cost_usd=0.001,
    )


# ============================================================
# TEST: PARALLEL BRIEFING AND DOMAIN
# ============================================================

class TestParallelBriefingDomain:
    """Tests that Briefing and Domain run in parallel."""

    @pytest.mark.asyncio
    async def test_briefing_and_domain_called(
        self, sample_doc, sample_config, sample_briefing, sample_evidence, sample_metrics
    ):
        """Briefing and Domain agents are both called."""
        with patch("app.services.orchestrator.BriefingAgent") as MockBriefing, \
             patch("app.services.orchestrator.DomainPipeline") as MockDomain, \
             patch("app.services.orchestrator.ClarityAgent"), \
             patch("app.services.orchestrator.RigorFinder"), \
             patch("app.services.orchestrator.RigorRewriter"), \
             patch("app.services.orchestrator.AdversaryAgent"), \
             patch("app.services.orchestrator.Assembler"):

            # Setup mocks
            mock_briefing_instance = MockBriefing.return_value
            mock_briefing_instance.run = AsyncMock(
                return_value=(sample_briefing, sample_metrics)
            )

            mock_domain_instance = MockDomain.return_value
            mock_domain_instance.run = AsyncMock(
                return_value=(sample_evidence, [sample_metrics])
            )

            orchestrator = Orchestrator()
            await orchestrator.run(sample_doc, sample_config)

            # Both should be called
            mock_briefing_instance.run.assert_called_once()
            mock_domain_instance.run.assert_called_once()

    @pytest.mark.asyncio
    async def test_domain_skipped_when_disabled(
        self, sample_doc, sample_briefing, sample_metrics
    ):
        """Domain is skipped when enable_domain=False."""
        config = ReviewConfig(enable_domain=False)

        with patch("app.services.orchestrator.BriefingAgent") as MockBriefing, \
             patch("app.services.orchestrator.DomainPipeline") as MockDomain, \
             patch("app.services.orchestrator.ClarityAgent"), \
             patch("app.services.orchestrator.RigorFinder"), \
             patch("app.services.orchestrator.RigorRewriter"), \
             patch("app.services.orchestrator.AdversaryAgent"), \
             patch("app.services.orchestrator.Assembler"):

            mock_briefing_instance = MockBriefing.return_value
            mock_briefing_instance.run = AsyncMock(
                return_value=(sample_briefing, sample_metrics)
            )

            orchestrator = Orchestrator()
            await orchestrator.run(sample_doc, config)

            # Domain should NOT be called
            mock_domain_instance = MockDomain.return_value
            mock_domain_instance.run.assert_not_called()


# ============================================================
# TEST: CLARITY AND RIGOR-FIND AFTER BRIEFING
# ============================================================

class TestClarityRigorAfterBriefing:
    """Tests that Clarity and Rigor-Find run after Briefing completes."""

    @pytest.mark.asyncio
    async def test_clarity_receives_briefing(
        self, sample_doc, sample_config, sample_briefing, sample_evidence,
        sample_finding, sample_metrics
    ):
        """Clarity agent receives briefing output."""
        with patch("app.services.orchestrator.BriefingAgent") as MockBriefing, \
             patch("app.services.orchestrator.DomainPipeline") as MockDomain, \
             patch("app.services.orchestrator.ClarityAgent") as MockClarity, \
             patch("app.services.orchestrator.RigorFinder") as MockRigorFind, \
             patch("app.services.orchestrator.RigorRewriter"), \
             patch("app.services.orchestrator.AdversaryAgent"), \
             patch("app.services.orchestrator.Assembler"):

            MockBriefing.return_value.run = AsyncMock(
                return_value=(sample_briefing, sample_metrics)
            )
            MockDomain.return_value.run = AsyncMock(
                return_value=(sample_evidence, [sample_metrics])
            )
            MockClarity.return_value.run = AsyncMock(
                return_value=([sample_finding], [sample_metrics])
            )
            MockRigorFind.return_value.run = AsyncMock(
                return_value=([], [sample_metrics])
            )

            orchestrator = Orchestrator()
            await orchestrator.run(sample_doc, sample_config)

            # Clarity should receive briefing
            call_args = MockClarity.return_value.run.call_args
            assert call_args[1]["briefing"] == sample_briefing

    @pytest.mark.asyncio
    async def test_rigor_find_receives_briefing(
        self, sample_doc, sample_config, sample_briefing, sample_evidence, sample_metrics
    ):
        """Rigor-Find agent receives briefing output."""
        with patch("app.services.orchestrator.BriefingAgent") as MockBriefing, \
             patch("app.services.orchestrator.DomainPipeline") as MockDomain, \
             patch("app.services.orchestrator.ClarityAgent") as MockClarity, \
             patch("app.services.orchestrator.RigorFinder") as MockRigorFind, \
             patch("app.services.orchestrator.RigorRewriter"), \
             patch("app.services.orchestrator.AdversaryAgent"), \
             patch("app.services.orchestrator.Assembler"):

            MockBriefing.return_value.run = AsyncMock(
                return_value=(sample_briefing, sample_metrics)
            )
            MockDomain.return_value.run = AsyncMock(
                return_value=(sample_evidence, [sample_metrics])
            )
            MockClarity.return_value.run = AsyncMock(return_value=([], [sample_metrics]))
            MockRigorFind.return_value.run = AsyncMock(return_value=([], [sample_metrics]))

            orchestrator = Orchestrator()
            await orchestrator.run(sample_doc, sample_config)

            # Rigor-Find should receive briefing
            call_args = MockRigorFind.return_value.run.call_args
            assert call_args[1]["briefing"] == sample_briefing


# ============================================================
# TEST: RIGOR-REWRITE AND ADVERSARY IN PARALLEL
# ============================================================

class TestRigorRewriteAdversaryParallel:
    """Tests that Rigor-Rewrite and Adversary run in parallel."""

    @pytest.mark.asyncio
    async def test_rigor_rewrite_receives_findings(
        self, sample_doc, sample_config, sample_briefing, sample_evidence,
        sample_finding, sample_metrics
    ):
        """Rigor-Rewrite receives findings from Rigor-Find."""
        rigor_finding = Finding(
            id="rigor-001",
            agent_id="rigor_find",
            category="rigor_methodology",
            severity="major",
            title="Rigor issue",
            description="Method concern",
            anchors=[Anchor(paragraph_id="p_002", quoted_text="Methods")],
        )

        with patch("app.services.orchestrator.BriefingAgent") as MockBriefing, \
             patch("app.services.orchestrator.DomainPipeline") as MockDomain, \
             patch("app.services.orchestrator.ClarityAgent") as MockClarity, \
             patch("app.services.orchestrator.RigorFinder") as MockRigorFind, \
             patch("app.services.orchestrator.RigorRewriter") as MockRigorRewrite, \
             patch("app.services.orchestrator.AdversaryAgent") as MockAdversary, \
             patch("app.services.orchestrator.Assembler"):

            MockBriefing.return_value.run = AsyncMock(
                return_value=(sample_briefing, sample_metrics)
            )
            MockDomain.return_value.run = AsyncMock(
                return_value=(sample_evidence, [sample_metrics])
            )
            MockClarity.return_value.run = AsyncMock(return_value=([], [sample_metrics]))
            MockRigorFind.return_value.run = AsyncMock(
                return_value=([rigor_finding], [sample_metrics])
            )
            MockRigorRewrite.return_value.run = AsyncMock(
                return_value=([rigor_finding], [sample_metrics])
            )
            MockAdversary.return_value.run = AsyncMock(
                return_value=([], sample_metrics)
            )

            orchestrator = Orchestrator()
            await orchestrator.run(sample_doc, sample_config)

            # Rigor-Rewrite should receive findings
            call_args = MockRigorRewrite.return_value.run.call_args
            assert rigor_finding in call_args[0][0]  # First positional arg

    @pytest.mark.asyncio
    async def test_adversary_receives_evidence(
        self, sample_doc, sample_config, sample_briefing, sample_evidence, sample_metrics
    ):
        """Adversary receives evidence pack from Domain."""
        with patch("app.services.orchestrator.BriefingAgent") as MockBriefing, \
             patch("app.services.orchestrator.DomainPipeline") as MockDomain, \
             patch("app.services.orchestrator.ClarityAgent") as MockClarity, \
             patch("app.services.orchestrator.RigorFinder") as MockRigorFind, \
             patch("app.services.orchestrator.RigorRewriter") as MockRigorRewrite, \
             patch("app.services.orchestrator.AdversaryAgent") as MockAdversary, \
             patch("app.services.orchestrator.Assembler"):

            MockBriefing.return_value.run = AsyncMock(
                return_value=(sample_briefing, sample_metrics)
            )
            MockDomain.return_value.run = AsyncMock(
                return_value=(sample_evidence, [sample_metrics])
            )
            MockClarity.return_value.run = AsyncMock(return_value=([], [sample_metrics]))
            MockRigorFind.return_value.run = AsyncMock(return_value=([], [sample_metrics]))
            MockRigorRewrite.return_value.run = AsyncMock(return_value=([], []))
            MockAdversary.return_value.run = AsyncMock(
                return_value=([], sample_metrics)
            )

            orchestrator = Orchestrator()
            await orchestrator.run(sample_doc, sample_config)

            # Adversary should receive evidence
            call_args = MockAdversary.return_value.run.call_args
            assert call_args[1]["evidence"] == sample_evidence


# ============================================================
# TEST: ASSEMBLER AT END
# ============================================================

class TestAssemblerAtEnd:
    """Tests that Assembler runs after all agents complete."""

    @pytest.mark.asyncio
    async def test_assembler_receives_all_findings(
        self, sample_doc, sample_config, sample_briefing, sample_evidence, sample_metrics
    ):
        """Assembler receives findings from all agents."""
        clarity_finding = Finding(
            id="clarity-001",
            agent_id="clarity",
            category="clarity_sentence",
            severity="minor",
            title="Clarity issue",
            description="Description",
            anchors=[Anchor(paragraph_id="p_001", quoted_text="text")],
        )
        rigor_finding = Finding(
            id="rigor-001",
            agent_id="rigor_rewrite",
            category="rigor_methodology",
            severity="major",
            title="Rigor issue",
            description="Description",
            anchors=[Anchor(paragraph_id="p_002", quoted_text="text")],
        )
        adversary_finding = Finding(
            id="adversary-001",
            agent_id="adversary",
            category="adversarial_weakness",
            severity="critical",
            title="Adversary issue",
            description="Description",
            anchors=[Anchor(paragraph_id="p_001", quoted_text="text")],
        )

        with patch("app.services.orchestrator.BriefingAgent") as MockBriefing, \
             patch("app.services.orchestrator.DomainPipeline") as MockDomain, \
             patch("app.services.orchestrator.ClarityAgent") as MockClarity, \
             patch("app.services.orchestrator.RigorFinder") as MockRigorFind, \
             patch("app.services.orchestrator.RigorRewriter") as MockRigorRewrite, \
             patch("app.services.orchestrator.AdversaryAgent") as MockAdversary, \
             patch("app.services.orchestrator.Assembler") as MockAssembler:

            MockBriefing.return_value.run = AsyncMock(
                return_value=(sample_briefing, sample_metrics)
            )
            MockDomain.return_value.run = AsyncMock(
                return_value=(sample_evidence, [sample_metrics])
            )
            MockClarity.return_value.run = AsyncMock(
                return_value=([clarity_finding], [sample_metrics])
            )
            MockRigorFind.return_value.run = AsyncMock(
                return_value=([rigor_finding], [sample_metrics])
            )
            MockRigorRewrite.return_value.run = AsyncMock(
                return_value=([rigor_finding], [sample_metrics])
            )
            MockAdversary.return_value.run = AsyncMock(
                return_value=([adversary_finding], sample_metrics)
            )

            # Assembler returns sorted/deduped findings
            MockAssembler.return_value.assemble = MagicMock(
                return_value=[clarity_finding, rigor_finding, adversary_finding]
            )

            orchestrator = Orchestrator()
            await orchestrator.run(sample_doc, sample_config)

            # Assembler should be called with all findings
            call_args = MockAssembler.return_value.assemble.call_args
            findings_input = call_args[0][0]

            # Should include findings from clarity, rigor, and adversary
            assert any(f.agent_id == "clarity" for f in findings_input)
            assert any(f.agent_id == "rigor_rewrite" for f in findings_input)
            assert any(f.agent_id == "adversary" for f in findings_input)


# ============================================================
# TEST: RETURNS REVIEW JOB
# ============================================================

class TestReturnsReviewJob:
    """Tests that orchestrator returns ReviewJob with findings and metrics."""

    @pytest.mark.asyncio
    async def test_returns_review_job(
        self, sample_doc, sample_config, sample_briefing, sample_evidence,
        sample_finding, sample_metrics
    ):
        """Orchestrator returns ReviewJob instance."""
        with patch("app.services.orchestrator.BriefingAgent") as MockBriefing, \
             patch("app.services.orchestrator.DomainPipeline") as MockDomain, \
             patch("app.services.orchestrator.ClarityAgent") as MockClarity, \
             patch("app.services.orchestrator.RigorFinder") as MockRigorFind, \
             patch("app.services.orchestrator.RigorRewriter") as MockRigorRewrite, \
             patch("app.services.orchestrator.AdversaryAgent") as MockAdversary, \
             patch("app.services.orchestrator.Assembler") as MockAssembler:

            MockBriefing.return_value.run = AsyncMock(
                return_value=(sample_briefing, sample_metrics)
            )
            MockDomain.return_value.run = AsyncMock(
                return_value=(sample_evidence, [sample_metrics])
            )
            MockClarity.return_value.run = AsyncMock(
                return_value=([sample_finding], [sample_metrics])
            )
            MockRigorFind.return_value.run = AsyncMock(return_value=([], [sample_metrics]))
            MockRigorRewrite.return_value.run = AsyncMock(return_value=([], []))
            MockAdversary.return_value.run = AsyncMock(return_value=([], sample_metrics))
            MockAssembler.return_value.assemble = MagicMock(
                return_value=[sample_finding]
            )

            orchestrator = Orchestrator()
            result = await orchestrator.run(sample_doc, sample_config)

            assert isinstance(result, ReviewJob)
            assert result.document_id == sample_doc.document_id
            assert result.status == "completed"

    @pytest.mark.asyncio
    async def test_review_job_has_findings(
        self, sample_doc, sample_config, sample_briefing, sample_evidence,
        sample_finding, sample_metrics
    ):
        """ReviewJob contains assembled findings."""
        with patch("app.services.orchestrator.BriefingAgent") as MockBriefing, \
             patch("app.services.orchestrator.DomainPipeline") as MockDomain, \
             patch("app.services.orchestrator.ClarityAgent") as MockClarity, \
             patch("app.services.orchestrator.RigorFinder") as MockRigorFind, \
             patch("app.services.orchestrator.RigorRewriter") as MockRigorRewrite, \
             patch("app.services.orchestrator.AdversaryAgent") as MockAdversary, \
             patch("app.services.orchestrator.Assembler") as MockAssembler:

            MockBriefing.return_value.run = AsyncMock(
                return_value=(sample_briefing, sample_metrics)
            )
            MockDomain.return_value.run = AsyncMock(
                return_value=(sample_evidence, [sample_metrics])
            )
            MockClarity.return_value.run = AsyncMock(
                return_value=([sample_finding], [sample_metrics])
            )
            MockRigorFind.return_value.run = AsyncMock(return_value=([], [sample_metrics]))
            MockRigorRewrite.return_value.run = AsyncMock(return_value=([], []))
            MockAdversary.return_value.run = AsyncMock(return_value=([], sample_metrics))
            MockAssembler.return_value.assemble = MagicMock(
                return_value=[sample_finding]
            )

            orchestrator = Orchestrator()
            result = await orchestrator.run(sample_doc, sample_config)

            assert len(result.findings) == 1
            assert result.findings[0].id == sample_finding.id


# ============================================================
# TEST: METRICS AGGREGATION
# ============================================================

class TestMetricsAggregation:
    """Tests that metrics are properly aggregated for dev banner."""

    @pytest.mark.asyncio
    async def test_metrics_aggregated(
        self, sample_doc, sample_config, sample_briefing, sample_evidence, sample_finding
    ):
        """All agent metrics are aggregated into ReviewMetrics."""
        briefing_metrics = AgentMetrics(
            agent_id="briefing",
            model="claude-sonnet",
            input_tokens=100,
            output_tokens=50,
            time_ms=500,
            cost_usd=0.001,
        )
        domain_metrics = AgentMetrics(
            agent_id="domain",
            model="pplx-70b",
            input_tokens=200,
            output_tokens=100,
            time_ms=1000,
            cost_usd=0.002,
        )
        clarity_metrics = AgentMetrics(
            agent_id="clarity",
            model="claude-sonnet",
            input_tokens=150,
            output_tokens=75,
            time_ms=600,
            cost_usd=0.0015,
        )

        with patch("app.services.orchestrator.BriefingAgent") as MockBriefing, \
             patch("app.services.orchestrator.DomainPipeline") as MockDomain, \
             patch("app.services.orchestrator.ClarityAgent") as MockClarity, \
             patch("app.services.orchestrator.RigorFinder") as MockRigorFind, \
             patch("app.services.orchestrator.RigorRewriter") as MockRigorRewrite, \
             patch("app.services.orchestrator.AdversaryAgent") as MockAdversary, \
             patch("app.services.orchestrator.Assembler") as MockAssembler:

            MockBriefing.return_value.run = AsyncMock(
                return_value=(sample_briefing, briefing_metrics)
            )
            MockDomain.return_value.run = AsyncMock(
                return_value=(sample_evidence, [domain_metrics])
            )
            MockClarity.return_value.run = AsyncMock(
                return_value=([sample_finding], [clarity_metrics])
            )
            MockRigorFind.return_value.run = AsyncMock(return_value=([], []))
            MockRigorRewrite.return_value.run = AsyncMock(return_value=([], []))
            MockAdversary.return_value.run = AsyncMock(
                return_value=([], briefing_metrics)  # reuse for simplicity
            )
            MockAssembler.return_value.assemble = MagicMock(
                return_value=[sample_finding]
            )

            orchestrator = Orchestrator()
            result = await orchestrator.run(sample_doc, sample_config)

            # Metrics should be aggregated
            assert result.metrics.total_input_tokens >= 100  # At least briefing
            assert result.metrics.total_cost_usd > 0
            assert len(result.metrics.agent_metrics) > 0

    @pytest.mark.asyncio
    async def test_dev_banner_format(
        self, sample_doc, sample_config, sample_briefing, sample_evidence,
        sample_finding, sample_metrics
    ):
        """Metrics can be formatted for dev banner."""
        with patch("app.services.orchestrator.BriefingAgent") as MockBriefing, \
             patch("app.services.orchestrator.DomainPipeline") as MockDomain, \
             patch("app.services.orchestrator.ClarityAgent") as MockClarity, \
             patch("app.services.orchestrator.RigorFinder") as MockRigorFind, \
             patch("app.services.orchestrator.RigorRewriter") as MockRigorRewrite, \
             patch("app.services.orchestrator.AdversaryAgent") as MockAdversary, \
             patch("app.services.orchestrator.Assembler") as MockAssembler:

            MockBriefing.return_value.run = AsyncMock(
                return_value=(sample_briefing, sample_metrics)
            )
            MockDomain.return_value.run = AsyncMock(
                return_value=(sample_evidence, [sample_metrics])
            )
            MockClarity.return_value.run = AsyncMock(
                return_value=([sample_finding], [sample_metrics])
            )
            MockRigorFind.return_value.run = AsyncMock(return_value=([], [sample_metrics]))
            MockRigorRewrite.return_value.run = AsyncMock(return_value=([], []))
            MockAdversary.return_value.run = AsyncMock(return_value=([], sample_metrics))
            MockAssembler.return_value.assemble = MagicMock(
                return_value=[sample_finding]
            )

            orchestrator = Orchestrator()
            result = await orchestrator.run(sample_doc, sample_config)

            # Should be able to format for dev banner
            banner = result.metrics.to_dev_banner()
            assert "total" in banner
            assert "time_s" in banner["total"]
            assert "cost_usd" in banner["total"]
            assert "tokens" in banner["total"]


# ============================================================
# TEST: ERROR HANDLING
# ============================================================

class TestErrorHandling:
    """Tests that orchestrator handles agent failures gracefully."""

    @pytest.mark.asyncio
    async def test_handles_agent_failure(
        self, sample_doc, sample_config, sample_briefing, sample_evidence, sample_metrics
    ):
        """Orchestrator handles individual agent failures gracefully."""
        with patch("app.services.orchestrator.BriefingAgent") as MockBriefing, \
             patch("app.services.orchestrator.DomainPipeline") as MockDomain, \
             patch("app.services.orchestrator.ClarityAgent") as MockClarity, \
             patch("app.services.orchestrator.RigorFinder") as MockRigorFind, \
             patch("app.services.orchestrator.RigorRewriter") as MockRigorRewrite, \
             patch("app.services.orchestrator.AdversaryAgent") as MockAdversary, \
             patch("app.services.orchestrator.Assembler") as MockAssembler:

            MockBriefing.return_value.run = AsyncMock(
                return_value=(sample_briefing, sample_metrics)
            )
            MockDomain.return_value.run = AsyncMock(
                return_value=(sample_evidence, [sample_metrics])
            )
            # Clarity fails
            MockClarity.return_value.run = AsyncMock(
                side_effect=Exception("LLM API Error")
            )
            MockRigorFind.return_value.run = AsyncMock(return_value=([], [sample_metrics]))
            MockRigorRewrite.return_value.run = AsyncMock(return_value=([], []))
            MockAdversary.return_value.run = AsyncMock(return_value=([], sample_metrics))
            MockAssembler.return_value.assemble = MagicMock(return_value=[])

            orchestrator = Orchestrator()
            result = await orchestrator.run(sample_doc, sample_config)

            # Should still return a result (with error status or partial results)
            assert result is not None
            assert result.status in ["completed", "failed"]

    @pytest.mark.asyncio
    async def test_failed_job_has_error_message(
        self, sample_doc, sample_config
    ):
        """Failed job includes error message."""
        with patch("app.services.orchestrator.BriefingAgent") as MockBriefing:
            # Briefing fails - critical failure
            MockBriefing.return_value.run = AsyncMock(
                side_effect=Exception("Critical failure")
            )

            orchestrator = Orchestrator()
            result = await orchestrator.run(sample_doc, sample_config)

            # Should have error info
            assert result.status == "failed"
            assert result.error is not None
            assert "Critical failure" in result.error
