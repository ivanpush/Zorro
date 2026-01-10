"""
Tests for Domain Pipeline agents.
TDD Phase 10: Domain Pipeline with 4-stage orchestration
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.models import (
    DocObj, Paragraph, Section,
    DomainTargets, SearchPriority,
    SearchQuery, QueryGeneratorOutput,
    SearchResult, SourceSnippet, SearchExecutorOutput,
    EvidencePack, AgentMetrics
)
from app.agents.domain import (
    TargetExtractor,
    QueryGenerator,
    SearchExecutor,
    EvidenceSynthesizer,
    DomainPipeline
)
from app.agents.base import BaseAgent


# ============================================================
# FIXTURES
# ============================================================

@pytest.fixture
def sample_doc() -> DocObj:
    """Create a sample document for testing."""
    return DocObj(
        filename="test_grant.pdf",
        type="pdf",
        title="Novel Approach to Cancer Treatment",
        paragraphs=[
            Paragraph(
                paragraph_id="p_001",
                section_id="sec_001",
                paragraph_index=0,
                text="We propose a randomized controlled trial to test our novel immunotherapy approach.",
                sentences=[],
            ),
            Paragraph(
                paragraph_id="p_002",
                section_id="sec_001",
                paragraph_index=1,
                text="Our preliminary data shows 80% response rate in cell culture models.",
                sentences=[],
            ),
        ],
        sections=[
            Section(
                section_id="sec_001",
                section_index=0,
                section_title="Study Design",
                paragraph_ids=["p_001", "p_002"],
            ),
        ],
    )


@pytest.fixture
def mock_domain_targets() -> DomainTargets:
    """Create mock domain targets."""
    return DomainTargets(
        document_type="grant_proposal",
        study_design="Randomized Controlled Trial",
        design_can_establish=["Treatment efficacy", "Safety profile"],
        design_cannot_establish=["Long-term outcomes", "Mechanism of action"],
        summary="This grant proposes an RCT for a novel immunotherapy approach.",
        search_priorities=[
            SearchPriority(
                search_for="RCT limitations in cancer immunotherapy",
                why_it_matters="Study design may not capture long-term effects",
                search_type="design_limitation"
            ),
            SearchPriority(
                search_for="Cell culture to clinical translation failures",
                why_it_matters="Preliminary data may not predict clinical success",
                search_type="contradiction"
            ),
        ],
        field="Oncology",
        subfield="Immunotherapy",
    )


@pytest.fixture
def mock_query_output() -> QueryGeneratorOutput:
    """Create mock query generator output."""
    return QueryGeneratorOutput(
        queries=[
            SearchQuery(
                query_id="q_001",
                query_text="What are the limitations of RCTs in cancer immunotherapy?",
                query_type="fact_check",
                rationale="Need to understand design constraints"
            ),
            SearchQuery(
                query_id="q_002",
                query_text="Cell culture vs clinical outcomes in immunotherapy",
                query_type="contradiction",
                rationale="Check if preliminary data predicts success"
            ),
        ]
    )


@pytest.fixture
def mock_search_results() -> tuple[list[SearchResult], list[SourceSnippet]]:
    """Create mock search results."""
    results = [
        SearchResult(
            query_id="q_001",
            response_text="RCTs in immunotherapy face challenges with long-term follow-up.",
            citations=["https://example.com/study1"]
        ),
        SearchResult(
            query_id="q_002",
            response_text="Many cell culture results fail to translate to clinical success.",
            citations=["https://example.com/study2"]
        ),
    ]
    snippets = [
        SourceSnippet(
            text="Long-term follow-up is challenging in immunotherapy trials.",
            url="https://example.com/study1",
            title="RCT Limitations",
            query_id="q_001"
        ),
        SourceSnippet(
            text="Translation from cell culture to clinical success is poor.",
            url="https://example.com/study2",
            title="Translation Challenges",
            query_id="q_002"
        ),
    ]
    return results, snippets


@pytest.fixture
def mock_evidence_pack() -> EvidencePack:
    """Create mock evidence pack."""
    return EvidencePack(
        queries_used=["What are the limitations of RCTs?"],
        query_rationale=["Need to understand design constraints"],
        design_limitations=["RCTs cannot establish long-term outcomes"],
        prior_work=["Smith 2022 showed similar approach"],
        contradictions=["Jones 2023 found different results"],
        field_consensus=["Consensus is that cell culture data is unreliable"],
        method_context=["This assay has known variability issues"],
        failed_attempts=["Phase II trial failed in 2021"],
        sources=[
            SourceSnippet(
                text="Study findings",
                url="https://example.com/study",
                query_id="q_001"
            )
        ],
        confidence="medium",
        gaps="No evidence found for mechanism validation"
    )


@pytest.fixture
def mock_metrics() -> AgentMetrics:
    """Create mock metrics."""
    return AgentMetrics(
        agent_id="domain_target_extractor",
        model="claude-sonnet-4-20250514",
        input_tokens=100,
        output_tokens=50,
        time_ms=500.0,
        cost_usd=0.001,
    )


# ============================================================
# TEST: TargetExtractor
# ============================================================

class TestTargetExtractor:
    """Tests for TargetExtractor agent."""

    def test_agent_id(self):
        """TargetExtractor.agent_id should return 'domain_target_extractor'."""
        agent = TargetExtractor()
        assert agent.agent_id == "domain_target_extractor"

    def test_is_base_agent(self):
        """TargetExtractor should be a subclass of BaseAgent."""
        agent = TargetExtractor()
        assert isinstance(agent, BaseAgent)

    @pytest.mark.asyncio
    async def test_run_returns_tuple(self, sample_doc, mock_domain_targets, mock_metrics):
        """run() should return tuple of (DomainTargets, AgentMetrics)."""
        agent = TargetExtractor()

        with patch.object(agent, 'client') as mock_client:
            mock_client.call = AsyncMock(return_value=(mock_domain_targets, mock_metrics))

            result = await agent.run(sample_doc)

            assert isinstance(result, tuple)
            assert len(result) == 2

    @pytest.mark.asyncio
    async def test_run_returns_domain_targets(self, sample_doc, mock_domain_targets, mock_metrics):
        """run() should return DomainTargets as first element."""
        agent = TargetExtractor()

        with patch.object(agent, 'client') as mock_client:
            mock_client.call = AsyncMock(return_value=(mock_domain_targets, mock_metrics))

            output, _ = await agent.run(sample_doc)

            assert isinstance(output, DomainTargets)
            assert output.study_design == "Randomized Controlled Trial"
            assert len(output.design_cannot_establish) > 0

    @pytest.mark.asyncio
    async def test_design_cannot_establish_populated(self, sample_doc, mock_domain_targets, mock_metrics):
        """DomainTargets.design_cannot_establish list should be populated."""
        agent = TargetExtractor()

        with patch.object(agent, 'client') as mock_client:
            mock_client.call = AsyncMock(return_value=(mock_domain_targets, mock_metrics))

            output, _ = await agent.run(sample_doc)

            assert len(output.design_cannot_establish) >= 1
            assert isinstance(output.design_cannot_establish[0], str)


# ============================================================
# TEST: QueryGenerator
# ============================================================

class TestQueryGenerator:
    """Tests for QueryGenerator agent."""

    def test_agent_id(self):
        """QueryGenerator.agent_id should return 'domain_query_generator'."""
        agent = QueryGenerator()
        assert agent.agent_id == "domain_query_generator"

    def test_is_base_agent(self):
        """QueryGenerator should be a subclass of BaseAgent."""
        agent = QueryGenerator()
        assert isinstance(agent, BaseAgent)

    @pytest.mark.asyncio
    async def test_run_returns_tuple(self, mock_domain_targets, mock_query_output, mock_metrics):
        """run() should return tuple of (QueryGeneratorOutput, AgentMetrics)."""
        agent = QueryGenerator()

        with patch.object(agent, 'client') as mock_client:
            mock_client.call = AsyncMock(return_value=(mock_query_output, mock_metrics))

            result = await agent.run(mock_domain_targets)

            assert isinstance(result, tuple)
            assert len(result) == 2

    @pytest.mark.asyncio
    async def test_run_returns_query_output(self, mock_domain_targets, mock_query_output, mock_metrics):
        """run() should return QueryGeneratorOutput with queries list."""
        agent = QueryGenerator()

        with patch.object(agent, 'client') as mock_client:
            mock_client.call = AsyncMock(return_value=(mock_query_output, mock_metrics))

            output, _ = await agent.run(mock_domain_targets)

            assert isinstance(output, QueryGeneratorOutput)
            assert len(output.queries) > 0
            assert isinstance(output.queries[0], SearchQuery)


# ============================================================
# TEST: SearchExecutor
# ============================================================

class TestSearchExecutor:
    """Tests for SearchExecutor agent."""

    def test_agent_id(self):
        """SearchExecutor.agent_id should return 'domain_search'."""
        agent = SearchExecutor()
        assert agent.agent_id == "domain_search"

    def test_is_base_agent(self):
        """SearchExecutor should be a subclass of BaseAgent."""
        agent = SearchExecutor()
        assert isinstance(agent, BaseAgent)

    @pytest.mark.asyncio
    async def test_run_returns_tuple(self, mock_query_output, mock_search_results):
        """run() should return tuple of ((list[SearchResult], list[SourceSnippet]), list[AgentMetrics])."""
        agent = SearchExecutor()
        results, snippets = mock_search_results

        # Mock the perplexity client
        with patch('app.agents.domain.search_executor.get_perplexity_client') as mock_get_client:
            mock_perplexity = MagicMock()
            mock_perplexity.search_batch = AsyncMock(return_value=(
                results,
                snippets,
                [AgentMetrics(
                    agent_id="domain_search",
                    model="sonar",
                    input_tokens=50,
                    output_tokens=100,
                    time_ms=300.0,
                    cost_usd=0.001
                )]
            ))
            mock_get_client.return_value = mock_perplexity

            result = await agent.run(mock_query_output)

            assert isinstance(result, tuple)
            assert len(result) == 2

    @pytest.mark.asyncio
    async def test_run_returns_search_results(self, mock_query_output, mock_search_results):
        """run() should return list[SearchResult] and list[SourceSnippet]."""
        agent = SearchExecutor()
        results, snippets = mock_search_results

        with patch('app.agents.domain.search_executor.get_perplexity_client') as mock_get_client:
            mock_perplexity = MagicMock()
            mock_perplexity.search_batch = AsyncMock(return_value=(
                results,
                snippets,
                [AgentMetrics(
                    agent_id="domain_search",
                    model="sonar",
                    input_tokens=50,
                    output_tokens=100,
                    time_ms=300.0,
                    cost_usd=0.001
                )]
            ))
            mock_get_client.return_value = mock_perplexity

            (result_list, snippet_list), metrics_list = await agent.run(mock_query_output)

            assert isinstance(result_list, list)
            assert isinstance(snippet_list, list)
            assert len(result_list) > 0
            assert isinstance(result_list[0], SearchResult)
            assert isinstance(snippet_list[0], SourceSnippet)

    @pytest.mark.asyncio
    async def test_perplexity_api_mocked(self, mock_query_output, mock_search_results):
        """Perplexity API should be properly mocked."""
        agent = SearchExecutor()
        results, snippets = mock_search_results

        with patch('app.agents.domain.search_executor.get_perplexity_client') as mock_get_client:
            mock_perplexity = MagicMock()
            mock_perplexity.search_batch = AsyncMock(return_value=(
                results,
                snippets,
                [AgentMetrics(
                    agent_id="domain_search",
                    model="sonar",
                    input_tokens=50,
                    output_tokens=100,
                    time_ms=300.0,
                    cost_usd=0.001
                )]
            ))
            mock_get_client.return_value = mock_perplexity

            await agent.run(mock_query_output)

            # Verify the perplexity client was called
            mock_perplexity.search_batch.assert_called_once()


# ============================================================
# TEST: EvidenceSynthesizer
# ============================================================

class TestEvidenceSynthesizer:
    """Tests for EvidenceSynthesizer agent."""

    def test_agent_id(self):
        """EvidenceSynthesizer.agent_id should return 'domain_evidence_synthesizer'."""
        agent = EvidenceSynthesizer()
        assert agent.agent_id == "domain_evidence_synthesizer"

    def test_is_base_agent(self):
        """EvidenceSynthesizer should be a subclass of BaseAgent."""
        agent = EvidenceSynthesizer()
        assert isinstance(agent, BaseAgent)

    @pytest.mark.asyncio
    async def test_run_returns_tuple(self, mock_domain_targets, mock_search_results, mock_evidence_pack, mock_metrics):
        """run() should return tuple of (EvidencePack, AgentMetrics)."""
        agent = EvidenceSynthesizer()
        results, snippets = mock_search_results

        with patch.object(agent, 'client') as mock_client:
            mock_client.call = AsyncMock(return_value=(mock_evidence_pack, mock_metrics))

            result = await agent.run(mock_domain_targets, results, snippets)

            assert isinstance(result, tuple)
            assert len(result) == 2

    @pytest.mark.asyncio
    async def test_run_returns_evidence_pack(self, mock_domain_targets, mock_search_results, mock_evidence_pack, mock_metrics):
        """run() should return EvidencePack as first element."""
        agent = EvidenceSynthesizer()
        results, snippets = mock_search_results

        with patch.object(agent, 'client') as mock_client:
            mock_client.call = AsyncMock(return_value=(mock_evidence_pack, mock_metrics))

            output, _ = await agent.run(mock_domain_targets, results, snippets)

            assert isinstance(output, EvidencePack)
            assert len(output.design_limitations) > 0 or output.has_content()


# ============================================================
# TEST: DomainPipeline
# ============================================================

class TestDomainPipeline:
    """Tests for DomainPipeline orchestrator."""

    def test_agent_id(self):
        """DomainPipeline.agent_id should return 'domain_pipeline'."""
        pipeline = DomainPipeline()
        assert pipeline.agent_id == "domain_pipeline"

    def test_is_base_agent(self):
        """DomainPipeline should be a subclass of BaseAgent."""
        pipeline = DomainPipeline()
        assert isinstance(pipeline, BaseAgent)

    @pytest.mark.asyncio
    async def test_run_orchestrates_all_stages(
        self,
        sample_doc,
        mock_domain_targets,
        mock_query_output,
        mock_search_results,
        mock_evidence_pack,
        mock_metrics
    ):
        """run() should orchestrate all 4 stages and return (EvidencePack, list[AgentMetrics])."""
        pipeline = DomainPipeline()
        results, snippets = mock_search_results

        # Mock each stage
        with patch('app.agents.domain.pipeline.TargetExtractor') as MockTargetExtractor, \
             patch('app.agents.domain.pipeline.QueryGenerator') as MockQueryGenerator, \
             patch('app.agents.domain.pipeline.SearchExecutor') as MockSearchExecutor, \
             patch('app.agents.domain.pipeline.EvidenceSynthesizer') as MockEvidenceSynthesizer:

            # Setup mocks
            mock_target_extractor = MockTargetExtractor.return_value
            mock_target_extractor.run = AsyncMock(return_value=(mock_domain_targets, mock_metrics))

            mock_query_generator = MockQueryGenerator.return_value
            mock_query_generator.run = AsyncMock(return_value=(mock_query_output, mock_metrics))

            mock_search_executor = MockSearchExecutor.return_value
            mock_search_executor.run = AsyncMock(return_value=((results, snippets), [mock_metrics]))

            mock_evidence_synthesizer = MockEvidenceSynthesizer.return_value
            mock_evidence_synthesizer.run = AsyncMock(return_value=(mock_evidence_pack, mock_metrics))

            # Run pipeline
            result = await pipeline.run(sample_doc)

            # Verify result structure
            assert isinstance(result, tuple)
            assert len(result) == 2

            evidence, metrics_list = result
            assert isinstance(evidence, EvidencePack)
            assert isinstance(metrics_list, list)
            assert len(metrics_list) > 0
            assert all(isinstance(m, AgentMetrics) for m in metrics_list)

            # Verify all stages were called
            mock_target_extractor.run.assert_called_once_with(sample_doc)
            mock_query_generator.run.assert_called_once_with(mock_domain_targets)
            mock_search_executor.run.assert_called_once_with(mock_query_output)
            mock_evidence_synthesizer.run.assert_called_once_with(mock_domain_targets, results, snippets)

    @pytest.mark.asyncio
    async def test_run_returns_evidence_pack_and_metrics(
        self,
        sample_doc,
        mock_domain_targets,
        mock_query_output,
        mock_search_results,
        mock_evidence_pack,
        mock_metrics
    ):
        """run() should return EvidencePack and list of AgentMetrics."""
        pipeline = DomainPipeline()
        results, snippets = mock_search_results

        with patch('app.agents.domain.pipeline.TargetExtractor') as MockTargetExtractor, \
             patch('app.agents.domain.pipeline.QueryGenerator') as MockQueryGenerator, \
             patch('app.agents.domain.pipeline.SearchExecutor') as MockSearchExecutor, \
             patch('app.agents.domain.pipeline.EvidenceSynthesizer') as MockEvidenceSynthesizer:

            mock_target_extractor = MockTargetExtractor.return_value
            mock_target_extractor.run = AsyncMock(return_value=(mock_domain_targets, mock_metrics))

            mock_query_generator = MockQueryGenerator.return_value
            mock_query_generator.run = AsyncMock(return_value=(mock_query_output, mock_metrics))

            mock_search_executor = MockSearchExecutor.return_value
            mock_search_executor.run = AsyncMock(return_value=((results, snippets), [mock_metrics]))

            mock_evidence_synthesizer = MockEvidenceSynthesizer.return_value
            mock_evidence_synthesizer.run = AsyncMock(return_value=(mock_evidence_pack, mock_metrics))

            evidence, metrics_list = await pipeline.run(sample_doc)

            # Verify evidence pack
            assert isinstance(evidence, EvidencePack)
            assert evidence.has_content() or evidence.confidence == "low"

            # Verify metrics
            assert isinstance(metrics_list, list)
            assert len(metrics_list) >= 4  # At least 4 stages
