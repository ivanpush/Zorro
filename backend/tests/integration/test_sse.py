"""
Tests for SSE Streaming.

Tests:
- GET /review/{job_id}/stream returns SSE
- Events have correct format (data: {...}\n\n)
- PhaseStartedEvent, AgentCompletedEvent emitted
- ReviewCompletedEvent is final event
- ReviewCompletedEvent includes dev banner metrics
"""

import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.models import (
    ReviewJob, ReviewConfig, ReviewMetrics, AgentMetrics,
    Finding, Anchor,
    PhaseStartedEvent, AgentCompletedEvent, ReviewCompletedEvent,
)


# ============================================================
# FIXTURES
# ============================================================

@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(app)


@pytest.fixture
def sample_events():
    """Sample SSE events for testing."""
    return [
        PhaseStartedEvent(phase="briefing_domain"),
        AgentCompletedEvent(
            agent_id="briefing",
            findings_count=0,
            time_ms=500,
            cost_usd=0.001,
        ),
        AgentCompletedEvent(
            agent_id="clarity",
            findings_count=2,
            time_ms=1000,
            cost_usd=0.002,
        ),
        ReviewCompletedEvent(
            total_findings=2,
            metrics={
                "total": {"time_s": 1.5, "cost_usd": 0.003, "tokens": 500},
                "agents": {},
            },
        ),
    ]


# ============================================================
# TEST: SSE ENDPOINT
# ============================================================

class TestSSEEndpoint:
    """Tests for GET /review/{job_id}/stream endpoint."""

    def test_stream_returns_sse(self, client):
        """GET /review/{job_id}/stream returns SSE content type."""
        with patch("app.api.routes.review.stream_review_events") as mock_stream:
            async def mock_generator():
                yield PhaseStartedEvent(phase="briefing_domain")
                yield ReviewCompletedEvent(total_findings=0, metrics={})

            mock_stream.return_value = mock_generator()

            response = client.get("/review/job-123/stream")

            assert response.status_code == 200
            assert "text/event-stream" in response.headers.get("content-type", "")

    def test_events_have_correct_format(self, client):
        """Events have format: data: {...}\n\n"""
        with patch("app.api.routes.review.stream_review_events") as mock_stream:
            async def mock_generator():
                yield PhaseStartedEvent(phase="briefing_domain")

            mock_stream.return_value = mock_generator()

            response = client.get("/review/job-123/stream")

            content = response.text
            assert content.startswith("data: ")
            assert "\n\n" in content

    def test_events_are_valid_json(self, client):
        """Event data is valid JSON."""
        with patch("app.api.routes.review.stream_review_events") as mock_stream:
            async def mock_generator():
                yield PhaseStartedEvent(phase="briefing_domain")

            mock_stream.return_value = mock_generator()

            response = client.get("/review/job-123/stream")

            # Parse the SSE data
            for line in response.text.strip().split("\n\n"):
                if line.startswith("data: "):
                    json_str = line[6:]  # Remove "data: " prefix
                    data = json.loads(json_str)
                    assert "type" in data
                    assert data["type"] == "phase_started"


# ============================================================
# TEST: EVENT TYPES
# ============================================================

class TestEventTypes:
    """Tests that correct event types are emitted."""

    def test_phase_started_event(self, client):
        """PhaseStartedEvent is emitted."""
        with patch("app.api.routes.review.stream_review_events") as mock_stream:
            async def mock_generator():
                yield PhaseStartedEvent(phase="briefing_domain")
                yield ReviewCompletedEvent(total_findings=0, metrics={})

            mock_stream.return_value = mock_generator()

            response = client.get("/review/job-123/stream")

            events = self._parse_events(response.text)
            phase_events = [e for e in events if e.get("type") == "phase_started"]
            assert len(phase_events) >= 1
            assert phase_events[0]["phase"] == "briefing_domain"

    def test_agent_completed_event(self, client):
        """AgentCompletedEvent is emitted."""
        with patch("app.api.routes.review.stream_review_events") as mock_stream:
            async def mock_generator():
                yield AgentCompletedEvent(
                    agent_id="clarity",
                    findings_count=2,
                    time_ms=1000,
                    cost_usd=0.002,
                )
                yield ReviewCompletedEvent(total_findings=2, metrics={})

            mock_stream.return_value = mock_generator()

            response = client.get("/review/job-123/stream")

            events = self._parse_events(response.text)
            agent_events = [e for e in events if e.get("type") == "agent_completed"]
            assert len(agent_events) >= 1
            assert agent_events[0]["agent_id"] == "clarity"
            assert agent_events[0]["findings_count"] == 2

    def test_review_completed_is_final(self, client, sample_events):
        """ReviewCompletedEvent is the final event."""
        with patch("app.api.routes.review.stream_review_events") as mock_stream:
            async def mock_generator():
                for event in sample_events:
                    yield event

            mock_stream.return_value = mock_generator()

            response = client.get("/review/job-123/stream")

            events = self._parse_events(response.text)
            assert len(events) > 0
            assert events[-1]["type"] == "review_completed"

    def _parse_events(self, text: str) -> list[dict]:
        """Parse SSE text into list of event dicts."""
        events = []
        for line in text.strip().split("\n\n"):
            if line.startswith("data: "):
                json_str = line[6:]
                events.append(json.loads(json_str))
        return events


# ============================================================
# TEST: DEV BANNER METRICS IN FINAL EVENT
# ============================================================

class TestDevBannerInFinalEvent:
    """Tests that ReviewCompletedEvent includes dev banner metrics."""

    def test_final_event_has_metrics(self, client):
        """ReviewCompletedEvent includes metrics."""
        metrics = {
            "total": {"time_s": 2.5, "cost_usd": 0.005, "tokens": 1000},
            "agents": {"clarity": {"calls": 1, "time_ms": 1000}},
        }

        with patch("app.api.routes.review.stream_review_events") as mock_stream:
            async def mock_generator():
                yield ReviewCompletedEvent(total_findings=3, metrics=metrics)

            mock_stream.return_value = mock_generator()

            response = client.get("/review/job-123/stream")

            events = self._parse_events(response.text)
            final_event = events[-1]

            assert final_event["type"] == "review_completed"
            assert "metrics" in final_event
            assert final_event["metrics"]["total"]["time_s"] == 2.5
            assert final_event["metrics"]["total"]["cost_usd"] == 0.005

    def test_final_event_has_total_findings(self, client):
        """ReviewCompletedEvent includes total findings count."""
        with patch("app.api.routes.review.stream_review_events") as mock_stream:
            async def mock_generator():
                yield ReviewCompletedEvent(total_findings=5, metrics={})

            mock_stream.return_value = mock_generator()

            response = client.get("/review/job-123/stream")

            events = self._parse_events(response.text)
            final_event = events[-1]

            assert final_event["total_findings"] == 5

    def _parse_events(self, text: str) -> list[dict]:
        """Parse SSE text into list of event dicts."""
        events = []
        for line in text.strip().split("\n\n"):
            if line.startswith("data: "):
                json_str = line[6:]
                events.append(json.loads(json_str))
        return events
