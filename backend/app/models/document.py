"""
Document structure models - immutable after parsing/loading.
All agents reference this structure via paragraph_id, sentence_id.
"""

from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field
import uuid


class BoundingBox(BaseModel):
    """For PDF export mapping - coordinates on page."""
    x0: float
    y0: float
    x1: float
    y1: float
    page_number: int


class Sentence(BaseModel):
    """Individual sentence within a paragraph."""
    sentence_id: str = Field(description="Format: p_XXX_s_YYY")
    paragraph_id: str
    sentence_index: int = Field(ge=0)
    text: str
    start_char: int = Field(ge=0)
    end_char: int = Field(ge=0)


class Paragraph(BaseModel):
    """Paragraph with sentence breakdown."""
    paragraph_id: str = Field(description="Format: p_XXX")
    section_id: str | None = None
    paragraph_index: int = Field(ge=0, default=0)
    text: str
    sentences: list[Sentence] = Field(default_factory=list)

    # Extra fields from fixtures (ignored but allowed)
    para_type: str | None = Field(None, exclude=True)
    metadata: dict | None = Field(None, exclude=True)

    # Export mapping for PDF
    bounding_box: BoundingBox | None = None
    page_number: int | None = None

    # Export mapping for DOCX
    xml_path: str | None = None


class Section(BaseModel):
    """Document section."""
    section_id: str = Field(description="Format: sec_XXX")
    section_index: int = Field(ge=0)
    section_title: str | None = None
    level: int = Field(ge=1, le=6, default=1)
    paragraph_ids: list[str] = Field(default_factory=list)


class Figure(BaseModel):
    """Figure/image in document."""
    figure_id: str = Field(description="Format: fig_XXX")
    figure_index: int = Field(ge=0)
    caption: str | None = None
    caption_paragraph_id: str | None = None

    # Location info
    page_number: int | None = None
    after_paragraph_id: str | None = None

    # Extraction metadata
    extraction_method: Literal["inline", "textbox", "float", "unknown"] = "unknown"
    bounding_box: BoundingBox | None = None


class Reference(BaseModel):
    """Bibliographic reference."""
    reference_id: str = Field(description="Format: ref_XXX")
    reference_index: int = Field(ge=0)
    raw_text: str


class DocumentMetadata(BaseModel):
    """Document-level metadata."""
    page_count: int | None = None
    word_count: int = 0
    character_count: int = 0
    author: str | None = None
    created_date: datetime | None = None
    modified_date: datetime | None = None


class DocObj(BaseModel):
    """
    Immutable document representation.
    All agents reference this structure.
    """
    document_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    type: Literal["pdf", "docx"]
    title: str = "Untitled Document"

    sections: list[Section] = Field(default_factory=list)
    paragraphs: list[Paragraph] = Field(default_factory=list)
    figures: list["Figure"] = Field(default_factory=list)
    references: list["Reference"] = Field(default_factory=list)

    metadata: DocumentMetadata = Field(default_factory=DocumentMetadata)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Extra fields from fixtures (ignored but allowed)
    authors: str | None = Field(None, exclude=True)
    affiliations: str | None = Field(None, exclude=True)
    tables: list | None = Field(None, exclude=True)
    issues: list | None = Field(None, exclude=True)
    document_type: str | None = Field(None, exclude=True)
    source_format: str | None = Field(None, exclude=True)
    meta: dict | None = Field(None, exclude=True)

    def get_paragraph(self, paragraph_id: str) -> Paragraph | None:
        return next((p for p in self.paragraphs if p.paragraph_id == paragraph_id), None)

    def get_paragraph_text(self, paragraph_id: str) -> str | None:
        p = self.get_paragraph(paragraph_id)
        return p.text if p else None

    def get_full_text(self) -> str:
        return "\n\n".join(p.text for p in self.paragraphs)

    def get_text_with_ids(self) -> str:
        return "\n\n".join(f"[{p.paragraph_id}] {p.text}" for p in self.paragraphs)

    def get_section_paragraphs(self, section_id: str) -> list[Paragraph]:
        return [p for p in self.paragraphs if p.section_id == section_id]

    def validate_anchor_text(self, paragraph_id: str, quoted_text: str) -> bool:
        text = self.get_paragraph_text(paragraph_id)
        return text is not None and quoted_text in text
