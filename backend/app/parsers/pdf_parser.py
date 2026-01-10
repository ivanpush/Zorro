"""PDF document parser using PyMuPDF (fitz)."""

import re
from datetime import datetime
from pathlib import Path
from uuid import uuid4

import fitz  # PyMuPDF
import structlog

from app.models.document import (
    BoundingBox,
    DocObj,
    DocumentMetadata,
    Figure,
    Paragraph,
    Reference,
    Section,
    Sentence,
)
from .base import BaseParser

logger = structlog.get_logger()


class PdfParser(BaseParser):
    """Parser for PDF documents using PyMuPDF."""

    def __init__(self):
        # Regex for sentence splitting
        self.sentence_splitter = re.compile(
            r'(?<=[.!?])\s+(?=[A-Z])|'  # Normal sentence end
            r'(?<=\w)\.\s*$'  # End of text
        )
        # Pattern for figure captions
        self.figure_pattern = re.compile(
            r'^(Figure|Fig\.?)\s+\d+[:\.]?\s*',
            re.IGNORECASE
        )
        # Pattern for references section
        self.references_pattern = re.compile(
            r'^(References?|Bibliography|Works?\s+Cited)',
            re.IGNORECASE
        )
        # Common section heading patterns
        self.section_patterns = [
            r'^(Abstract|ABSTRACT)',
            r'^(Introduction|INTRODUCTION)',
            r'^(Background|BACKGROUND)',
            r'^(Methods?|METHODS?|Methodology|METHODOLOGY)',
            r'^(Results?|RESULTS?)',
            r'^(Discussion|DISCUSSION)',
            r'^(Conclusion|CONCLUSION)',
            r'^(References?|REFERENCES?|Bibliography|BIBLIOGRAPHY)',
            r'^\d+\.?\s+[A-Z]',  # Numbered sections
            r'^[IVX]+\.\s+',  # Roman numerals
        ]

    async def parse(self, file_path: Path, title_override: str | None = None) -> DocObj:
        """Parse a PDF file into a DocObj."""
        logger.info("parsing_pdf", file_path=str(file_path))

        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        try:
            pdf = fitz.open(file_path)
        except Exception as e:
            raise ValueError(f"Failed to open PDF file: {e}")

        try:
            # Extract components
            text_blocks = self._extract_text_blocks(pdf)
            sections = self._detect_sections(text_blocks)
            paragraphs = self._extract_paragraphs(text_blocks, sections)
            figures = self._extract_figures(pdf, paragraphs)
            references = self._extract_references(paragraphs)
            metadata = self._extract_metadata(pdf, paragraphs)

            # Determine title
            title = title_override or self._extract_title(pdf, paragraphs)

            doc_obj = DocObj(
                document_id=str(uuid4()),
                filename=file_path.name,
                type="pdf",
                title=title,
                sections=sections,
                paragraphs=paragraphs,
                figures=figures,
                references=references,
                metadata=metadata,
                created_at=datetime.utcnow()
            )

            logger.info(
                "pdf_parsed",
                doc_id=doc_obj.document_id,
                pages=len(pdf),
                sections=len(sections),
                paragraphs=len(paragraphs),
                figures=len(figures),
                references=len(references)
            )

            return doc_obj
        finally:
            pdf.close()

    def _extract_text_blocks(self, pdf: fitz.Document) -> list[dict]:
        """Extract all text blocks with their properties."""
        text_blocks = []

        for page_num, page in enumerate(pdf):
            # Get text blocks with position information
            blocks = page.get_text("dict")

            for block in blocks.get("blocks", []):
                if block.get("type") == 0:  # Text block
                    for line in block.get("lines", []):
                        for span in line.get("spans", []):
                            text = span.get("text", "").strip()
                            if not text:
                                continue

                            # Calculate bounding box
                            bbox = span.get("bbox", [0, 0, 0, 0])

                            text_blocks.append({
                                "text": text,
                                "page": page_num,
                                "bbox": bbox,
                                "font_size": span.get("size", 12),
                                "font_flags": span.get("flags", 0),
                                "font": span.get("font", ""),
                            })

        # Sort by page and vertical position
        text_blocks.sort(key=lambda x: (x["page"], x["bbox"][1]))

        return text_blocks

    def _detect_sections(self, text_blocks: list[dict]) -> list[Section]:
        """Detect sections based on font size and pattern matching."""
        sections = []
        section_index = 0

        # Calculate average font size for body text
        font_sizes = [b["font_size"] for b in text_blocks if len(b["text"]) > 50]
        avg_font_size = sum(font_sizes) / len(font_sizes) if font_sizes else 12

        for i, block in enumerate(text_blocks):
            text = block["text"]
            font_size = block["font_size"]
            is_bold = block["font_flags"] & 2**4  # Check bold flag

            # Check if this is likely a heading
            is_heading = False

            # Method 1: Larger font size or bold
            if (font_size > avg_font_size * 1.2 or is_bold) and len(text) < 100:
                is_heading = True

            # Method 2: Pattern matching
            for pattern in self.section_patterns:
                if re.match(pattern, text, re.IGNORECASE):
                    is_heading = True
                    break

            if is_heading:
                # Determine heading level based on font size
                level = 1
                if font_size > avg_font_size * 1.5:
                    level = 1
                elif font_size > avg_font_size * 1.3:
                    level = 2
                elif font_size > avg_font_size * 1.1:
                    level = 3
                else:
                    level = 4

                sections.append(Section(
                    section_id=f"sec_{section_index:03d}",
                    section_index=section_index,
                    section_title=text,
                    level=level,
                    paragraph_ids=[]
                ))
                section_index += 1

        # If no sections found, create a default one
        if not sections:
            sections.append(Section(
                section_id="sec_000",
                section_index=0,
                section_title=None,
                level=1,
                paragraph_ids=[]
            ))

        return sections

    def _extract_paragraphs(
        self,
        text_blocks: list[dict],
        sections: list[Section]
    ) -> list[Paragraph]:
        """Group text blocks into paragraphs based on spatial proximity."""
        paragraphs = []
        para_index = 0
        current_section_idx = 0
        section_para_ids = []

        # Group text blocks by proximity
        current_paragraph = {
            "text": "",
            "page": None,
            "bbox": None,
            "blocks": []
        }

        for block in text_blocks:
            # Check if this block is a section heading
            is_section = any(
                block["text"] == sec.section_title
                for sec in sections
            )

            if is_section:
                # Save current paragraph if exists
                if current_paragraph["text"]:
                    para = self._create_paragraph(
                        current_paragraph,
                        para_index,
                        sections[current_section_idx].section_id if current_section_idx < len(sections) else None
                    )
                    paragraphs.append(para)
                    section_para_ids.append(para.paragraph_id)
                    para_index += 1
                    current_paragraph = {"text": "", "page": None, "bbox": None, "blocks": []}

                # Update section tracking
                if current_section_idx < len(sections):
                    sections[current_section_idx].paragraph_ids = section_para_ids
                    section_para_ids = []
                    current_section_idx += 1
                continue

            # Check if this block should start a new paragraph
            if current_paragraph["blocks"]:
                last_block = current_paragraph["blocks"][-1]

                # New paragraph if:
                # - Different page
                # - Large vertical gap (> 20 points)
                # - Large horizontal offset (indicates new column or indent)
                if (block["page"] != last_block["page"] or
                    block["bbox"][1] - last_block["bbox"][3] > 20 or
                    abs(block["bbox"][0] - last_block["bbox"][0]) > 50):

                    # Save current paragraph
                    if current_paragraph["text"]:
                        para = self._create_paragraph(
                            current_paragraph,
                            para_index,
                            sections[current_section_idx].section_id if current_section_idx < len(sections) else None
                        )
                        paragraphs.append(para)
                        section_para_ids.append(para.paragraph_id)
                        para_index += 1

                    # Start new paragraph
                    current_paragraph = {
                        "text": block["text"],
                        "page": block["page"],
                        "bbox": block["bbox"],
                        "blocks": [block]
                    }
                else:
                    # Append to current paragraph
                    current_paragraph["text"] += " " + block["text"]
                    current_paragraph["blocks"].append(block)
                    # Update bounding box to encompass all blocks
                    if current_paragraph["bbox"]:
                        current_paragraph["bbox"] = [
                            min(current_paragraph["bbox"][0], block["bbox"][0]),
                            min(current_paragraph["bbox"][1], block["bbox"][1]),
                            max(current_paragraph["bbox"][2], block["bbox"][2]),
                            max(current_paragraph["bbox"][3], block["bbox"][3]),
                        ]
            else:
                # First block of paragraph
                current_paragraph = {
                    "text": block["text"],
                    "page": block["page"],
                    "bbox": block["bbox"],
                    "blocks": [block]
                }

        # Add final paragraph
        if current_paragraph["text"]:
            para = self._create_paragraph(
                current_paragraph,
                para_index,
                sections[current_section_idx].section_id if current_section_idx < len(sections) else None
            )
            paragraphs.append(para)
            section_para_ids.append(para.paragraph_id)

        # Add remaining paragraphs to last section
        if current_section_idx < len(sections) and section_para_ids:
            sections[current_section_idx].paragraph_ids = section_para_ids

        return paragraphs

    def _create_paragraph(
        self,
        para_data: dict,
        index: int,
        section_id: str | None
    ) -> Paragraph:
        """Create a Paragraph object from grouped text blocks."""
        para_id = f"p_{index:03d}"
        text = para_data["text"].strip()

        # Split into sentences
        sentences = self._split_into_sentences(text, para_id)

        # Create bounding box
        bbox = None
        if para_data["bbox"]:
            bbox = BoundingBox(
                x0=para_data["bbox"][0],
                y0=para_data["bbox"][1],
                x1=para_data["bbox"][2],
                y1=para_data["bbox"][3],
                page_number=para_data["page"]
            )

        return Paragraph(
            paragraph_id=para_id,
            section_id=section_id,
            paragraph_index=index,
            text=text,
            sentences=sentences,
            bounding_box=bbox,
            page_number=para_data["page"]
        )

    def _split_into_sentences(self, text: str, para_id: str) -> list[Sentence]:
        """Split paragraph text into sentences with character offsets."""
        sentences = []

        if not text:
            return sentences

        parts = re.split(r'([.!?]+)\s+', text)

        current_pos = 0
        sentence_index = 0
        current_sentence = ""

        for i, part in enumerate(parts):
            if not part:
                continue

            if re.match(r'^[.!?]+$', part):
                current_sentence += part
                if i < len(parts) - 1:
                    sentence_text = current_sentence.strip()
                    if sentence_text:
                        sentences.append(Sentence(
                            sentence_id=f"{para_id}_s_{sentence_index:03d}",
                            paragraph_id=para_id,
                            sentence_index=sentence_index,
                            text=sentence_text,
                            start_char=current_pos,
                            end_char=current_pos + len(sentence_text)
                        ))
                        current_pos = text.find(parts[i + 1] if i + 1 < len(parts) else "", current_pos + len(sentence_text))
                        sentence_index += 1
                        current_sentence = ""
            else:
                if current_sentence and not current_sentence.endswith(' '):
                    current_sentence += ' '
                current_sentence += part

        # Add remaining text
        if current_sentence.strip():
            sentence_text = current_sentence.strip()
            sentences.append(Sentence(
                sentence_id=f"{para_id}_s_{sentence_index:03d}",
                paragraph_id=para_id,
                sentence_index=sentence_index,
                text=sentence_text,
                start_char=current_pos,
                end_char=len(text)
            ))

        # If no sentences, treat entire text as one
        if not sentences and text.strip():
            sentences.append(Sentence(
                sentence_id=f"{para_id}_s_000",
                paragraph_id=para_id,
                sentence_index=0,
                text=text,
                start_char=0,
                end_char=len(text)
            ))

        return sentences

    def _extract_figures(
        self,
        pdf: fitz.Document,
        paragraphs: list[Paragraph]
    ) -> list[Figure]:
        """Extract figures with captions from PDF."""
        figures = []
        fig_index = 0

        # Method 1: Find images on pages
        for page_num, page in enumerate(pdf):
            image_list = page.get_images(full=True)

            for img_index, img in enumerate(image_list):
                # Get image position
                xref = img[0]
                img_rect = page.get_image_bbox(img)

                if img_rect:
                    # Look for caption near the image
                    caption = None
                    caption_para_id = None

                    # Find paragraphs on the same page
                    page_paragraphs = [
                        p for p in paragraphs
                        if p.page_number == page_num
                    ]

                    # Check paragraphs near the image for captions
                    for para in page_paragraphs:
                        if self.figure_pattern.match(para.text):
                            # Check if paragraph is near the image
                            if para.bounding_box:
                                # Caption is usually below or above the image
                                vertical_distance = min(
                                    abs(para.bounding_box.y0 - img_rect.y1),
                                    abs(para.bounding_box.y1 - img_rect.y0)
                                )
                                if vertical_distance < 50:
                                    caption = para.text
                                    caption_para_id = para.paragraph_id
                                    break

                    figure = Figure(
                        figure_id=f"fig_{fig_index:03d}",
                        figure_index=fig_index,
                        caption=caption,
                        caption_paragraph_id=caption_para_id,
                        page_number=page_num,
                        after_paragraph_id=page_paragraphs[-1].paragraph_id if page_paragraphs else None,
                        extraction_method="inline",
                        bounding_box=BoundingBox(
                            x0=img_rect.x0,
                            y0=img_rect.y0,
                            x1=img_rect.x1,
                            y1=img_rect.y1,
                            page_number=page_num
                        )
                    )
                    figures.append(figure)
                    fig_index += 1

        # Method 2: Look for figure captions in text
        for para in paragraphs:
            if self.figure_pattern.match(para.text):
                # Check if we already have a figure for this caption
                existing = any(
                    f.caption_paragraph_id == para.paragraph_id
                    for f in figures
                )
                if not existing:
                    # Caption without associated image
                    figure = Figure(
                        figure_id=f"fig_{fig_index:03d}",
                        figure_index=fig_index,
                        caption=para.text,
                        caption_paragraph_id=para.paragraph_id,
                        page_number=para.page_number,
                        after_paragraph_id=paragraphs[para.paragraph_index - 1].paragraph_id if para.paragraph_index > 0 else None,
                        extraction_method="unknown"
                    )
                    figures.append(figure)
                    fig_index += 1

        return figures

    def _extract_references(self, paragraphs: list[Paragraph]) -> list[Reference]:
        """Extract references from bibliography section."""
        references = []
        ref_index = 0
        in_references = False

        for para in paragraphs:
            # Check if entering references section
            if self.references_pattern.match(para.text):
                in_references = True
                continue

            if in_references:
                if not para.text.strip():
                    continue

                # Each paragraph in references is a reference
                references.append(Reference(
                    reference_id=f"ref_{ref_index:03d}",
                    reference_index=ref_index,
                    raw_text=para.text
                ))
                ref_index += 1

        return references

    def _extract_metadata(
        self,
        pdf: fitz.Document,
        paragraphs: list[Paragraph]
    ) -> DocumentMetadata:
        """Extract document metadata."""
        # Word and character count
        total_text = ' '.join(p.text for p in paragraphs)
        word_count = len(total_text.split())
        character_count = len(total_text)

        # Page count
        page_count = len(pdf)

        # Try to get metadata from PDF
        metadata = pdf.metadata
        author = metadata.get("author", None)
        created_date = None
        modified_date = None

        # Try to parse dates
        if metadata.get("creationDate"):
            try:
                date_str = metadata["creationDate"]
                # PDF date format: D:YYYYMMDDHHmmSS
                if date_str.startswith("D:"):
                    date_str = date_str[2:]
                created_date = datetime.strptime(date_str[:14], "%Y%m%d%H%M%S")
            except Exception:
                pass

        if metadata.get("modDate"):
            try:
                date_str = metadata["modDate"]
                if date_str.startswith("D:"):
                    date_str = date_str[2:]
                modified_date = datetime.strptime(date_str[:14], "%Y%m%d%H%M%S")
            except Exception:
                pass

        return DocumentMetadata(
            page_count=page_count,
            word_count=word_count,
            character_count=character_count,
            author=author,
            created_date=created_date,
            modified_date=modified_date
        )

    def _extract_title(
        self,
        pdf: fitz.Document,
        paragraphs: list[Paragraph]
    ) -> str:
        """Extract or infer document title."""
        # Try PDF metadata
        metadata = pdf.metadata
        if metadata.get("title"):
            return metadata["title"]

        # Use first large text on first page
        if paragraphs:
            # Look for first paragraph with reasonable length
            for para in paragraphs[:5]:
                if 10 < len(para.text) < 200:
                    return para.text

        return "Untitled Document"


async def parse_pdf(file_path: Path, title_override: str | None = None) -> DocObj:
    """Convenience function to parse a PDF file."""
    parser = PdfParser()
    return await parser.parse(file_path, title_override)
