"""
Tests for chunker service.
TDD Phase 4: Core Infrastructure
"""

import pytest
from app.models import DocObj, Paragraph, Section, Sentence, ContextOverlap, ClarityChunk, RigorChunk
from app.services.chunker import (
    chunk_for_clarity,
    chunk_for_rigor,
    get_last_n_sentences,
    get_first_n_sentences,
)


# ============================================================
# FIXTURES
# ============================================================

@pytest.fixture
def sample_paragraphs() -> list[Paragraph]:
    """Create sample paragraphs with sentences."""
    paras = []
    for i in range(10):
        sentences = [
            Sentence(
                sentence_id=f"p_{i:03d}_s_{j:03d}",
                paragraph_id=f"p_{i:03d}",
                sentence_index=j,
                text=f"Sentence {j+1} of paragraph {i+1}.",
                start_char=j * 30,
                end_char=(j + 1) * 30,
            )
            for j in range(3)
        ]
        paras.append(Paragraph(
            paragraph_id=f"p_{i:03d}",
            section_id=f"sec_{i // 3:03d}",
            paragraph_index=i,
            text=" ".join(s.text for s in sentences),
            sentences=sentences,
        ))
    return paras


@pytest.fixture
def sample_sections() -> list[Section]:
    """Create sections that group paragraphs."""
    return [
        Section(
            section_id="sec_000",
            section_index=0,
            section_title="Introduction",
            paragraph_ids=["p_000", "p_001", "p_002"],
        ),
        Section(
            section_id="sec_001",
            section_index=1,
            section_title="Methods",
            paragraph_ids=["p_003", "p_004", "p_005"],
        ),
        Section(
            section_id="sec_002",
            section_index=2,
            section_title="Results",
            paragraph_ids=["p_006", "p_007", "p_008"],
        ),
        Section(
            section_id="sec_003",
            section_index=3,
            section_title="Discussion",
            paragraph_ids=["p_009"],
        ),
    ]


@pytest.fixture
def sample_doc(sample_paragraphs, sample_sections) -> DocObj:
    """Create a sample document."""
    return DocObj(
        filename="test.pdf",
        type="pdf",
        title="Test Document",
        paragraphs=sample_paragraphs,
        sections=sample_sections,
    )


@pytest.fixture
def large_doc() -> DocObj:
    """Create a document with many words per paragraph for chunking tests."""
    paras = []
    for i in range(6):
        # ~250 words per paragraph
        text = " ".join([f"word{j}" for j in range(250)])
        sentences = [
            Sentence(
                sentence_id=f"p_{i:03d}_s_000",
                paragraph_id=f"p_{i:03d}",
                sentence_index=0,
                text=text[:100] + ".",
                start_char=0,
                end_char=100,
            ),
            Sentence(
                sentence_id=f"p_{i:03d}_s_001",
                paragraph_id=f"p_{i:03d}",
                sentence_index=1,
                text=text[100:200] + ".",
                start_char=100,
                end_char=200,
            ),
        ]
        paras.append(Paragraph(
            paragraph_id=f"p_{i:03d}",
            section_id=f"sec_{i // 2:03d}",
            paragraph_index=i,
            text=text,
            sentences=sentences,
        ))

    sections = [
        Section(
            section_id="sec_000",
            section_index=0,
            section_title="Section A",
            paragraph_ids=["p_000", "p_001"],
        ),
        Section(
            section_id="sec_001",
            section_index=1,
            section_title="Section B",
            paragraph_ids=["p_002", "p_003"],
        ),
        Section(
            section_id="sec_002",
            section_index=2,
            section_title="Section C",
            paragraph_ids=["p_004", "p_005"],
        ),
    ]

    return DocObj(
        filename="large.pdf",
        type="pdf",
        title="Large Document",
        paragraphs=paras,
        sections=sections,
    )


# ============================================================
# TEST: get_last_n_sentences
# ============================================================

class TestGetLastNSentences:
    """Tests for get_last_n_sentences helper."""

    def test_returns_context_overlap(self, sample_paragraphs):
        """Should return a ContextOverlap object."""
        result = get_last_n_sentences(sample_paragraphs, n=3)
        assert result is not None
        assert isinstance(result, ContextOverlap)

    def test_returns_correct_count(self, sample_paragraphs):
        """Should return exactly n sentences."""
        result = get_last_n_sentences(sample_paragraphs, n=3)
        assert result is not None
        assert len(result.sentences) == 3

    def test_returns_sentences_from_end(self, sample_paragraphs):
        """Should return sentences from the end of paragraphs."""
        result = get_last_n_sentences(sample_paragraphs[:1], n=3)
        assert result is not None
        # Last paragraph has 3 sentences, should get all 3
        assert "Sentence 3 of paragraph 1." in result.sentences

    def test_source_is_previous(self, sample_paragraphs):
        """Should set source to 'previous'."""
        result = get_last_n_sentences(sample_paragraphs, n=3)
        assert result is not None
        assert result.source == "previous"

    def test_empty_input_returns_none(self):
        """Should return None for empty input."""
        result = get_last_n_sentences([], n=3)
        assert result is None


