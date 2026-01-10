"""
Tests for briefing agent.
TDD Phase 7: Base Agent + Briefing Agent
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.models import DocObj, Paragraph, Section, BriefingOutput, AgentMetrics
from app.agents.briefing import BriefingAgent
from app.agents.base import BaseAgent


# ============================================================
# FIXTURES
# ============================================================

@pytest.fixture
def sample_doc() -> DocObj:
    """Create a sample document for testing."""
    return DocObj(
        filename="test.pdf",
        type="pdf",
        title="Test Document",
        paragraphs=[
            Paragraph(
                paragraph_id="p_001",
                section_id="sec_001",
                paragraph_index=0,
                text="This is the first paragraph of the test document.",
                sentences=[],
            ),
            Paragraph(
                paragraph_id="p_002",
                section_id="sec_001",
                paragraph_index=1,
                text="This is the second paragraph with more content.",
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
def mock_briefing_output() -> BriefingOutput:
    """Create a mock briefing output."""
    return BriefingOutput(
        summary="This is a test document about testing.",
        main_claims=["Testing is important", "Tests should be written first"],
        stated_scope="Unit and integration testing",
        stated_limitations=["Only covers Python"],
        methodology_summary="TDD approach",
        domain_keywords=["testing", "python", "tdd"],
    )


@pytest.fixture
def mock_metrics() -> AgentMetrics:
    """Create mock metrics."""
    return AgentMetrics(
        agent_id="briefing",
        model="claude-sonnet-4-20250514",
        input_tokens=100,
        output_tokens=50,
        time_ms=500.0,
        cost_usd=0.001,
    )


# ============================================================
# TEST: Agent ID
# ============================================================

class TestAgentId:
    """Tests for agent_id property."""

    def test_agent_id_returns_briefing(self):
        """BriefingAgent.agent_id should return 'briefing'."""
        agent = BriefingAgent()
        assert agent.agent_id == "briefing"

    def test_briefing_agent_is_base_agent(self):
        """BriefingAgent should be a subclass of BaseAgent."""
        agent = BriefingAgent()
        assert isinstance(agent, BaseAgent)


# ============================================================
# TEST: Run Method
# ============================================================

class TestRunMethod:
    """Tests for the run() method."""

    @pytest.mark.asyncio
    async def test_run_returns_tuple(self, sample_doc, mock_briefing_output, mock_metrics):
        """run() should return a tuple of (BriefingOutput, AgentMetrics)."""
        agent = BriefingAgent()

        # Mock the LLM client
        with patch.object(agent, 'client') as mock_client:
            mock_client.call = AsyncMock(return_value=(mock_briefing_output, mock_metrics))

            result = await agent.run(sample_doc)

            assert isinstance(result, tuple)
            assert len(result) == 2

    @pytest.mark.asyncio
    async def test_run_returns_briefing_output(self, sample_doc, mock_briefing_output, mock_metrics):
        """run() should return BriefingOutput as first element."""
        agent = BriefingAgent()

        with patch.object(agent, 'client') as mock_client:
            mock_client.call = AsyncMock(return_value=(mock_briefing_output, mock_metrics))

            output, _ = await agent.run(sample_doc)

            assert isinstance(output, BriefingOutput)
            assert output.summary == mock_briefing_output.summary
            assert output.main_claims == mock_briefing_output.main_claims

    @pytest.mark.asyncio
    async def test_run_returns_agent_metrics(self, sample_doc, mock_briefing_output, mock_metrics):
        """run() should return AgentMetrics as second element."""
        agent = BriefingAgent()

        with patch.object(agent, 'client') as mock_client:
            mock_client.call = AsyncMock(return_value=(mock_briefing_output, mock_metrics))

            _, metrics = await agent.run(sample_doc)

            assert isinstance(metrics, AgentMetrics)


# ============================================================
# TEST: Metrics Agent ID
# ============================================================

class TestMetricsAgentId:
    """Tests for metrics agent_id."""

    @pytest.mark.asyncio
    async def test_metrics_has_correct_agent_id(self, sample_doc, mock_briefing_output, mock_metrics):
        """Metrics should have agent_id='briefing'."""
        agent = BriefingAgent()

        with patch.object(agent, 'client') as mock_client:
            mock_client.call = AsyncMock(return_value=(mock_briefing_output, mock_metrics))

            _, metrics = await agent.run(sample_doc)

            assert metrics.agent_id == "briefing"

    @pytest.mark.asyncio
    async def test_llm_client_called_with_correct_agent_id(self, sample_doc, mock_briefing_output, mock_metrics):
        """LLM client should be called with agent_id='briefing'."""
        agent = BriefingAgent()

        with patch.object(agent, 'client') as mock_client:
            mock_client.call = AsyncMock(return_value=(mock_briefing_output, mock_metrics))

            await agent.run(sample_doc)

            # Verify call was made with correct agent_id
            mock_client.call.assert_called_once()
            call_args = mock_client.call.call_args
            assert call_args.kwargs.get('agent_id') == "briefing" or call_args.args[0] == "briefing"


# ============================================================
# TEST: Steering Support
# ============================================================

class TestSteeringSupport:
    """Tests for optional steering memo support."""

    @pytest.mark.asyncio
    async def test_run_accepts_steering_memo(self, sample_doc, mock_briefing_output, mock_metrics):
        """run() should accept optional steering memo."""
        agent = BriefingAgent()

        with patch.object(agent, 'client') as mock_client:
            mock_client.call = AsyncMock(return_value=(mock_briefing_output, mock_metrics))

            # Should not raise
            result = await agent.run(sample_doc, steering="Focus on methodology")

            assert result is not None
