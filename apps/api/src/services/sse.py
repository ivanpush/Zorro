"""
Server-Sent Events (SSE) infrastructure for real-time updates.

This module provides an event broadcasting system that maintains subscriptions
per job_id and formats events according to the SSE specification.
"""

import asyncio
import json
from collections import defaultdict
from datetime import datetime, timezone
from typing import AsyncGenerator, Dict, Set, Optional
from asyncio import Queue

import structlog

from ..models.events import BaseEvent, EventType

logger = structlog.get_logger()


class EventBroadcaster:
    """
    Event broadcaster that manages SSE subscriptions and publishing.

    Maintains per-job subscriptions and handles event distribution with
    automatic heartbeats to keep connections alive.
    """

    def __init__(self, heartbeat_interval_seconds: int = 15):
        """
        Initialize the EventBroadcaster.

        Args:
            heartbeat_interval_seconds: Seconds between heartbeat messages (default: 15)
        """
        self._subscriptions: Dict[str, Set[Queue]] = defaultdict(set)
        self._subscription_lock = asyncio.Lock()
        self._heartbeat_tasks: Dict[Queue, asyncio.Task] = {}
        self.heartbeat_interval = heartbeat_interval_seconds

        logger.info("sse_broadcaster_initialized", heartbeat_interval=heartbeat_interval_seconds)

    def _format_sse(self, event_type: str, data: dict) -> str:
        """
        Format data as SSE message.

        Args:
            event_type: The event type
            data: The event data

        Returns:
            SSE-formatted string with event type and JSON data
        """
        # Add timestamp if not present
        if 'timestamp' not in data:
            data['timestamp'] = datetime.now(timezone.utc).isoformat()

        # Format according to SSE spec
        lines = [
            f"event: {event_type}",
            f"data: {json.dumps(data)}",
            ""  # Empty line to end the event
        ]
        return "\n".join(lines) + "\n"

    def _format_heartbeat(self) -> str:
        """
        Format a heartbeat message as SSE comment.

        Returns:
            SSE comment line for heartbeat
        """
        return f": heartbeat {datetime.now(timezone.utc).isoformat()}\n\n"

    async def _heartbeat_loop(self, queue: Queue) -> None:
        """
        Send periodic heartbeats to keep connection alive.

        Args:
            queue: The queue to send heartbeats to
        """
        try:
            while True:
                await asyncio.sleep(self.heartbeat_interval)
                await queue.put(self._format_heartbeat())
        except asyncio.CancelledError:
            pass

    async def subscribe(self, job_id: str) -> AsyncGenerator[str, None]:
        """
        Subscribe to events for a specific job.

        Args:
            job_id: The job ID to subscribe to

        Yields:
            SSE-formatted event strings
        """
        queue: Queue = asyncio.Queue()

        async with self._subscription_lock:
            self._subscriptions[job_id].add(queue)
            # Start heartbeat task for this subscription
            self._heartbeat_tasks[queue] = asyncio.create_task(
                self._heartbeat_loop(queue)
            )

        logger.info(
            "sse_subscription_created",
            job_id=job_id,
            total_subscribers=len(self._subscriptions[job_id])
        )

        try:
            # Send initial connection event
            initial_event = self._format_sse(
                "connection_established",
                {"job_id": job_id, "message": "Connected to event stream"}
            )
            yield initial_event

            # Yield events as they arrive
            while True:
                try:
                    # Wait for messages with a timeout to allow periodic checks
                    message = await asyncio.wait_for(queue.get(), timeout=60)
                    yield message
                except asyncio.TimeoutError:
                    # Send heartbeat on timeout
                    yield self._format_heartbeat()

        except (GeneratorExit, asyncio.CancelledError):
            # Client disconnected
            pass
        finally:
            # Clean up subscription
            await self._unsubscribe(job_id, queue)

    async def _unsubscribe(self, job_id: str, queue: Queue) -> None:
        """
        Remove a subscription and clean up resources.

        Args:
            job_id: The job ID to unsubscribe from
            queue: The queue to remove
        """
        async with self._subscription_lock:
            self._subscriptions[job_id].discard(queue)

            # Cancel and clean up heartbeat task
            if queue in self._heartbeat_tasks:
                task = self._heartbeat_tasks.pop(queue)
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

            # Remove job entry if no more subscribers
            if not self._subscriptions[job_id]:
                del self._subscriptions[job_id]

        logger.info(
            "sse_subscription_removed",
            job_id=job_id,
            remaining_subscribers=len(self._subscriptions.get(job_id, set()))
        )

    async def publish(self, job_id: str, event: BaseEvent) -> None:
        """
        Publish an event to all subscribers of a job.

        Args:
            job_id: The job ID to publish to
            event: The event to publish
        """
        async with self._subscription_lock:
            subscribers = self._subscriptions.get(job_id, set()).copy()

        if not subscribers:
            logger.debug("sse_no_subscribers", job_id=job_id, event_type=event.type)
            return

        # Format event data
        event_data = event.model_dump()
        formatted_event = self._format_sse(event.type.value, event_data)

        # Send to all subscribers
        disconnected = []
        for queue in subscribers:
            try:
                # Non-blocking put with full queue check
                if queue.full():
                    logger.warning(
                        "sse_queue_full",
                        job_id=job_id,
                        event_type=event.type.value
                    )
                    disconnected.append(queue)
                else:
                    await queue.put(formatted_event)
            except Exception as e:
                logger.error(
                    "sse_publish_error",
                    job_id=job_id,
                    error=str(e)
                )
                disconnected.append(queue)

        # Clean up disconnected subscribers
        for queue in disconnected:
            await self._unsubscribe(job_id, queue)

        logger.info(
            "sse_event_published",
            job_id=job_id,
            event_type=event.type.value,
            subscriber_count=len(subscribers) - len(disconnected)
        )

    async def close_job(self, job_id: str) -> None:
        """
        Close all subscriptions for a job.

        This is called when a job completes or fails.

        Args:
            job_id: The job ID to close subscriptions for
        """
        async with self._subscription_lock:
            subscribers = self._subscriptions.get(job_id, set()).copy()

        if not subscribers:
            return

        # Send completion event to all subscribers
        completion_event = BaseEvent(
            type=EventType.CONNECTION_CLOSING,
            timestamp=datetime.now(timezone.utc).isoformat()
        )
        await self.publish(job_id, completion_event)

        # Clean up all subscriptions
        for queue in subscribers:
            await self._unsubscribe(job_id, queue)

        logger.info(
            "sse_job_closed",
            job_id=job_id,
            closed_subscribers=len(subscribers)
        )

    async def shutdown(self) -> None:
        """
        Shutdown the broadcaster and clean up all resources.
        """
        # Get all job IDs
        job_ids = list(self._subscriptions.keys())

        # Close all jobs
        for job_id in job_ids:
            await self.close_job(job_id)

        logger.info("sse_broadcaster_shutdown")

    def get_stats(self) -> dict:
        """Get current statistics about subscriptions."""
        total_subscribers = sum(
            len(subs) for subs in self._subscriptions.values()
        )
        return {
            'active_jobs': len(self._subscriptions),
            'total_subscribers': total_subscribers,
            'jobs': {
                job_id: len(subs)
                for job_id, subs in self._subscriptions.items()
            }
        }


# Global instance (will be initialized in main.py)
event_broadcaster = EventBroadcaster()