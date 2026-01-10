"""
Tests for Clarity Agent.
TDD Phase 8: Clarity Agent (Chunked)
"""

import pytest
from unittest.mock import AsyncMock, patch

from app.models import (
    DocObj, Paragraph, Section, Sentence, BriefingOutput,
    Finding, Anchor, AgentMetrics, ClarityChunk
)
from app.agents.clarity import ClarityAgent
from app.agents.base import BaseAgent
from app.services.chunker import chunk_for_clarity


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
                text="This is the first paragraph of the test document. It contains multiple sentences. Here is another sentence for testing purposes.",
                sentences=[
                    Sentence(
                        sentence_id="p_001_s_001",
                        paragraph_id="p_001",
                        sentence_index=0,
                        text="This is the first paragraph of the test document.",
                        start_char=0,
                        end_char=52,
                    ),
                    Sentence(
                        sentence_id="p_001_s_002",
                        paragraph_id="p_001",
                        sentence_index=1,
                        text="It contains multiple sentences.",
                        start_char=53,
                        end_char=84,
                    ),
                ],
            ),
            Paragraph(
                paragraph_id="p_002",
                section_id="sec_001",
                paragraph_index=1,
                text="This is the second paragraph with more content. We need sufficient text to create meaningful chunks.",
                sentences=[
                    Sentence(
                        sentence_id="p_002_s_001",
                        paragraph_id="p_002",
                        sentence_index=0,
                        text="This is the second paragraph with more content.",
                        start_char=0,
                        end_char=48,
                    ),
                ],
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
def mock_briefing() -> BriefingOutput:
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
def mock_finding() -> Finding:
    """Create a mock finding."""
    return Finding(
        agent_id="clarity",
        category="clarity_sentence",
        severity="minor",
        confidence=0.85,
        title="Unclear sentence structure",
        description="This sentence has unclear structure.",
        anchors=[
            Anchor(
                paragraph_id="p_001",
                sentence_id="p_001_s_001",
                quoted_text="This is the first paragraph of the test document.",
            )
        ],
    )


@pytest.fixture
def mock_metrics() -> AgentMetrics:
    """Create mock metrics."""
    return AgentMetrics(
        agent_id="clarity",
        model="claude-sonnet-4-20250514",
        input_tokens=100,
        output_tokens=50,
        time_ms=500.0,
        cost_usd=0.001,
        chunk_index=0,
        chunk_total=1,
    )


# ============================================================
# TEST: Agent ID
# ============================================================

class TestAgentId:
    """Tests for agent_id property."""

    def test_agent_id_returns_clarity(self):
        """ClarityAgent.agent_id should return 'clarity'."""
        agent = ClarityAgent()
        assert agent.agent_id == "clarity"

    def test_clarity_agent_is_base_agent(self):
        """ClarityAgent should be a subclass of BaseAgent."""
        agent = ClarityAgent()
        assert isinstance(agent, BaseAgent)


# ============================================================
# TEST: Document Chunking
# ============================================================

class TestDocumentChunking:
    """Tests for document chunking behavior."""

    @pytest.mark.asyncio
    async def test_run_chunks_document_using_chunk_for_clarity(self, sample_doc, mock_briefing, mock_finding, mock_metrics):
        """run() should chunk the document using chunk_for_clarity."""
        agent = ClarityAgent()

        # Spy on chunk_for_clarity
        with patch('app.agents.clarity.chunk_for_clarity', wraps=chunk_for_clarity) as mock_chunker:
            with patch.object(agent, 'client') as mock_client:
                mock_client.call = AsyncMock(return_value=([mock_finding], mock_metrics))

                await agent.run(sample_doc, mock_briefing)

                # Verify chunk_for_clarity was called with the document
                mock_chunker.assert_called_once_with(sample_doc)


# ============================================================
# TEST: Run Method Return Type
# ============================================================

class TestRunMethodReturnType:
    """Tests for the run() method return type."""

    @pytest.mark.asyncio
    async def test_run_returns_tuple(self, sample_doc, mock_briefing, mock_finding, mock_metrics):
        """run() should return a tuple of (list[Finding], list[AgentMetrics])."""
        agent = ClarityAgent()

        with patch.object(agent, 'client') as mock_client:
            mock_client.call = AsyncMock(return_value=([mock_finding], mock_metrics))

            result = await agent.run(sample_doc, mock_briefing)

            assert isinstance(result, tuple)
            assert len(result) == 2

    @pytest.mark.asyncio
    async def test_run_returns_list_of_findings(self, sample_doc, mock_briefing, mock_finding, mock_metrics):
        """run() should return list[Finding] as first element."""
        agent = ClarityAgent()

        with patch.object(agent, 'client') as mock_client:
            mock_client.call = AsyncMock(return_value=([mock_finding], mock_metrics))

            findings, _ = await agent.run(sample_doc, mock_briefing)

            assert isinstance(findings, list)
            assert all(isinstance(f, Finding) for f in findings)

    @pytest.mark.asyncio
    async def test_run_returns_list_of_metrics(self, sample_doc, mock_briefing, mock_finding, mock_metrics):
        """run() should return list[AgentMetrics] as second element."""
        agent = ClarityAgent()

        with patch.object(agent, 'client') as mock_client:
            mock_client.call = AsyncMock(return_value=([mock_finding], mock_metrics))

            _, metrics_list = await agent.run(sample_doc, mock_briefing)

            assert isinstance(metrics_list, list)
            assert all(isinstance(m, AgentMetrics) for m in metrics_list)


# ============================================================
# TEST: Finding Properties
# ============================================================

class TestFindingProperties:
    """Tests for finding properties."""

    @pytest.mark.asyncio
    async def test_all_findings_have_agent_id_clarity(self, sample_doc, mock_briefing, mock_finding, mock_metrics):
        """All findings should have agent_id='clarity'."""
        agent = ClarityAgent()

        with patch.object(agent, 'client') as mock_client:
            # Create multiple findings
            findings = [
                Finding(
                    agent_id="clarity",
                    category="clarity_sentence",
                    severity="minor",
                    title="Test 1",
                    description="Desc 1",
                    anchors=[Anchor(paragraph_id="p_001", quoted_text="text 1")],
                ),
                Finding(
                    agent_id="clarity",
                    category="clarity_paragraph",
                    severity="major",
                    title="Test 2",
                    description="Desc 2",
                    anchors=[Anchor(paragraph_id="p_002", quoted_text="text 2")],
                ),
            ]
            mock_client.call = AsyncMock(return_value=(findings, mock_metrics))

            result_findings, _ = await agent.run(sample_doc, mock_briefing)

            assert all(f.agent_id == "clarity" for f in result_findings)

    @pytest.mark.asyncio
    async def test_all_findings_have_clarity_category(self, sample_doc, mock_briefing, mock_finding, mock_metrics):
        """All findings should have category starting with 'clarity_'."""
        agent = ClarityAgent()

        with patch.object(agent, 'client') as mock_client:
            findings = [
                Finding(
                    agent_id="clarity",
                    category="clarity_sentence",
                    severity="minor",
                    title="Test 1",
                    description="Desc 1",
                    anchors=[Anchor(paragraph_id="p_001", quoted_text="text 1")],
                ),
                Finding(
                    agent_id="clarity",
                    category="clarity_paragraph",
                    severity="major",
                    title="Test 2",
                    description="Desc 2",
                    anchors=[Anchor(paragraph_id="p_002", quoted_text="text 2")],
                ),
                Finding(
                    agent_id="clarity",
                    category="clarity_flow",
                    severity="suggestion",
                    title="Test 3",
                    description="Desc 3",
                    anchors=[Anchor(paragraph_id="p_001", quoted_text="text 3")],
                ),
            ]
            mock_client.call = AsyncMock(return_value=(findings, mock_metrics))

            result_findings, _ = await agent.run(sample_doc, mock_briefing)

            assert all(f.category.startswith("clarity_") for f in result_findings)


# ============================================================
# TEST: Anchor Validation
# ============================================================

class TestAnchorValidation:
    """Tests for anchor validation."""

    @pytest.mark.asyncio
    async def test_all_findings_have_valid_anchors(self, sample_doc, mock_briefing, mock_finding, mock_metrics):
        """All findings should have at least one valid anchor."""
        agent = ClarityAgent()

        with patch.object(agent, 'client') as mock_client:
            mock_client.call = AsyncMock(return_value=([mock_finding], mock_metrics))

            findings, _ = await agent.run(sample_doc, mock_briefing)

            for finding in findings:
                assert len(finding.anchors) >= 1
                for anchor in finding.anchors:
                    assert isinstance(anchor, Anchor)
                    assert anchor.paragraph_id
                    assert anchor.quoted_text
                    assert len(anchor.quoted_text.strip()) > 0


# ============================================================
# TEST: Parallel Processing
# ============================================================

class TestParallelProcessing:
    """Tests for parallel chunk processing."""

    @pytest.mark.asyncio
    async def test_run_processes_multiple_chunks(self, sample_doc, mock_briefing, mock_finding, mock_metrics):
        """run() should process multiple chunks if document is large enough."""
        agent = ClarityAgent()

        # Create multiple findings from different chunks
        findings = [mock_finding, mock_finding]

        with patch.object(agent, 'client') as mock_client:
            mock_client.call = AsyncMock(return_value=(findings, mock_metrics))

            result_findings, metrics_list = await agent.run(sample_doc, mock_briefing)

            # Should merge findings from all chunks
            assert isinstance(result_findings, list)
            assert isinstance(metrics_list, list)


# ============================================================
# TEST: Steering Support
# ============================================================

class TestSteeringSupport:
    """Tests for optional steering memo support."""

    @pytest.mark.asyncio
    async def test_run_accepts_steering_memo(self, sample_doc, mock_briefing, mock_finding, mock_metrics):
        """run() should accept optional steering memo."""
        agent = ClarityAgent()

        with patch.object(agent, 'client') as mock_client:
            mock_client.call = AsyncMock(return_value=([mock_finding], mock_metrics))

            # Should not raise
            result = await agent.run(sample_doc, mock_briefing, steering="Focus on sentence clarity")

            assert result is not None

    @pytest.mark.asyncio
    async def test_run_accepts_none_steering(self, sample_doc, mock_briefing, mock_finding, mock_metrics):
        """run() should accept None as steering."""
        agent = ClarityAgent()

        with patch.object(agent, 'client') as mock_client:
            mock_client.call = AsyncMock(return_value=([mock_finding], mock_metrics))

            # Should not raise
            result = await agent.run(sample_doc, mock_briefing, steering=None)

            assert result is not None
