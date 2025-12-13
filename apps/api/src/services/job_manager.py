"""
Job Manager - In-memory state management for documents and review jobs.

This service stores DocObj and ReviewJob instances in memory with async-safe
operations. No database for MVP - state is lost on restart.
"""

import asyncio
from datetime import datetime, timedelta
from typing import Dict, Optional
import structlog

from ..models.document import DocObj
from ..models.review import ReviewJob, ReviewStatus, AgentStatus, ReviewConfig
from ..models.finding import Finding, AgentId

logger = structlog.get_logger()


class JobManager:
    """
    In-memory storage for documents and review jobs.
    
    Thread-safe via asyncio.Lock for all write operations.
    Implements TTL-based cleanup for old jobs.
    """
    
    def __init__(self, job_ttl_hours: int = 1):
        self._documents: Dict[str, DocObj] = {}
        self._jobs: Dict[str, ReviewJob] = {}
        self._job_to_doc: Dict[str, str] = {}  # job_id -> document_id
        self._lock = asyncio.Lock()
        self._job_ttl = timedelta(hours=job_ttl_hours)
        self._cleanup_task: Optional[asyncio.Task] = None
    
    # -------------------------------------------------------------------------
    # Lifecycle
    # -------------------------------------------------------------------------
    
    async def start(self):
        """Start background cleanup task."""
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        logger.info("job_manager_started", ttl_hours=self._job_ttl.total_seconds() / 3600)
    
    async def stop(self):
        """Stop background cleanup task."""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
        logger.info("job_manager_stopped")
    
    async def _cleanup_loop(self):
        """Periodically clean up expired jobs and orphaned documents."""
        while True:
            await asyncio.sleep(300)  # Every 5 minutes
            await self._cleanup_expired()
    
    async def _cleanup_expired(self):
        """Remove jobs older than TTL and their orphaned documents."""
        now = datetime.utcnow()
        expired_jobs = []
        
        async with self._lock:
            for job_id, job in self._jobs.items():
                job_age = now - job.started_at
                if job_age > self._job_ttl:
                    expired_jobs.append(job_id)
            
            for job_id in expired_jobs:
                job = self._jobs.pop(job_id, None)
                if job:
                    doc_id = self._job_to_doc.pop(job_id, None)
                    # Only delete document if no other jobs reference it
                    if doc_id and not any(
                        d == doc_id for j, d in self._job_to_doc.items()
                    ):
                        self._documents.pop(doc_id, None)
                        logger.info("document_cleaned_up", doc_id=doc_id)
                    logger.info("job_cleaned_up", job_id=job_id)
        
        if expired_jobs:
            logger.info("cleanup_completed", expired_count=len(expired_jobs))
    
    # -------------------------------------------------------------------------
    # Document Operations
    # -------------------------------------------------------------------------
    
    async def store_document(self, doc: DocObj) -> None:
        """
        Store a parsed document.
        
        DocObj is immutable - storing the same ID twice will raise an error.
        """
        async with self._lock:
            if doc.id in self._documents:
                raise ValueError(f"Document {doc.id} already exists")
            self._documents[doc.id] = doc
        
        logger.info(
            "document_stored",
            doc_id=doc.id,
            filename=doc.filename,
            paragraph_count=len(doc.paragraphs),
        )
    
    async def get_document(self, document_id: str) -> Optional[DocObj]:
        """Retrieve a document by ID."""
        return self._documents.get(document_id)
    
    async def document_exists(self, document_id: str) -> bool:
        """Check if a document exists."""
        return document_id in self._documents
    
    # -------------------------------------------------------------------------
    # Job Operations
    # -------------------------------------------------------------------------
    
    async def create_job(
        self, 
        document_id: str, 
        config: ReviewConfig
    ) -> ReviewJob:
        """
        Create a new review job for a document.
        
        Raises ValueError if document doesn't exist.
        """
        if not await self.document_exists(document_id):
            raise ValueError(f"Document {document_id} not found")
        
        job = ReviewJob(
            document_id=document_id,
            config=config,
            status=ReviewStatus.PENDING,
        )
        
        async with self._lock:
            self._jobs[job.id] = job
            self._job_to_doc[job.id] = document_id
        
        logger.info(
            "job_created",
            job_id=job.id,
            doc_id=document_id,
            tier=config.tier,
        )
        
        return job
    
    async def get_job(self, job_id: str) -> Optional[ReviewJob]:
        """Retrieve a job by ID."""
        return self._jobs.get(job_id)
    
    async def job_exists(self, job_id: str) -> bool:
        """Check if a job exists."""
        return job_id in self._jobs
    
    async def update_job_status(
        self, 
        job_id: str, 
        status: ReviewStatus,
        current_phase: Optional[str] = None,
        error: Optional[str] = None,
    ) -> None:
        """Update job status and optionally current phase."""
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                raise ValueError(f"Job {job_id} not found")
            
            job.status = status
            if current_phase is not None:
                job.current_phase = current_phase
            if error is not None:
                job.error = error
            if status in (ReviewStatus.COMPLETED, ReviewStatus.FAILED):
                job.completed_at = datetime.utcnow()
        
        logger.info(
            "job_status_updated",
            job_id=job_id,
            status=status,
            phase=current_phase,
        )
    
    async def update_agent_status(
        self,
        job_id: str,
        agent_id: AgentId,
        status: str,  # "pending", "running", "completed", "failed"
        findings_count: int = 0,
        error: Optional[str] = None,
    ) -> None:
        """Update status for a specific agent within a job."""
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                raise ValueError(f"Job {job_id} not found")
            
            now = datetime.utcnow()
            
            if agent_id not in job.agent_statuses:
                job.agent_statuses[agent_id] = AgentStatus(status="pending")
            
            agent_status = job.agent_statuses[agent_id]
            agent_status.status = status
            agent_status.findings_count = findings_count
            
            if status == "running" and agent_status.started_at is None:
                agent_status.started_at = now
            if status in ("completed", "failed"):
                agent_status.completed_at = now
            if error:
                agent_status.error = error
        
        logger.info(
            "agent_status_updated",
            job_id=job_id,
            agent=agent_id,
            status=status,
            findings_count=findings_count,
        )
    
    async def add_finding(self, job_id: str, finding: Finding) -> None:
        """Add a single finding to a job (for real-time updates)."""
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                raise ValueError(f"Job {job_id} not found")
            job.findings.append(finding)
        
        logger.debug(
            "finding_added",
            job_id=job_id,
            finding_id=finding.id,
            severity=finding.severity,
        )
    
    async def add_findings(self, job_id: str, findings: list[Finding]) -> None:
        """Add multiple findings to a job (batch update)."""
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                raise ValueError(f"Job {job_id} not found")
            job.findings.extend(findings)
        
        logger.info(
            "findings_added",
            job_id=job_id,
            count=len(findings),
        )
    
    async def set_findings(self, job_id: str, findings: list[Finding]) -> None:
        """Replace all findings for a job (after assembly/dedup)."""
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                raise ValueError(f"Job {job_id} not found")
            job.findings = findings
        
        logger.info(
            "findings_set",
            job_id=job_id,
            count=len(findings),
        )
    
    async def complete_job(
        self, 
        job_id: str, 
        findings: list[Finding]
    ) -> None:
        """Mark job as completed with final findings."""
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                raise ValueError(f"Job {job_id} not found")
            
            job.findings = findings
            job.status = ReviewStatus.COMPLETED
            job.completed_at = datetime.utcnow()
        
        logger.info(
            "job_completed",
            job_id=job_id,
            findings_count=len(findings),
        )
    
    async def fail_job(self, job_id: str, error: str) -> None:
        """Mark job as failed with error message."""
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                raise ValueError(f"Job {job_id} not found")
            
            job.status = ReviewStatus.FAILED
            job.error = error
            job.completed_at = datetime.utcnow()
        
        logger.error(
            "job_failed",
            job_id=job_id,
            error=error,
        )
    
    # -------------------------------------------------------------------------
    # Query Operations
    # -------------------------------------------------------------------------
    
    async def get_job_with_document(
        self, 
        job_id: str
    ) -> tuple[Optional[ReviewJob], Optional[DocObj]]:
        """Get both job and its associated document."""
        job = await self.get_job(job_id)
        if not job:
            return None, None
        doc = await self.get_document(job.document_id)
        return job, doc
    
    async def get_jobs_for_document(self, document_id: str) -> list[ReviewJob]:
        """Get all jobs associated with a document."""
        return [
            job for job in self._jobs.values()
            if job.document_id == document_id
        ]
    
    # -------------------------------------------------------------------------
    # Stats (for monitoring)
    # -------------------------------------------------------------------------
    
    async def get_stats(self) -> dict:
        """Get current storage statistics."""
        return {
            "documents": len(self._documents),
            "jobs": len(self._jobs),
            "jobs_by_status": {
                status.value: sum(
                    1 for j in self._jobs.values() if j.status == status
                )
                for status in ReviewStatus
            },
        }


# Singleton instance
_job_manager: Optional[JobManager] = None


def get_job_manager() -> JobManager:
    """Get the singleton JobManager instance."""
    global _job_manager
    if _job_manager is None:
        _job_manager = JobManager()
    return _job_manager


async def init_job_manager() -> JobManager:
    """Initialize and start the JobManager."""
    manager = get_job_manager()
    await manager.start()
    return manager


async def shutdown_job_manager() -> None:
    """Shutdown the JobManager."""
    global _job_manager
    if _job_manager:
        await _job_manager.stop()
        _job_manager = None