# ============================================================
# TEST: get_first_n_sentences
# ============================================================

class TestGetFirstNSentences:
    """Tests for get_first_n_sentences helper."""

    def test_returns_context_overlap(self, sample_paragraphs):
        """Should return a ContextOverlap object."""
        result = get_first_n_sentences(sample_paragraphs, n=3)
        assert result is not None
        assert isinstance(result, ContextOverlap)

    def test_returns_correct_count(self, sample_paragraphs):
        """Should return exactly n sentences."""
        result = get_first_n_sentences(sample_paragraphs, n=3)
        assert result is not None
        assert len(result.sentences) == 3

    def test_returns_sentences_from_start(self, sample_paragraphs):
        """Should return sentences from the beginning of paragraphs."""
        result = get_first_n_sentences(sample_paragraphs[:1], n=3)
        assert result is not None
        # First paragraph has 3 sentences
        assert "Sentence 1 of paragraph 1." in result.sentences

    def test_source_is_next(self, sample_paragraphs):
        """Should set source to 'next'."""
        result = get_first_n_sentences(sample_paragraphs, n=3)
        assert result is not None
        assert result.source == "next"

    def test_empty_input_returns_none(self):
        """Should return None for empty input."""
        result = get_first_n_sentences([], n=3)
        assert result is None


# ============================================================
# TEST: chunk_for_clarity
# ============================================================

class TestChunkForClarity:
    """Tests for chunk_for_clarity function."""

    def test_creates_chunks(self, large_doc):
        """Should create ClarityChunk objects."""
        chunks = chunk_for_clarity(large_doc, target_words=500)
        assert len(chunks) > 0
        assert all(isinstance(c, ClarityChunk) for c in chunks)

    def test_chunks_have_correct_indices(self, large_doc):
        """Chunks should have sequential indices starting at 0."""
        chunks = chunk_for_clarity(large_doc, target_words=500)
        for i, chunk in enumerate(chunks):
            assert chunk.chunk_index == i

    def test_chunks_have_correct_total(self, large_doc):
        """All chunks should have the same chunk_total."""
        chunks = chunk_for_clarity(large_doc, target_words=500)
        total = len(chunks)
        for chunk in chunks:
            assert chunk.chunk_total == total

    def test_context_overlap_exists(self, large_doc):
        """Middle chunks should have context_before and context_after."""
        chunks = chunk_for_clarity(large_doc, target_words=500)
        if len(chunks) >= 3:
            middle = chunks[1]
            assert middle.context_before is not None or middle.context_after is not None

    def test_first_chunk_has_no_context_before(self, large_doc):
        """First chunk should not have context_before."""
        chunks = chunk_for_clarity(large_doc, target_words=500)
        assert chunks[0].context_before is None

    def test_last_chunk_has_no_context_after(self, large_doc):
        """Last chunk should not have context_after."""
        chunks = chunk_for_clarity(large_doc, target_words=500)
        assert chunks[-1].context_after is None

    def test_all_paragraphs_included(self, large_doc):
        """All document paragraphs should be in exactly one chunk."""
        chunks = chunk_for_clarity(large_doc, target_words=500)
        all_para_ids = []
        for chunk in chunks:
            all_para_ids.extend(chunk.paragraph_ids)

        doc_para_ids = [p.paragraph_id for p in large_doc.paragraphs]
        assert sorted(all_para_ids) == sorted(doc_para_ids)


# ============================================================
# TEST: chunk_for_rigor
# ============================================================

class TestChunkForRigor:
    """Tests for chunk_for_rigor function."""

    def test_creates_one_chunk_per_section(self, sample_doc):
        """Should create one RigorChunk per section."""
        chunks = chunk_for_rigor(sample_doc)
        # sample_doc has 4 sections
        assert len(chunks) == 4

    def test_creates_rigor_chunks(self, sample_doc):
        """Should create RigorChunk objects."""
        chunks = chunk_for_rigor(sample_doc)
        assert all(isinstance(c, RigorChunk) for c in chunks)

    def test_chunks_have_section_reference(self, sample_doc):
        """Each chunk should reference its section."""
        chunks = chunk_for_rigor(sample_doc)
        for chunk in chunks:
            assert chunk.section is not None
            assert chunk.section.section_id is not None

    def test_chunks_have_correct_indices(self, sample_doc):
        """Chunks should have sequential indices."""
        chunks = chunk_for_rigor(sample_doc)
        for i, chunk in enumerate(chunks):
            assert chunk.chunk_index == i

    def test_chunks_have_correct_total(self, sample_doc):
        """All chunks should have correct chunk_total."""
        chunks = chunk_for_rigor(sample_doc)
        total = len(chunks)
        for chunk in chunks:
            assert chunk.chunk_total == total

    def test_context_overlap_between_sections(self, sample_doc):
        """Middle sections should have context overlap from adjacent sections."""
        chunks = chunk_for_rigor(sample_doc)
        if len(chunks) >= 3:
            middle = chunks[1]
            # Should have context from previous section
            assert middle.context_before is not None
            # Should have context from next section
            assert middle.context_after is not None
