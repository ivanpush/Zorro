"""
Tests for rigor agents (Finder + Rewriter).
TDD Phase 9: Rigor Agents (Finder + Rewriter)
"""

import pytest
from unittest.mock import AsyncMock, patch

from app.models import (
    DocObj, Paragraph, Section, BriefingOutput, Finding, Anchor,
    ProposedEdit, AgentMetrics, RigorChunk
)
from app.agents.rigor import RigorFinder, RigorRewriter
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
        title="Test Research Document",
        paragraphs=[
            Paragraph(
                paragraph_id="p_001",
                section_id="sec_001",
                paragraph_index=0,
                text="This study examines the effects of X on Y.",
                sentences=[],
            ),
            Paragraph(
                paragraph_id="p_002",
                section_id="sec_001",
                paragraph_index=1,
                text="We used a sample size of 10 participants.",
                sentences=[],
            ),
            Paragraph(
                paragraph_id="p_003",
                section_id="sec_002",
                paragraph_index=2,
                text="Our results show a significant correlation.",
                sentences=[],
            ),
        ],
        sections=[
            Section(
                section_id="sec_001",
                section_index=0,
                section_title="Methods",
                paragraph_ids=["p_001", "p_002"],
            ),
            Section(
                section_id="sec_002",
                section_index=1,
                section_title="Results",
                paragraph_ids=["p_003"],
            ),
        ],
    )


@pytest.fixture
def sample_briefing() -> BriefingOutput:
    """Create a sample briefing output."""
    return BriefingOutput(
        summary="A research study examining effects of X on Y.",
        main_claims=["X affects Y significantly"],
        stated_scope="10 participants",
        methodology_summary="Quantitative study",
        domain_keywords=["research", "correlation"],
    )


@pytest.fixture
def sample_finding_without_edit() -> Finding:
    """Create a finding WITHOUT proposed_edit (from Finder)."""
    return Finding(
        id="find_001",
        agent_id="rigor_find",
        category="rigor_methodology",
        severity="major",
        confidence=0.85,
        title="Sample size too small",
        description="A sample of 10 participants is insufficient for statistical power.",
        anchors=[
            Anchor(
                paragraph_id="p_002",
                sentence_id=None,
                quoted_text="We used a sample size of 10 participants.",
            )
        ],
        proposed_edit=None,  # Finder doesn't create edits
    )


@pytest.fixture
def sample_finding_with_edit() -> Finding:
    """Create a finding WITH proposed_edit (from Rewriter)."""
    return Finding(
        id="find_001",
        agent_id="rigor_rewrite",
        category="rigor_methodology",
        severity="major",
        confidence=0.85,
        title="Sample size too small",
        description="A sample of 10 participants is insufficient for statistical power.",
        anchors=[
            Anchor(
                paragraph_id="p_002",
                sentence_id=None,
                quoted_text="We used a sample size of 10 participants.",
            )
        ],
        proposed_edit=ProposedEdit(
            type="replace",
            anchor=Anchor(
                paragraph_id="p_002",
                quoted_text="We used a sample size of 10 participants.",
            ),
            new_text="We used a sample size of 120 participants to ensure adequate statistical power.",
            rationale="Larger sample size increases statistical validity.",
        ),
    )


@pytest.fixture
def mock_metrics() -> AgentMetrics:
    """Create mock metrics."""
    return AgentMetrics(
        agent_id="rigor_find",
        model="claude-sonnet-4-20250514",
        input_tokens=200,
        output_tokens=150,
        time_ms=800.0,
        cost_usd=0.002,
        chunk_index=0,
        chunk_total=2,
    )


# ============================================================
# TEST: RigorFinder - Agent ID
# ============================================================

class TestRigorFinderAgentId:
    """Tests for RigorFinder agent_id property."""

    def test_agent_id_returns_rigor_find(self):
        """RigorFinder.agent_id should return 'rigor_find'."""
        agent = RigorFinder()
        assert agent.agent_id == "rigor_find"

    def test_rigor_finder_is_base_agent(self):
        """RigorFinder should be a subclass of BaseAgent."""
        agent = RigorFinder()
        assert isinstance(agent, BaseAgent)


# ============================================================
# TEST: RigorFinder - Run Method
# ============================================================

