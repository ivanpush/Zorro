"""Rigor agents - 2-phase pipeline for methodology/logic/evidence review."""

from .finder import RigorFinder
from .rewriter import RigorRewriter

__all__ = ["RigorFinder", "RigorRewriter"]
