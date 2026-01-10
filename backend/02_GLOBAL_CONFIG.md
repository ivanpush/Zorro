# ZORRO Backend - Global Configuration

Central configuration for models, costs, and agents.

---

## app/config/settings.py

```python
"""Environment configuration."""

from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings from environment."""
    
    # API Keys
    ANTHROPIC_API_KEY: str
    OPENAI_API_KEY: str | None = None      # For panel mode
    GOOGLE_API_KEY: str | None = None       # For panel mode
    PERPLEXITY_API_KEY: str
    
    # App config
    LOG_LEVEL: str = "INFO"
    DEBUG: bool = False
    
    # Defaults
    DEFAULT_CHUNK_WORDS: int = 1200
    CONTEXT_OVERLAP_SENTENCES: int = 3
    
    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
```

---

## app/config/models.py

```python
"""
Central model registry and cost tracking.
ALL agent-to-model mappings live here. Single source of truth.
"""

from pydantic import BaseModel


class ModelCost(BaseModel):
    """Cost per 1M tokens in USD."""
    input: float
    output: float


# ============================================================
# MODEL COST REGISTRY
# ============================================================

MODEL_COSTS: dict[str, ModelCost] = {
    # Anthropic
    "claude-opus-4-20250514": ModelCost(input=15.0, output=75.0),
    "claude-sonnet-4-20250514": ModelCost(input=3.0, output=15.0),
    
    # OpenAI (placeholder - update when GPT-5 pricing known)
    "gpt-5": ModelCost(input=15.0, output=60.0),
    
    # Google (placeholder - update when Gemini 3 pricing known)
    "gemini-3-opus": ModelCost(input=12.5, output=50.0),
    
    # Perplexity
    "sonar": ModelCost(input=1.0, output=1.0),
    "sonar-pro": ModelCost(input=3.0, output=15.0),
}


# ============================================================
# AGENT TO MODEL MAPPING
# ============================================================

AGENT_MODELS: dict[str, str] = {
    # Briefing
    "briefing": "claude-sonnet-4-20250514",
    
    # Clarity (chunked, parallel)
    "clarity": "claude-sonnet-4-20250514",
    
    # Rigor (section-chunked, 2-phase)
    "rigor_find": "claude-sonnet-4-20250514",
    "rigor_rewrite": "claude-sonnet-4-20250514",
    
    # Domain pipeline (4 stages)
    "domain_target_extractor": "claude-sonnet-4-20250514",
    "domain_query_generator": "claude-sonnet-4-20250514",
    "domain_search": "sonar",
    "domain_evidence_synthesizer": "claude-sonnet-4-20250514",
    
    # Adversary (single model mode)
    "adversary": "claude-opus-4-20250514",
    
    # Adversary panel mode (3 frontier models)
    "adversary_panel_claude": "claude-opus-4-20250514",
    "adversary_panel_openai": "gpt-5",
    "adversary_panel_google": "gemini-3-opus",
    
    # Panel reconciliation
    "adversary_reconcile": "claude-sonnet-4-20250514",
}


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def get_model(agent_id: str) -> str:
    """Get model name for an agent."""
    return AGENT_MODELS.get(agent_id, "claude-sonnet-4-20250514")


def get_cost(model: str) -> ModelCost:
    """Get cost structure for a model."""
    return MODEL_COSTS.get(model, ModelCost(input=3.0, output=15.0))


def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Calculate USD cost for a call."""
    cost = get_cost(model)
    input_cost = (input_tokens / 1_000_000) * cost.input
    output_cost = (output_tokens / 1_000_000) * cost.output
    return input_cost + output_cost


def get_panel_models() -> list[tuple[str, str]]:
    """Get (agent_id, model) pairs for panel mode."""
    return [
        ("adversary_panel_claude", AGENT_MODELS["adversary_panel_claude"]),
        ("adversary_panel_openai", AGENT_MODELS["adversary_panel_openai"]),
        ("adversary_panel_google", AGENT_MODELS["adversary_panel_google"]),
    ]
```

---

## app/config/__init__.py

```python
"""Configuration module."""

from .settings import Settings, get_settings
from .models import (
    MODEL_COSTS, AGENT_MODELS,
    get_model, get_cost, calculate_cost, get_panel_models,
    ModelCost,
)

__all__ = [
    "Settings", "get_settings",
    "MODEL_COSTS", "AGENT_MODELS", "ModelCost",
    "get_model", "get_cost", "calculate_cost", "get_panel_models",
]
```

---

## .env.example

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...
PERPLEXITY_API_KEY=pplx-...

# Optional (for panel mode)
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...

# App
LOG_LEVEL=INFO
DEBUG=false
```