class TestRigorFinderRun:
    """Tests for RigorFinder.run() method."""

    @pytest.mark.asyncio
    async def test_run_returns_tuple(self, sample_doc, sample_briefing, sample_finding_without_edit, mock_metrics):
        """run() should return a tuple of (list[Finding], list[AgentMetrics])."""
        agent = RigorFinder()

        # Mock chunk_for_rigor to return 2 chunks
        with patch('app.agents.rigor.finder.chunk_for_rigor') as mock_chunker:
            mock_chunker.return_value = [
                RigorChunk(
                    chunk_index=0,
                    chunk_total=2,
                    section=sample_doc.sections[0],
                    paragraphs=sample_doc.paragraphs[:2],
                    paragraph_ids=["p_001", "p_002"],
                ),
                RigorChunk(
                    chunk_index=1,
                    chunk_total=2,
                    section=sample_doc.sections[1],
                    paragraphs=sample_doc.paragraphs[2:],
                    paragraph_ids=["p_003"],
                ),
            ]

            # Mock LLM client
            with patch.object(agent, 'client') as mock_client:
                mock_client.call = AsyncMock(return_value=([sample_finding_without_edit], mock_metrics))

                result = await agent.run(sample_doc, sample_briefing)

                assert isinstance(result, tuple)
                assert len(result) == 2

    @pytest.mark.asyncio
    async def test_run_returns_list_of_findings(self, sample_doc, sample_briefing, sample_finding_without_edit, mock_metrics):
        """run() should return list[Finding] as first element."""
        agent = RigorFinder()

        with patch('app.agents.rigor.finder.chunk_for_rigor') as mock_chunker:
            mock_chunker.return_value = [
                RigorChunk(
                    chunk_index=0,
                    chunk_total=1,
                    section=sample_doc.sections[0],
                    paragraphs=sample_doc.paragraphs,
                    paragraph_ids=["p_001", "p_002", "p_003"],
                ),
            ]

            with patch.object(agent, 'client') as mock_client:
                mock_client.call = AsyncMock(return_value=([sample_finding_without_edit], mock_metrics))

                findings, _ = await agent.run(sample_doc, sample_briefing)

                assert isinstance(findings, list)
                assert len(findings) > 0
                assert all(isinstance(f, Finding) for f in findings)

    @pytest.mark.asyncio
    async def test_run_returns_list_of_metrics(self, sample_doc, sample_briefing, sample_finding_without_edit, mock_metrics):
        """run() should return list[AgentMetrics] as second element."""
        agent = RigorFinder()

        with patch('app.agents.rigor.finder.chunk_for_rigor') as mock_chunker:
            mock_chunker.return_value = [
                RigorChunk(
                    chunk_index=0,
                    chunk_total=1,
                    section=sample_doc.sections[0],
                    paragraphs=sample_doc.paragraphs,
                    paragraph_ids=["p_001", "p_002", "p_003"],
                ),
            ]

            with patch.object(agent, 'client') as mock_client:
                mock_client.call = AsyncMock(return_value=([sample_finding_without_edit], mock_metrics))

                _, metrics = await agent.run(sample_doc, sample_briefing)

                assert isinstance(metrics, list)
                assert all(isinstance(m, AgentMetrics) for m in metrics)

    @pytest.mark.asyncio
    async def test_findings_have_no_proposed_edit(self, sample_doc, sample_briefing, sample_finding_without_edit, mock_metrics):
        """Findings from Finder should NOT have proposed_edit (finder just finds issues)."""
        agent = RigorFinder()

        with patch('app.agents.rigor.finder.chunk_for_rigor') as mock_chunker:
            mock_chunker.return_value = [
                RigorChunk(
                    chunk_index=0,
                    chunk_total=1,
                    section=sample_doc.sections[0],
                    paragraphs=sample_doc.paragraphs,
                    paragraph_ids=["p_001", "p_002", "p_003"],
                ),
            ]

            with patch.object(agent, 'client') as mock_client:
                mock_client.call = AsyncMock(return_value=([sample_finding_without_edit], mock_metrics))

                findings, _ = await agent.run(sample_doc, sample_briefing)

                for finding in findings:
                    assert finding.proposed_edit is None

    @pytest.mark.asyncio
    async def test_chunks_by_section(self, sample_doc, sample_briefing, sample_finding_without_edit, mock_metrics):
        """run() should use chunk_for_rigor to chunk by section."""
        agent = RigorFinder()

        with patch('app.agents.rigor.finder.chunk_for_rigor') as mock_chunker:
            mock_chunker.return_value = [
                RigorChunk(
                    chunk_index=0,
                    chunk_total=2,
                    section=sample_doc.sections[0],
                    paragraphs=sample_doc.paragraphs[:2],
                    paragraph_ids=["p_001", "p_002"],
                ),
                RigorChunk(
                    chunk_index=1,
                    chunk_total=2,
                    section=sample_doc.sections[1],
                    paragraphs=sample_doc.paragraphs[2:],
                    paragraph_ids=["p_003"],
                ),
            ]

            with patch.object(agent, 'client') as mock_client:
                mock_client.call = AsyncMock(return_value=([sample_finding_without_edit], mock_metrics))

                await agent.run(sample_doc, sample_briefing)

                # Verify chunk_for_rigor was called with doc
                mock_chunker.assert_called_once_with(sample_doc)


