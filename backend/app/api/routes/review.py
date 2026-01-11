"""
Review API Routes.

Endpoints:
- POST /review/demo/start - Start review with pre-parsed DocObj (for demo/testing)
- POST /review/start - Start a new review job
- GET /review/{job_id}/result - Get review results
- GET /review/{job_id}/stream - Stream SSE events
"""

import asyncio
from typing import AsyncGenerator
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import uuid

from app.models import (
    DocObj, ReviewConfig, ReviewJob, Finding,
    SSEEvent, ReviewCompletedEvent, FindingDiscoveredEvent,
)
from app.services.orchestrator import Orchestrator


router = APIRouter(prefix="/review", tags=["review"])


# In-memory stores (replace with Redis/DB in production)
_jobs: dict[str, ReviewJob] = {}
_documents: dict[str, DocObj] = {}
_job_findings: dict[str, list[Finding]] = {}  # Accumulate findings as discovered

# Shared orchestrator instance
_orchestrator = Orchestrator()


# ============================================================
# REQUEST/RESPONSE MODELS
# ============================================================

class StartReviewRequest(BaseModel):
    """Request to start a review with document_id."""
    document_id: str
    config: ReviewConfig = Field(default_factory=ReviewConfig)


class DemoStartRequest(BaseModel):
    """Request to start a demo review with full DocObj."""
    document: DocObj
    config: ReviewConfig = Field(default_factory=ReviewConfig)


class StartReviewResponse(BaseModel):
    """Response from starting a review."""
    job_id: str


# ============================================================
# ENDPOINTS
# ============================================================

@router.post("/demo/start", response_model=StartReviewResponse)
async def start_demo_review(request: DemoStartRequest) -> StartReviewResponse:
    """
    Start a review with a pre-parsed DocObj.

    Used for demo mode where frontend has already parsed the document
    or is using fixture data.
    """
    doc = request.document
    config = request.config

    # Store document
    doc_id = doc.document_id or str(uuid.uuid4())
    _documents[doc_id] = doc

    # Create job
    job_id = str(uuid.uuid4())
    job = ReviewJob(
        id=job_id,
        document_id=doc_id,
        config=config,
        status="pending",
    )
    _jobs[job_id] = job
    _job_findings[job_id] = []

    return StartReviewResponse(job_id=job_id)


@router.post("/start", response_model=StartReviewResponse)
async def post_start_review(request: StartReviewRequest) -> StartReviewResponse:
    """
    Start a new review job with an existing document_id.

    Document must have been previously uploaded and parsed.
    """
    doc_id = request.document_id
    config = request.config

    # Check document exists
    if doc_id not in _documents:
        raise HTTPException(status_code=404, detail="Document not found")

    # Create job
    job_id = str(uuid.uuid4())
    job = ReviewJob(
        id=job_id,
        document_id=doc_id,
        config=config,
        status="pending",
    )
    _jobs[job_id] = job
    _job_findings[job_id] = []

    return StartReviewResponse(job_id=job_id)


@router.get("/{job_id}/result")
async def get_result(job_id: str):
    """
    Get review results.

    Returns ReviewJob with findings and metrics.
    """
    job = _jobs.get(job_id)

    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    # Include accumulated findings
    job.findings = _job_findings.get(job_id, [])

    return job


@router.get("/{job_id}/stream")
async def stream_events(job_id: str):
    """
    Stream SSE events for a review job.

    Runs the orchestrator and streams events in real-time.
    """
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    doc = _documents.get(job.document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    async def event_generator():
        # Update job status
        job.status = "running"

        try:
            async for event in _orchestrator.run(doc, job.config):
                # Accumulate findings as they're discovered
                if isinstance(event, FindingDiscoveredEvent):
                    _job_findings[job_id].append(event.finding)

                # Update job on completion
                if isinstance(event, ReviewCompletedEvent):
                    job.status = "completed"
                    job.findings = _job_findings.get(job_id, [])

                yield event.to_sse()

        except Exception as e:
            job.status = "failed"
            job.error = str(e)
            # Yield error event
            from app.models.events import ErrorEvent
            yield ErrorEvent(message=str(e), recoverable=False).to_sse()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )
