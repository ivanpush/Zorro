"""
Phase 1: Project Setup Tests

Tests for:
- FastAPI app exists
- Health endpoint returns {"status": "ok"}
- Settings loads correctly
"""

import pytest
from fastapi.testclient import TestClient


class TestFastAPIApp:
    """Tests for FastAPI application setup."""

    def test_app_exists(self):
        """FastAPI app should be importable."""
        from app.main import app
        assert app is not None

    def test_app_title(self):
        """App should have correct title."""
        from app.main import app
        assert app.title == "ZORRO API"


class TestHealthEndpoint:
    """Tests for health check endpoint."""

    def test_health_returns_ok(self):
        """GET /health should return {"status": "ok"}."""
        from app.main import app
        client = TestClient(app)
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


class TestSettings:
    """Tests for configuration settings."""

    def test_settings_loads(self):
        """Settings should be importable and instantiable."""
        from app.config.settings import Settings
        settings = Settings()
        assert settings is not None

    def test_settings_has_required_fields(self):
        """Settings should have required API key fields."""
        from app.config.settings import Settings
        settings = Settings()
        # These should exist (may be empty in test env)
        assert hasattr(settings, "anthropic_api_key")
        assert hasattr(settings, "perplexity_api_key")

    def test_settings_has_app_config(self):
        """Settings should have app configuration."""
        from app.config.settings import Settings
        settings = Settings()
        assert hasattr(settings, "debug")
        assert hasattr(settings, "log_level")
