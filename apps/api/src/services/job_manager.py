"""
Job Manager Service - In-memory storage for ReviewJob and DocObj with async locks.

This module manages the lifecycle of review jobs and documents in memory,
providing thread-safe CRUD operations and automatic cleanup of expired jobs.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional
from uuid import uuid4

import structlog

from ..models.document import DocObj
from ..models.finding import Finding
from ..models.review import ReviewJob, ReviewConfig, JobStatus

logger = structlog.get_logger()


class JobManager:
    """
    In-memory job and document storage with thread-safe operations.

    Manages the lifecycle of review jobs with automatic TTL-based cleanup.
    """

    def __init__(self, ttl_hours: int = 1, cleanup_interval_minutes: int = 5):
        """
        Initialize the JobManager.

        Args:
            ttl_hours: Hours before a job is eligible for cleanup (default: 1)
            cleanup_interval_minutes: Minutes between cleanup runs (default: 5)
        """
        self._jobs: Dict[str, ReviewJob] = {}
        self._documents: Dict[str, DocObj] = {}
        self._write_lock = asyncio.Lock()
        self.ttl_hours = ttl_hours
        self.cleanup_interval_minutes = cleanup_interval_minutes
        self._cleanup_task: Optional[asyncio.Task] = None

        logger.info(
            "job_manager_initialized",
            ttl_hours=ttl_hours,
            cleanup_interval_minutes=cleanup_interval_minutes
        )

    async def start(self) -> None:
        """Start the background cleanup task."""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())
            logger.info("job_manager_cleanup_started")

    async def stop(self) -> None:
        """Stop the background cleanup task."""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
            self._cleanup_task = None
            logger.info("job_manager_cleanup_stopped")

    async def create_job(
        self,
        document: DocObj,
        config: ReviewConfig
    ) -> ReviewJob:
        """
        Create a new review job with associated document.

        Args:
            document: The document to review
            config: Review configuration

        Returns:
            The created ReviewJob
        """
        async with self._write_lock:
            job_id = str(uuid4())

            # Store document
            self._documents[document.id] = document

            # Create and store job
            job = ReviewJob(
                id=job_id,
                document_id=document.id,
                config=config,
                status=JobStatus.PENDING,
                created_at=datetime.now(timezone.utc).isoformat(),
                findings=[]
            )
            self._jobs[job_id] = job

            logger.info(
                "job_created",
                job_id=job_id,
                document_id=document.id,
                tier=config.tier.value
            )

            return job

    async def get_job(self, job_id: str) -> Optional[ReviewJob]:
        """
        Get a job by ID.

        Args:
            job_id: The job ID to retrieve

        Returns:
            The ReviewJob if found, None otherwise
        """
        job = self._jobs.get(job_id)
        if job:
            logger.debug("job_retrieved", job_id=job_id, status=job.status.value)
        else:
            logger.warning("job_not_found", job_id=job_id)
        return job

    async def update_job(self, job_id: str, **updates) -> Optional[ReviewJob]:
        """
        Update a job's fields.

        Args:
            job_id: The job ID to update
            **updates: Fields to update

        Returns:
            The updated ReviewJob if found, None otherwise
        """
        async with self._write_lock:
            job = self._jobs.get(job_id)
            if not job:
                logger.warning("job_update_failed_not_found", job_id=job_id)
                return None

            # Create a new job instance with updates
            job_dict = job.model_dump()
            job_dict.update(updates)

            # Handle special case for updating timestamp
            if 'updated_at' not in updates:
                job_dict['updated_at'] = datetime.now(timezone.utc).isoformat()

            updated_job = ReviewJob(**job_dict)
            self._jobs[job_id] = updated_job

            logger.info(
                "job_updated",
                job_id=job_id,
                updates=list(updates.keys()),
                status=updated_job.status.value
            )

            return updated_job

    async def get_document(self, document_id: str) -> Optional[DocObj]:
        """
        Get a document by ID.

        Args:
            document_id: The document ID to retrieve

        Returns:
            The DocObj if found, None otherwise
        """
        doc = self._documents.get(document_id)
        if doc:
            logger.debug("document_retrieved", document_id=document_id)
        else:
            logger.warning("document_not_found", document_id=document_id)
        return doc

    async def complete_job(self, job_id: str, findings: list[Finding]) -> None:
        """
        Mark a job as completed with final findings.

        Args:
            job_id: The job ID to complete
            findings: The final list of findings
        """
        async with self._write_lock:
            job = self._jobs.get(job_id)
            if not job:
                logger.error("job_completion_failed_not_found", job_id=job_id)
                raise ValueError(f"Job {job_id} not found")

            # Update job with completion data
            job_dict = job.model_dump()
            job_dict.update({
                'status': JobStatus.COMPLETED,
                'findings': [f.model_dump() for f in findings],
                'completed_at': datetime.now(timezone.utc).isoformat(),
                'updated_at': datetime.now(timezone.utc).isoformat()
            })

            completed_job = ReviewJob(**job_dict)
            self._jobs[job_id] = completed_job

            logger.info(
                "job_completed",
                job_id=job_id,
                finding_count=len(findings),
                duration_seconds=(
                    datetime.fromisoformat(completed_job.completed_at) -
                    datetime.fromisoformat(completed_job.created_at)
                ).total_seconds() if completed_job.completed_at else 0
            )

    async def fail_job(self, job_id: str, error: str) -> None:
        """
        Mark a job as failed with error message.

        Args:
            job_id: The job ID to fail
            error: The error message
        """
        await self.update_job(
            job_id,
            status=JobStatus.FAILED,
            error=error,
            updated_at=datetime.now(timezone.utc).isoformat()
        )
        logger.error("job_failed", job_id=job_id, error=error)

    async def _cleanup_loop(self) -> None:
        """Background task that cleans up expired jobs."""
        while True:
            try:
                await asyncio.sleep(self.cleanup_interval_minutes * 60)
                await self._cleanup_expired_jobs()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("cleanup_error", error=str(e))

    async def _cleanup_expired_jobs(self) -> None:
        """Remove jobs older than TTL."""
        async with self._write_lock:
            cutoff_time = datetime.now(timezone.utc) - timedelta(hours=self.ttl_hours)
            initial_count = len(self._jobs)

            expired_jobs = []
            for job_id, job in self._jobs.items():
                job_time = datetime.fromisoformat(job.created_at)
                if job_time < cutoff_time:
                    expired_jobs.append(job_id)

            # Remove expired jobs and their documents
            for job_id in expired_jobs:
                job = self._jobs.pop(job_id)
                # Also remove associated document
                self._documents.pop(job.document_id, None)

            if expired_jobs:
                logger.info(
                    "expired_jobs_cleaned",
                    removed_count=len(expired_jobs),
                    remaining_count=len(self._jobs)
                )

    def get_stats(self) -> dict:
        """Get current statistics about jobs and documents."""
        status_counts = {}
        for job in self._jobs.values():
            status_counts[job.status.value] = status_counts.get(job.status.value, 0) + 1

        return {
            'total_jobs': len(self._jobs),
            'total_documents': len(self._documents),
            'jobs_by_status': status_counts
        }


# Global instance (will be initialized in main.py)
job_manager = JobManager()