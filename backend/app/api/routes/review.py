"""
Review API Routes.

Endpoints:
- POST /review/start - Start a new review job
- GET /review/{job_id}/result - Get review results
- GET /review/{job_id}/stream - Stream SSE events
"""

from typing import AsyncGenerator
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import uuid

from app.models import (
    ReviewConfig, ReviewJob,
    SSEEvent, PhaseStartedEvent, ReviewCompletedEvent,
)


router = APIRouter(prefix="/review", tags=["review"])


# In-memory job store (replace with Redis/DB in production)
_jobs: dict[str, ReviewJob] = {}


# ============================================================
# REQUEST/RESPONSE MODELS
# ============================================================

class StartReviewRequest(BaseModel):
    """Request to start a review."""
    document_id: str
    config: ReviewConfig = Field(default_factory=ReviewConfig)


class StartReviewResponse(BaseModel):
    """Response from starting a review."""
    job_id: str


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def start_review_job(document_id: str, config: ReviewConfig) -> str:
    """
    Start a review job.

    Creates job entry and kicks off background processing.
    Returns job_id.
    """
    job_id = str(uuid.uuid4())

    job = ReviewJob(
        id=job_id,
        document_id=document_id,
        config=config,
        status="pending",
    )

    _jobs[job_id] = job

    return job_id


def get_review_result(job_id: str) -> ReviewJob | None:
    """
    Get review result by job_id.

    Returns None if job not found.
    """
    return _jobs.get(job_id)


async def stream_review_events(job_id: str) -> AsyncGenerator[SSEEvent, None]:
    """
    Stream review events for a job.

    Yields SSE events as the review progresses.
    This is a placeholder - actual implementation would
    integrate with the orchestrator to emit real events.
    """
    # Default implementation yields a completed event
    yield ReviewCompletedEvent(total_findings=0, metrics={})


# ============================================================
# ENDPOINTS
# ============================================================

@router.post("/start", response_model=StartReviewResponse)
async def post_start_review(request: StartReviewRequest) -> StartReviewResponse:
    """
    Start a new review job.

    Returns job_id that can be used to poll for results.
    """
    job_id = start_review_job(request.document_id, request.config)
    return StartReviewResponse(job_id=job_id)


@router.get("/{job_id}/result")
async def get_result(job_id: str):
    """
    Get review results.

    Returns ReviewJob with findings and metrics.
    """
    job = get_review_result(job_id)

    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    return job


@router.get("/{job_id}/stream")
async def stream_events(job_id: str):
    """
    Stream SSE events for a review job.

    Returns Server-Sent Events as the review progresses.
    """
    async def event_generator():
        async for event in stream_review_events(job_id):
            yield event.to_sse()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
