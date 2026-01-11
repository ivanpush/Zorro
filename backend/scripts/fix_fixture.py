#!/usr/bin/env python3
"""
Fix manuscript_pdf.json fixture to match DATA_CONTRACTS.md schema.

Transforms:
- Sections: add section_index, level
- Paragraphs: add paragraph_index
- Sentences: position -> sentence_index, add paragraph_id, start_char, end_char

Created: 2025-01-10
"""

import json
from pathlib import Path


def find_sentence_offsets(paragraph_text: str, sentence_text: str, search_start: int = 0) -> tuple[int, int]:
    """Find start_char and end_char for a sentence within paragraph text."""
    idx = paragraph_text.find(sentence_text, search_start)
    if idx != -1:
        return idx, idx + len(sentence_text)
    # Fallback
    return search_start, search_start + len(sentence_text)


def fix_fixture(input_path: Path, output_path: Path):
    """Transform fixture to match schema."""
    with open(input_path, 'r') as f:
        data = json.load(f)

    # Fix sections
    for idx, section in enumerate(data.get('sections', [])):
        section['section_index'] = idx
        if 'level' not in section:
            section['level'] = 1

    # Fix figures
    for idx, figure in enumerate(data.get('figures', [])):
        figure['figure_index'] = idx
        if 'extraction_method' not in figure:
            figure['extraction_method'] = 'unknown'

    # Fix paragraphs and sentences
    for para_idx, paragraph in enumerate(data.get('paragraphs', [])):
        paragraph['paragraph_index'] = para_idx
        para_id = paragraph['paragraph_id']
        para_text = paragraph.get('text', '')

        search_pos = 0
        for sent_idx, sentence in enumerate(paragraph.get('sentences', [])):
            sentence['paragraph_id'] = para_id

            if 'position' in sentence:
                sentence['sentence_index'] = sentence.pop('position')
            elif 'sentence_index' not in sentence:
                sentence['sentence_index'] = sent_idx

            sent_text = sentence.get('text', '')
            start_char, end_char = find_sentence_offsets(para_text, sent_text, search_pos)
            sentence['start_char'] = start_char
            sentence['end_char'] = end_char
            search_pos = end_char

    # Ensure metadata
    if 'metadata' not in data:
        data['metadata'] = {}
    meta = data['metadata']
    if 'word_count' not in meta:
        meta['word_count'] = data.get('meta', {}).get('word_count', 0)
    if 'character_count' not in meta:
        meta['character_count'] = 0
    if 'page_count' not in meta:
        meta['page_count'] = data.get('meta', {}).get('page_count')

    if 'created_at' not in data:
        data['created_at'] = '2025-01-10T00:00:00Z'

    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Fixed: {len(data.get('sections', []))} sections, {len(data.get('paragraphs', []))} paragraphs")


if __name__ == '__main__':
    base = Path(__file__).parent.parent.parent
    fix_fixture(
        base / 'frontend/public/fixtures/manuscript_pdf_backup.json',
        base / 'frontend/public/fixtures/manuscript_pdf.json'
    )
