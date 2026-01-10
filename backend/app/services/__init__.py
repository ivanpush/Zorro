"""ZORRO Services."""

from .chunker import (
    chunk_for_clarity,
    chunk_for_rigor,
    get_last_n_sentences,
    get_first_n_sentences,
)

__all__ = [
    "chunk_for_clarity",
    "chunk_for_rigor",
    "get_last_n_sentences",
    "get_first_n_sentences",
]
