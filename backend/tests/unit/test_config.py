"""
Phase 3: Global Config Tests

Tests for:
- All required agents have models mapped
- get_model() returns string
- get_model() unknown agent returns default
- calculate_cost() works and scales
- get_panel_models() returns 3 tuples
"""

import pytest


class TestAgentModels:
    """Tests for agent to model mappings."""

    def test_all_required_agents_mapped(self):
        """All required agents should have model mappings."""
        from app.config import AGENT_MODELS

        required_agents = [
            "briefing",
            "clarity",
            "rigor_find",
            "rigor_rewrite",
            "domain_target_extractor",
            "domain_query_generator",
            "domain_search",
            "domain_evidence_synthesizer",
            "adversary",
            "adversary_panel_claude",
            "adversary_panel_openai",
            "adversary_panel_google",
            "adversary_reconcile",
        ]

        for agent in required_agents:
            assert agent in AGENT_MODELS, f"Missing agent: {agent}"

    def test_all_mapped_models_have_costs(self):
        """All mapped models should have cost entries."""
        from app.config import AGENT_MODELS, MODEL_COSTS

        for agent, model in AGENT_MODELS.items():
            assert model in MODEL_COSTS, f"Model {model} for agent {agent} has no cost entry"


class TestGetModel:
    """Tests for get_model() function."""

    def test_get_model_returns_string(self):
        """get_model() should return a string."""
        from app.config import get_model

        model = get_model("briefing")
        assert isinstance(model, str)
        assert len(model) > 0

    def test_get_model_known_agent(self):
        """get_model() should return correct model for known agent."""
        from app.config import get_model

        model = get_model("adversary")
        assert "opus" in model.lower()

    def test_get_model_unknown_agent_returns_default(self):
        """get_model() should return default for unknown agent."""
        from app.config import get_model

        model = get_model("unknown_agent_xyz")
        assert isinstance(model, str)
        assert "sonnet" in model.lower()  # Default is sonnet


class TestCalculateCost:
    """Tests for calculate_cost() function."""

    def test_calculate_cost_works(self):
        """calculate_cost() should return a float."""
        from app.config import calculate_cost

        cost = calculate_cost("claude-sonnet-4-20250514", 1000, 500)
        assert isinstance(cost, float)
        assert cost > 0

    def test_calculate_cost_scales_with_tokens(self):
        """calculate_cost() should scale linearly with tokens."""
        from app.config import calculate_cost

        cost_1k = calculate_cost("claude-sonnet-4-20250514", 1000, 0)
        cost_2k = calculate_cost("claude-sonnet-4-20250514", 2000, 0)

        # 2x input tokens should be 2x cost
        assert abs(cost_2k - 2 * cost_1k) < 0.0001

    def test_calculate_cost_opus_more_expensive(self):
        """Opus should cost more than Sonnet."""
        from app.config import calculate_cost

        opus_cost = calculate_cost("claude-opus-4-20250514", 1000, 1000)
        sonnet_cost = calculate_cost("claude-sonnet-4-20250514", 1000, 1000)

        assert opus_cost > sonnet_cost

    def test_calculate_cost_unknown_model_uses_default(self):
        """Unknown model should use default pricing."""
        from app.config import calculate_cost

        cost = calculate_cost("unknown-model-xyz", 1000, 500)
        assert isinstance(cost, float)
        assert cost > 0


class TestGetPanelModels:
    """Tests for get_panel_models() function."""

    def test_get_panel_models_returns_3_tuples(self):
        """get_panel_models() should return exactly 3 tuples."""
        from app.config import get_panel_models

        panel = get_panel_models()
        assert isinstance(panel, list)
        assert len(panel) == 3

    def test_get_panel_models_tuple_structure(self):
        """Each panel item should be (agent_id, model) tuple."""
        from app.config import get_panel_models

        panel = get_panel_models()
        for item in panel:
            assert isinstance(item, tuple)
            assert len(item) == 2
            agent_id, model = item
            assert isinstance(agent_id, str)
            assert isinstance(model, str)

    def test_get_panel_models_includes_all_providers(self):
        """Panel should include Claude, OpenAI, and Google."""
        from app.config import get_panel_models

        panel = get_panel_models()
        agent_ids = [item[0] for item in panel]

        assert "adversary_panel_claude" in agent_ids
        assert "adversary_panel_openai" in agent_ids
        assert "adversary_panel_google" in agent_ids


class TestModelCost:
    """Tests for ModelCost structure."""

    def test_model_cost_has_input_output(self):
        """ModelCost should have input and output fields."""
        from app.config import MODEL_COSTS

        for model, cost in MODEL_COSTS.items():
            assert hasattr(cost, "input"), f"{model} missing input"
            assert hasattr(cost, "output"), f"{model} missing output"
            assert cost.input > 0
            assert cost.output > 0
