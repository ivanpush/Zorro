"""Chunking models for parallelized agents."""

from pydantic import BaseModel, Field
from app.models.document import Paragraph, Section


class ContextOverlap(BaseModel):
    """3-sentence context from adjacent chunks."""
    sentences: list[str] = Field(default_factory=list, max_length=3)
    source: str = Field(description="'previous' or 'next'")

    def format_for_prompt(self) -> str:
        if not self.sentences:
            return ""
        text = " ".join(self.sentences)
        return f"[CONTEXT ONLY - DO NOT CRITIQUE: {text}]"


class ClarityChunk(BaseModel):
    """Word-based chunk for Clarity agent."""
    chunk_index: int
    chunk_total: int
    paragraphs: list[Paragraph]
    paragraph_ids: list[str]
    word_count: int
    context_before: ContextOverlap | None = None
    context_after: ContextOverlap | None = None

    def get_text_with_ids(self) -> str:
        parts = []
        if self.context_before:
            parts.append(self.context_before.format_for_prompt())

        for p in self.paragraphs:
            parts.append(f"[{p.paragraph_id}] {p.text}")

        if self.context_after:
            parts.append(self.context_after.format_for_prompt())

        return "\n\n".join(parts)


class RigorChunk(BaseModel):
    """Section-based chunk for Rigor agent."""
    chunk_index: int
    chunk_total: int
    section: Section
    paragraphs: list[Paragraph]
    paragraph_ids: list[str]
    context_before: ContextOverlap | None = None
    context_after: ContextOverlap | None = None

    def get_text_with_ids(self) -> str:
        parts = []
        if self.context_before:
            parts.append(self.context_before.format_for_prompt())

        if self.section.section_title:
            parts.append(f"## {self.section.section_title}")

        for p in self.paragraphs:
            parts.append(f"[{p.paragraph_id}] {p.text}")

        if self.context_after:
            parts.append(self.context_after.format_for_prompt())

        return "\n\n".join(parts)
