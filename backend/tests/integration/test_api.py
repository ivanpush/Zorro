"""
Tests for API Endpoints.

Tests:
- POST /review/start returns job_id
- GET /review/{job_id}/result returns ReviewJob
- Result includes findings and metrics (dev banner)
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.models import (
    ReviewJob, ReviewConfig, ReviewMetrics, AgentMetrics,
    Finding, Anchor,
)


# ============================================================
# FIXTURES
# ============================================================

@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(app)


@pytest.fixture
def sample_review_job():
    """Sample completed review job."""
    finding = Finding(
        id="finding-001",
        agent_id="clarity",
        category="clarity_sentence",
        severity="minor",
        title="Test finding",
        description="Test description",
        anchors=[Anchor(paragraph_id="p_001", quoted_text="sample text")],
    )

    metrics = ReviewMetrics()
    metrics.add(AgentMetrics(
        agent_id="clarity",
        model="claude-sonnet",
        input_tokens=100,
        output_tokens=50,
        time_ms=500,
        cost_usd=0.001,
    ))

    return ReviewJob(
        id="job-123",
        document_id="doc-456",
        config=ReviewConfig(),
        status="completed",
        findings=[finding],
        metrics=metrics,
    )


# ============================================================
# TEST: POST /review/start
# ============================================================

class TestPostReviewStart:
    """Tests for POST /review/start endpoint."""

    def test_returns_job_id(self, client):
        """POST /review/start returns job_id."""
        with patch("app.api.routes.review.start_review_job") as mock_start:
            mock_start.return_value = "job-123"

            response = client.post(
                "/review/start",
                json={
                    "document_id": "doc-456",
                    "config": {
                        "panel_mode": False,
                        "enable_domain": True,
                    }
                }
            )

            assert response.status_code == 200
            data = response.json()
            assert "job_id" in data
            assert data["job_id"] == "job-123"

    def test_accepts_config_options(self, client):
        """POST /review/start accepts configuration options."""
        with patch("app.api.routes.review.start_review_job") as mock_start:
            mock_start.return_value = "job-456"

            response = client.post(
                "/review/start",
                json={
                    "document_id": "doc-789",
                    "config": {
                        "panel_mode": True,
                        "focus_chips": ["clarity", "rigor"],
                        "steering_memo": "Focus on methods",
                        "enable_domain": False,
                    }
                }
            )

            assert response.status_code == 200
            # Verify config was passed to start function
            call_args = mock_start.call_args
            assert call_args is not None

    def test_requires_document_id(self, client):
        """POST /review/start requires document_id."""
        response = client.post(
            "/review/start",
            json={"config": {}}
        )

        assert response.status_code == 422  # Validation error


# ============================================================
# TEST: GET /review/{job_id}/result
# ============================================================

class TestGetReviewResult:
    """Tests for GET /review/{job_id}/result endpoint."""

    def test_returns_review_job(self, client, sample_review_job):
        """GET /review/{job_id}/result returns ReviewJob."""
        with patch("app.api.routes.review.get_review_result") as mock_get:
            mock_get.return_value = sample_review_job

            response = client.get("/review/job-123/result")

            assert response.status_code == 200
            data = response.json()
            assert data["id"] == "job-123"
            assert data["document_id"] == "doc-456"
            assert data["status"] == "completed"

    def test_result_includes_findings(self, client, sample_review_job):
        """Result includes findings."""
        with patch("app.api.routes.review.get_review_result") as mock_get:
            mock_get.return_value = sample_review_job

            response = client.get("/review/job-123/result")

            assert response.status_code == 200
            data = response.json()
            assert "findings" in data
            assert len(data["findings"]) == 1
            assert data["findings"][0]["id"] == "finding-001"

    def test_result_includes_metrics(self, client, sample_review_job):
        """Result includes metrics for dev banner."""
        with patch("app.api.routes.review.get_review_result") as mock_get:
            mock_get.return_value = sample_review_job

            response = client.get("/review/job-123/result")

            assert response.status_code == 200
            data = response.json()
            assert "metrics" in data
            assert "total_cost_usd" in data["metrics"]
            assert "total_time_ms" in data["metrics"]

    def test_not_found_returns_404(self, client):
        """Non-existent job returns 404."""
        with patch("app.api.routes.review.get_review_result") as mock_get:
            mock_get.return_value = None

            response = client.get("/review/nonexistent/result")

            assert response.status_code == 404


# ============================================================
# TEST: DEV BANNER METRICS
# ============================================================

class TestDevBannerMetrics:
    """Tests for dev banner metrics in response."""

    def test_metrics_has_total_time(self, client, sample_review_job):
        """Metrics includes total time."""
        with patch("app.api.routes.review.get_review_result") as mock_get:
            mock_get.return_value = sample_review_job

            response = client.get("/review/job-123/result")

            data = response.json()
            assert data["metrics"]["total_time_ms"] == 500.0

    def test_metrics_has_total_cost(self, client, sample_review_job):
        """Metrics includes total cost."""
        with patch("app.api.routes.review.get_review_result") as mock_get:
            mock_get.return_value = sample_review_job

            response = client.get("/review/job-123/result")

            data = response.json()
            assert data["metrics"]["total_cost_usd"] == 0.001

    def test_metrics_has_token_counts(self, client, sample_review_job):
        """Metrics includes token counts."""
        with patch("app.api.routes.review.get_review_result") as mock_get:
            mock_get.return_value = sample_review_job

            response = client.get("/review/job-123/result")

            data = response.json()
            assert data["metrics"]["total_input_tokens"] == 100
            assert data["metrics"]["total_output_tokens"] == 50
