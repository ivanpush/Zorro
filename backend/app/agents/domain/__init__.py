"""
Domain pipeline agents.

4-stage pipeline for external evidence gathering:
1. TargetExtractor - identifies what to search for
2. QueryGenerator - generates search queries
3. SearchExecutor - executes searches via Perplexity
4. EvidenceSynthesizer - synthesizes evidence into EvidencePack
"""

from app.agents.domain.target_extractor import TargetExtractor
from app.agents.domain.query_generator import QueryGenerator
from app.agents.domain.search_executor import SearchExecutor
from app.agents.domain.evidence_synthesizer import EvidenceSynthesizer
from app.agents.domain.pipeline import DomainPipeline

__all__ = [
    "TargetExtractor",
    "QueryGenerator",
    "SearchExecutor",
    "EvidenceSynthesizer",
    "DomainPipeline",
]
