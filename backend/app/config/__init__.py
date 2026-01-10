"""Configuration module."""

from functools import lru_cache
from .settings import Settings
from .models import (
    MODEL_COSTS, AGENT_MODELS,
    get_model, get_cost, calculate_cost, get_panel_models,
    ModelCost,
)


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


__all__ = [
    "Settings",
    "get_settings",
    "MODEL_COSTS", "AGENT_MODELS", "ModelCost",
    "get_model", "get_cost", "calculate_cost", "get_panel_models",
]
