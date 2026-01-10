"""
Document chunking for parallelized agents.
"""

from app.models import DocObj, Paragraph, Section, ClarityChunk, RigorChunk, ContextOverlap
from app.config import get_settings


def get_last_n_sentences(paragraphs: list[Paragraph], n: int = 3) -> ContextOverlap | None:
    """Extract last n sentences from a list of paragraphs."""
    if not paragraphs:
        return None

    sentences = []
    for para in reversed(paragraphs):
        if para.sentences:
            for sent in reversed(para.sentences):
                sentences.insert(0, sent.text)
                if len(sentences) >= n:
                    break
        else:
            # No sentence breakdown - use whole paragraph text
            # Split on periods as fallback
            parts = para.text.split('. ')
            for part in reversed(parts):
                if part.strip():
                    sentences.insert(0, part.strip() + ('.' if not part.endswith('.') else ''))
                    if len(sentences) >= n:
                        break
        if len(sentences) >= n:
            break

    if not sentences:
        return None

    return ContextOverlap(sentences=sentences[:n], source="previous")


def get_first_n_sentences(paragraphs: list[Paragraph], n: int = 3) -> ContextOverlap | None:
    """Extract first n sentences from a list of paragraphs."""
    if not paragraphs:
        return None

    sentences = []
    for para in paragraphs:
        if para.sentences:
            for sent in para.sentences:
                sentences.append(sent.text)
                if len(sentences) >= n:
                    break
        else:
            # Fallback
            parts = para.text.split('. ')
            for part in parts:
                if part.strip():
                    sentences.append(part.strip() + ('.' if not part.endswith('.') else ''))
                    if len(sentences) >= n:
                        break
        if len(sentences) >= n:
            break

    if not sentences:
        return None

    return ContextOverlap(sentences=sentences[:n], source="next")


def chunk_for_clarity(
    doc: DocObj,
    target_words: int | None = None
) -> list[ClarityChunk]:
    """
    Chunk document by word count for Clarity agent.
    Respects paragraph boundaries.
    Includes 3-sentence context overlap.
    """
    settings = get_settings()
    target = target_words or settings.DEFAULT_CHUNK_WORDS
    n_context = settings.CONTEXT_OVERLAP_SENTENCES

    chunks: list[ClarityChunk] = []
    current_paras: list[Paragraph] = []
    current_words = 0

    for para in doc.paragraphs:
        para_words = len(para.text.split())

        # If adding this paragraph exceeds target and we have content, finalize chunk
        if current_words + para_words > target and current_paras:
            chunks.append(_build_clarity_chunk(
                paragraphs=current_paras,
                all_paragraphs=doc.paragraphs,
                chunk_index=len(chunks),
                n_context=n_context,
            ))
            current_paras = []
            current_words = 0

        current_paras.append(para)
        current_words += para_words

    # Don't forget last chunk
    if current_paras:
        chunks.append(_build_clarity_chunk(
            paragraphs=current_paras,
            all_paragraphs=doc.paragraphs,
            chunk_index=len(chunks),
            n_context=n_context,
        ))

    # Set total count
    for chunk in chunks:
        chunk.chunk_total = len(chunks)

    return chunks


def _build_clarity_chunk(
    paragraphs: list[Paragraph],
    all_paragraphs: list[Paragraph],
    chunk_index: int,
    n_context: int,
) -> ClarityChunk:
    """Build a ClarityChunk with context overlap."""
    first_idx = all_paragraphs.index(paragraphs[0])
    last_idx = all_paragraphs.index(paragraphs[-1])

    # Get context before (from previous paragraphs)
    context_before = get_last_n_sentences(all_paragraphs[:first_idx], n=n_context)

    # Get context after (from following paragraphs)
    context_after = get_first_n_sentences(all_paragraphs[last_idx + 1:], n=n_context)

    return ClarityChunk(
        chunk_index=chunk_index,
        chunk_total=0,  # Set later
        paragraphs=paragraphs,
        paragraph_ids=[p.paragraph_id for p in paragraphs],
        word_count=sum(len(p.text.split()) for p in paragraphs),
        context_before=context_before,
        context_after=context_after,
    )


def chunk_for_rigor(doc: DocObj) -> list[RigorChunk]:
    """
    Chunk document by section for Rigor agent.
    Each section becomes one chunk with context overlap.
    """
    settings = get_settings()
    n_context = settings.CONTEXT_OVERLAP_SENTENCES

    chunks: list[RigorChunk] = []

    for section in doc.sections:
        section_paras = doc.get_section_paragraphs(section.section_id)

        if not section_paras:
            continue

        section_idx = doc.sections.index(section)

        # Get context from adjacent sections
        context_before = None
        if section_idx > 0:
            prev_section = doc.sections[section_idx - 1]
            prev_paras = doc.get_section_paragraphs(prev_section.section_id)
            context_before = get_last_n_sentences(prev_paras, n=n_context)

        context_after = None
        if section_idx < len(doc.sections) - 1:
            next_section = doc.sections[section_idx + 1]
            next_paras = doc.get_section_paragraphs(next_section.section_id)
            context_after = get_first_n_sentences(next_paras, n=n_context)

        chunks.append(RigorChunk(
            chunk_index=len(chunks),
            chunk_total=0,  # Set later
            section=section,
            paragraphs=section_paras,
            paragraph_ids=[p.paragraph_id for p in section_paras],
            context_before=context_before,
            context_after=context_after,
        ))

    # Set total count
    for chunk in chunks:
        chunk.chunk_total = len(chunks)

    return chunks
