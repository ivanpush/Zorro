"""Document models - The core immutable DocObj and related structures"""

from datetime import datetime
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    """For PDF export mapping"""
    x0: float
    y0: float
    x1: float
    y1: float
    page_number: int


class DocumentMetadata(BaseModel):
    """Document metadata extracted during parsing"""
    page_count: int | None = None
    word_count: int
    character_count: int
    author: str | None = None
    created_date: datetime | None = None
    modified_date: datetime | None = None


class Reference(BaseModel):
    """Bibliographic reference"""
    id: str  # e.g., "ref_001"
    index: int
    raw_text: str


class Sentence(BaseModel):
    """Individual sentence within a paragraph"""
    id: str  # e.g., "p_001_s_002"
    paragraph_id: str
    index: int  # Index within paragraph
    text: str
    start_char: int  # Character offset in paragraph
    end_char: int


class Paragraph(BaseModel):
    """The primary unit of text analysis"""
    id: str  # e.g., "p_001"
    section_id: str | None
    index: int  # Global paragraph index
    text: str  # Full paragraph text
    sentences: list[Sentence]

    # Export mapping for PDF
    bounding_box: BoundingBox | None = None
    page_number: int | None = None

    # Export mapping for DOCX
    xml_path: str | None = None  # XPath to <w:p> element


class Section(BaseModel):
    """Document section/heading structure"""
    id: str  # e.g., "sec_001"
    index: int  # 0-based order
    title: str | None  # May be null for untitled sections
    level: int  # Heading level (1-6)
    paragraph_ids: list[str]  # References to contained paragraphs


class Figure(BaseModel):
    """Figure/image in document"""
    id: str  # e.g., "fig_001"
    index: int
    caption: str | None
    caption_paragraph_id: str | None  # If caption is a separate paragraph

    # Location info
    page_number: int | None = None  # PDF
    after_paragraph_id: str | None = None  # Approximate position

    # Extraction metadata
    extraction_method: Literal["inline", "textbox", "float", "unknown"]
    bounding_box: BoundingBox | None = None


class DocObj(BaseModel):
    """
    The canonical, immutable, indexed representation of a parsed document.
    Once created, DocObj NEVER changes.
    All agents READ from it.
    All findings REFERENCE it by stable IDs.
    """
    id: str = Field(default_factory=lambda: str(uuid4()))
    filename: str
    type: Literal["pdf", "docx"]
    title: str

    sections: list[Section]
    paragraphs: list[Paragraph]
    figures: list[Figure]
    references: list[Reference]

    metadata: DocumentMetadata

    created_at: datetime = Field(default_factory=datetime.utcnow)