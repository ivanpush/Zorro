"""Export models for document generation"""

from enum import Enum

from pydantic import BaseModel, Field

from .review import Decision


class ExportFormat(str, Enum):
    """Supported export formats"""
    DOCX = "docx"
    PDF = "pdf"


class ExportOptions(BaseModel):
    """Options for document export"""
    include_unresolved_as_comments: bool = True
    track_changes_author: str = "ZORRO Review"


class ExportRequest(BaseModel):
    """Request to export a reviewed document"""
    document_id: str
    decisions: list[Decision]
    format: ExportFormat
    options: ExportOptions = Field(default_factory=ExportOptions)