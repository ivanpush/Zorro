# ZORRO Backend - TDD Test Specifications

Write tests FIRST, then implement.

---

## tests/conftest.py

```python
"""Shared test fixtures."""

import pytest
import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

from app.models import (
    DocObj, Paragraph, Section, Finding, Anchor, ProposedEdit,
    BriefingOutput, EvidencePack, ReviewConfig, AgentMetrics,
    ClarityChunk, RigorChunk, ContextOverlap
)


@pytest.fixture(scope="session")
def demo_doc() -> DocObj:
    path = Path(__file__).parent / "fixtures" / "demo_doc.json"
    with open(path) as f:
        return DocObj.model_validate(json.load(f))


@pytest.fixture
def sample_briefing() -> BriefingOutput:
    return BriefingOutput(
        summary="Study of cancer cell morphology responses to kinase inhibitors.",
        main_claims=["Morphology correlates with drug efficacy"],
        stated_scope="Adherent cancer cell lines",
        methodology_summary="High-content imaging",
        domain_keywords=["mechanobiology", "kinase"]
    )


@pytest.fixture
def sample_clarity_finding() -> Finding:
    return Finding(
        id="clarity_001", agent_id="clarity", category="clarity_sentence",
        severity="minor", title="Vague", description="Too vague",
        anchors=[Anchor(paragraph_id="p_003", quoted_text="Various factors")]
    )


@pytest.fixture
def sample_rigor_finding() -> Finding:
    return Finding(
        id="rigor_001", agent_id="rigor_find", category="rigor_methodology",
        severity="major", title="Missing control", description="No DMSO control",
        anchors=[Anchor(paragraph_id="p_007", quoted_text="treated with")],
        proposed_edit=ProposedEdit(
            type="suggestion",
            anchor=Anchor(paragraph_id="p_007", quoted_text="treated"),
            new_text="Add DMSO controls", rationale="Essential"
        )
    )


@pytest.fixture
def sample_adversary_finding() -> Finding:
    return Finding(
        id="adv_001", agent_id="adversary", category="adversarial_weakness",
        severity="critical", title="Correlation vs causation",
        description="Design only supports correlation",
        anchors=[Anchor(paragraph_id="p_012", quoted_text="result from")],
        votes=3
    )


@pytest.fixture
def overlapping_findings(sample_clarity_finding, sample_rigor_finding):
    rigor = sample_rigor_finding.model_copy(deep=True)
    rigor.anchors[0].paragraph_id = sample_clarity_finding.anchors[0].paragraph_id
    rigor.anchors[0].quoted_text = sample_clarity_finding.anchors[0].quoted_text
    return [sample_clarity_finding, rigor]


@pytest.fixture
def sample_evidence_pack() -> EvidencePack:
    return EvidencePack(
        queries_used=["kinase morphology"],
        design_limitations=["Cannot establish causation"],
        contradictions=["Jones 2023 found opposite"],
        confidence="medium", gaps="No replication studies"
    )


@pytest.fixture
def standard_config() -> ReviewConfig:
    return ReviewConfig(panel_mode=False)


@pytest.fixture
def panel_config() -> ReviewConfig:
    return ReviewConfig(panel_mode=True)


@pytest.fixture
def mock_metrics() -> AgentMetrics:
    return AgentMetrics(
        agent_id="test", model="claude-sonnet-4",
        input_tokens=1000, output_tokens=500,
        time_ms=1234.5, cost_usd=0.0105
    )
```

---

## tests/unit/test_models.py

```python
"""Unit tests for models."""

import pytest
from pydantic import ValidationError
from app.models import (
    DocObj, Finding, Anchor, BriefingOutput, EvidencePack,
    ReviewMetrics, AGENT_PRIORITY
)


class TestFinding:
    def test_create_valid(self):
        f = Finding(
            agent_id="clarity", category="clarity_sentence",
            severity="minor", title="Test", description="Desc",
            anchors=[Anchor(paragraph_id="p_001", quoted_text="text")]
        )
        assert f.id
    
    def test_requires_anchor(self):
        with pytest.raises(ValidationError):
            Finding(
                agent_id="clarity", category="clarity_sentence",
                severity="minor", title="T", description="D", anchors=[]
            )
    
    def test_camelcase_serialization(self, sample_clarity_finding):
        data = sample_clarity_finding.model_dump()
        assert "agentId" in data
        assert "agent_id" not in data
    
    def test_votes_serialized(self, sample_adversary_finding):
        data = sample_adversary_finding.model_dump()
        assert data["votes"] == 3


class TestEvidencePack:
    def test_empty(self):
        pack = EvidencePack.empty()
        assert not pack.has_content()
    
    def test_format_for_prompt(self, sample_evidence_pack):
        text = sample_evidence_pack.format_for_prompt()
        assert "DESIGN LIMITATIONS" in text


class TestReviewMetrics:
    def test_add_and_aggregate(self, mock_metrics):
        rm = ReviewMetrics()
        rm.add(mock_metrics)
        rm.add(mock_metrics)
        assert rm.total_cost_usd == mock_metrics.cost_usd * 2
    
    def test_dev_banner_format(self, mock_metrics):
        rm = ReviewMetrics()
        rm.add(mock_metrics)
        banner = rm.to_dev_banner()
        assert "total" in banner
        assert "agents" in banner
```

