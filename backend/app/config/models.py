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
    "claude-haiku-4-5-20251001": ModelCost(input=0.80, output=4.0),

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
    "briefing": "claude-haiku-4-5-20251001",

    # Clarity (chunked, parallel)
    "clarity": "claude-haiku-4-5-20251001",

    # Rigor (section-chunked, 2-phase)
    "rigor_find": "claude-haiku-4-5-20251001",
    "rigor_rewrite": "claude-haiku-4-5-20251001",

    # Domain pipeline (4 stages)
    "domain_target_extractor": "claude-haiku-4-5-20251001",
    "domain_query_generator": "claude-haiku-4-5-20251001",
    "domain_search": "sonar",
    "domain_evidence_synthesizer": "claude-haiku-4-5-20251001",

    # Adversary (single model mode)
    "adversary": "claude-haiku-4-5-20251001",

    # Adversary panel mode (3 frontier models)
    "adversary_panel_claude": "claude-haiku-4-5-20251001",
    "adversary_panel_openai": "gpt-5",
    "adversary_panel_google": "gemini-3-opus",

    # Panel reconciliation
    "adversary_reconcile": "claude-haiku-4-5-20251001",
}


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def get_model(agent_id: str) -> str:
    """Get model name for an agent."""
    return AGENT_MODELS.get(agent_id, "claude-haiku-4-5-20251001")


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