# ============================================================
# TEST: RigorRewriter - Agent ID
# ============================================================

class TestRigorRewriterAgentId:
    """Tests for RigorRewriter agent_id property."""

    def test_agent_id_returns_rigor_rewrite(self):
        """RigorRewriter.agent_id should return 'rigor_rewrite'."""
        agent = RigorRewriter()
        assert agent.agent_id == "rigor_rewrite"

    def test_rigor_rewriter_is_base_agent(self):
        """RigorRewriter should be a subclass of BaseAgent."""
        agent = RigorRewriter()
        assert isinstance(agent, BaseAgent)


# ============================================================
# TEST: RigorRewriter - Run Method
# ============================================================

class TestRigorRewriterRun:
    """Tests for RigorRewriter.run() method."""

    @pytest.mark.asyncio
    async def test_run_takes_findings_as_input(self, sample_doc, sample_finding_without_edit, sample_finding_with_edit, mock_metrics):
        """run() should take findings from Finder as input."""
        agent = RigorRewriter()

        with patch.object(agent, 'client') as mock_client:
            # Return finding with edit
            rewrite_metrics = AgentMetrics(
                agent_id="rigor_rewrite",
                model="claude-sonnet-4-20250514",
                input_tokens=150,
                output_tokens=100,
                time_ms=600.0,
                cost_usd=0.0015,
            )
            mock_client.call = AsyncMock(return_value=([sample_finding_with_edit], rewrite_metrics))

            # Should accept list of findings
            result = await agent.run([sample_finding_without_edit], sample_doc)

            assert result is not None

    @pytest.mark.asyncio
    async def test_run_returns_tuple(self, sample_doc, sample_finding_without_edit, sample_finding_with_edit, mock_metrics):
        """run() should return a tuple of (list[Finding], list[AgentMetrics])."""
        agent = RigorRewriter()

        with patch.object(agent, 'client') as mock_client:
            rewrite_metrics = AgentMetrics(
                agent_id="rigor_rewrite",
                model="claude-sonnet-4-20250514",
                input_tokens=150,
                output_tokens=100,
                time_ms=600.0,
                cost_usd=0.0015,
            )
            mock_client.call = AsyncMock(return_value=([sample_finding_with_edit], rewrite_metrics))

            result = await agent.run([sample_finding_without_edit], sample_doc)

            assert isinstance(result, tuple)
            assert len(result) == 2

    @pytest.mark.asyncio
    async def test_run_returns_findings_with_edits(self, sample_doc, sample_finding_without_edit, sample_finding_with_edit, mock_metrics):
        """run() should return findings with proposed_edit populated."""
        agent = RigorRewriter()

        with patch.object(agent, 'client') as mock_client:
            rewrite_metrics = AgentMetrics(
                agent_id="rigor_rewrite",
                model="claude-sonnet-4-20250514",
                input_tokens=150,
                output_tokens=100,
                time_ms=600.0,
                cost_usd=0.0015,
            )
            mock_client.call = AsyncMock(return_value=([sample_finding_with_edit], rewrite_metrics))

            findings, _ = await agent.run([sample_finding_without_edit], sample_doc)

            assert isinstance(findings, list)
            # All findings should have proposed_edit
            for finding in findings:
                assert finding.proposed_edit is not None

    @pytest.mark.asyncio
    async def test_run_returns_list_of_metrics(self, sample_doc, sample_finding_without_edit, sample_finding_with_edit, mock_metrics):
        """run() should return list[AgentMetrics] as second element."""
        agent = RigorRewriter()

        with patch.object(agent, 'client') as mock_client:
            rewrite_metrics = AgentMetrics(
                agent_id="rigor_rewrite",
                model="claude-sonnet-4-20250514",
                input_tokens=150,
                output_tokens=100,
                time_ms=600.0,
                cost_usd=0.0015,
            )
            mock_client.call = AsyncMock(return_value=([sample_finding_with_edit], rewrite_metrics))

            _, metrics = await agent.run([sample_finding_without_edit], sample_doc)

            assert isinstance(metrics, list)
            assert all(isinstance(m, AgentMetrics) for m in metrics)