---

## tests/unit/test_assembler.py

```python
"""Unit tests for Assembler."""

import pytest
from app.models import Finding, Anchor
from app.services.assembler import Assembler


class TestAssembler:
    @pytest.fixture
    def assembler(self):
        return Assembler()
    
    def test_empty(self, assembler):
        assert assembler.assemble([]) == []
    
    def test_no_overlap(self, assembler, sample_clarity_finding, sample_rigor_finding):
        result = assembler.assemble([sample_clarity_finding, sample_rigor_finding])
        assert len(result) == 2
    
    def test_overlap_priority(self, assembler, overlapping_findings):
        result = assembler.assemble(overlapping_findings)
        assert len(result) == 1
        assert result[0].agent_id == "rigor_find"  # Higher priority
    
    def test_adversary_beats_all(self, assembler):
        clarity = Finding(
            agent_id="clarity", category="clarity_sentence",
            severity="minor", title="C", description="C",
            anchors=[Anchor(paragraph_id="p_001", quoted_text="same")]
        )
        adv = Finding(
            agent_id="adversary", category="adversarial_weakness",
            severity="critical", title="A", description="A",
            anchors=[Anchor(paragraph_id="p_001", quoted_text="same")]
        )
        result = assembler.assemble([clarity, adv])
        assert result[0].agent_id == "adversary"
    
    def test_presentation_order(self, assembler):
        adv = Finding(
            agent_id="adversary", category="adversarial_weakness",
            severity="critical", title="A", description="A",
            anchors=[Anchor(paragraph_id="p_001", quoted_text="t1")]
        )
        clarity = Finding(
            agent_id="clarity", category="clarity_sentence",
            severity="minor", title="C", description="C",
            anchors=[Anchor(paragraph_id="p_002", quoted_text="t2")]
        )
        result = assembler.assemble([adv, clarity])
        assert result[0].agent_id == "clarity"  # Clarity first in presentation
        assert result[1].agent_id == "adversary"
```

---

## tests/unit/test_chunker.py

```python
"""Unit tests for chunking."""

import pytest
from app.services.chunker import chunk_for_clarity, chunk_for_rigor


class TestClarityChunking:
    def test_creates_chunks(self, demo_doc):
        chunks = chunk_for_clarity(demo_doc, target_words=500)
        assert len(chunks) > 0
    
    def test_chunk_indices(self, demo_doc):
        chunks = chunk_for_clarity(demo_doc)
        for i, chunk in enumerate(chunks):
            assert chunk.chunk_index == i
            assert chunk.chunk_total == len(chunks)
    
    def test_context_overlap_exists(self, demo_doc):
        chunks = chunk_for_clarity(demo_doc, target_words=200)
        if len(chunks) > 2:
            middle = chunks[1]
            # Middle chunks should have context on both sides
            assert middle.context_before is not None or middle.context_after is not None


class TestRigorChunking:
    def test_one_chunk_per_section(self, demo_doc):
        chunks = chunk_for_rigor(demo_doc)
        sections_with_content = [
            s for s in demo_doc.sections 
            if demo_doc.get_section_paragraphs(s.section_id)
        ]
        assert len(chunks) == len(sections_with_content)
```

---

## tests/unit/test_config.py

```python
"""Tests for configuration."""

from app.config import get_model, calculate_cost, AGENT_MODELS, get_panel_models


class TestConfig:
    def test_required_agents_mapped(self):
        required = ["briefing", "clarity", "rigor_find", "adversary"]
        for agent in required:
            assert agent in AGENT_MODELS
    
    def test_cost_calculation(self):
        cost = calculate_cost("claude-sonnet-4-20250514", 1000, 500)
        assert 0 < cost < 1  # Should be cents
    
    def test_panel_models_count(self):
        assert len(get_panel_models()) == 3
```
