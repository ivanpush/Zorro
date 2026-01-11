"""
Orchestrator - Pipeline coordination with true parallel execution.

Dependency graph (each agent starts when its inputs are ready):

    Briefing ──┬──→ Clarity ─────────────────────────┐
               │                                      │
               ├──→ Rigor-Find ──→ Rigor-Rewrite ────┤
               │                                      │
               └──→ Adversary (also needs Domain) ───┤
                                                      │
    Domain ────────→ Adversary                        │
                                                      ▼
                                                  Assembler

Yields SSE events as agents/chunks complete for real-time progress.
Logs to terminal with timing and cost information.
"""

import asyncio
import logging
import time
from typing import AsyncGenerator

from app.models import (
    DocObj, ReviewConfig,
    BriefingOutput, EvidencePack, Finding,
    AgentMetrics, ReviewMetrics,
)
from app.models.events import (
    SSEEvent, AgentStartedEvent, AgentCompletedEvent, ChunkCompletedEvent,
    FindingDiscoveredEvent, ReviewCompletedEvent, ErrorEvent,
)
from app.agents.briefing import BriefingAgent
from app.agents.clarity import ClarityAgent
from app.agents.rigor import RigorFinder, RigorRewriter
from app.agents.adversary import AdversaryAgent
from app.agents.domain import DomainPipeline
from app.services.assembler import Assembler
from app.core import get_llm_client
from app.composer import Composer
from app.config import get_settings


# Terminal logging setup
logger = logging.getLogger("orchestrator")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(
        "\033[90m[%(asctime)s]\033[0m %(message)s",
        datefmt="%H:%M:%S"
    ))
    logger.addHandler(handler)


def _log_start(agent: str, detail: str = ""):
    """Log agent start with optional detail."""
    detail_str = f"  ({detail})" if detail else ""
    logger.info(f"\033[36m{agent:<16}\033[0m \033[33mSTARTED\033[0m{detail_str}")


def _log_done(agent: str, elapsed: float, cost: float | None = None, findings: int | None = None, extra: str = ""):
    """Log agent completion with metrics."""
    parts = [f"\033[36m{agent:<16}\033[0m \033[32mDONE\033[0m     {elapsed:.1f}s"]
    if cost is not None:
        parts.append(f"  ${cost:.3f}")
    if findings is not None:
        parts.append(f"  {findings} finding{'s' if findings != 1 else ''}")
    if extra:
        parts.append(f"  {extra}")
    logger.info("".join(parts))


def _log_chunk(agent: str, chunk_idx: int, total: int, elapsed: float, findings: int, failed: bool = False):
    """Log chunk completion."""
    status = "\033[31mFAILED\033[0m" if failed else "\033[32mDONE\033[0m"
    logger.info(f"\033[36m{agent}[{chunk_idx}/{total}]\033[0m {status}    {elapsed:.1f}s   {findings} finding{'s' if findings != 1 else ''}")


def _log_error(agent: str, error: str):
    """Log agent error."""
    logger.info(f"\033[36m{agent:<16}\033[0m \033[31mFAILED\033[0m   {error}")


def _log_skip(agent: str):
    """Log agent skipped."""
    logger.info(f"\033[36m{agent:<16}\033[0m \033[33mSKIPPED\033[0m  (disabled in settings)")


def _log_summary(elapsed: float, cost: float, findings: int, raw_count: int):
    """Log final summary."""
    logger.info("─" * 50)
    removed = raw_count - findings if raw_count > findings else 0
    logger.info(f"\033[1mTOTAL: {elapsed:.1f}s  ${cost:.2f}  {findings} findings\033[0m" +
                (f" (dedupe removed {removed})" if removed else ""))


class Orchestrator:
    """
    Pipeline orchestrator with dependency-based parallel execution.

    Each agent starts as soon as its dependencies are satisfied,
    not waiting for unrelated agents to complete.
    """

    def __init__(self):
        self._client = get_llm_client()
        self._composer = Composer()

    async def run(
        self,
        doc: DocObj,
        config: ReviewConfig
    ) -> AsyncGenerator[SSEEvent, None]:
        """
        Run complete review pipeline with true parallel execution.

        Yields SSE events as agents and chunks complete.
        """
        start_time = time.time()

        # Event queue for SSE - agents push events here
        event_queue: asyncio.Queue[SSEEvent | None] = asyncio.Queue()

        # Shared state for cross-agent dependencies
        briefing_ready = asyncio.Event()
        domain_ready = asyncio.Event()
        rigor_find_ready = asyncio.Event()

        briefing_result: BriefingOutput | None = None
        evidence_result: EvidencePack = EvidencePack.empty()
        rigor_findings_result: list[Finding] = []

        # Collect all findings
        all_findings: list[Finding] = []
        findings_lock = asyncio.Lock()

        # Metrics collection
        all_metrics: list[AgentMetrics] = []
        metrics_lock = asyncio.Lock()

        async def add_finding(finding: Finding):
            async with findings_lock:
                all_findings.append(finding)
            await event_queue.put(FindingDiscoveredEvent(finding=finding))

        async def add_metrics(m: AgentMetrics | list[AgentMetrics]):
            async with metrics_lock:
                if isinstance(m, list):
                    all_metrics.extend(m)
                else:
                    all_metrics.append(m)

        # ============================================================
        # AGENT TASKS - each runs independently based on dependencies
        # ============================================================

        async def run_briefing():
            nonlocal briefing_result
            agent_start = time.time()
            _log_start("briefing", f"{len(doc.paragraphs)} paragraphs")

            await event_queue.put(AgentStartedEvent(
                agent_id="briefing",
                title="Reading document",
                subtitle=f"Analyzing {len(doc.paragraphs)} paragraphs"
            ))

            try:
                briefing_agent = BriefingAgent(
                    client=self._client,
                    composer=self._composer
                )
                briefing_result, agent_metrics = await briefing_agent.run(
                    doc,
                    steering=config.steering_memo
                )
                await add_metrics(agent_metrics)

                elapsed = time.time() - agent_start
                _log_done("briefing", elapsed, agent_metrics.cost_usd)

                await event_queue.put(AgentCompletedEvent(
                    agent_id="briefing",
                    findings_count=0,
                    time_ms=elapsed * 1000,
                    cost_usd=agent_metrics.cost_usd
                ))
            except Exception as e:
                _log_error("briefing", str(e))
                await event_queue.put(ErrorEvent(message=f"Briefing failed: {e}", recoverable=False))
                raise
            finally:
                briefing_ready.set()

        async def run_domain():
            nonlocal evidence_result
            if not config.enable_domain:
                domain_ready.set()
                return

            agent_start = time.time()
            _log_start("domain")

            await event_queue.put(AgentStartedEvent(
                agent_id="domain",
                title="Researching domain context",
                subtitle="Gathering external evidence"
            ))

            try:
                domain_pipeline = DomainPipeline(
                    client=self._client,
                    composer=self._composer
                )
                evidence_result, domain_metrics = await domain_pipeline.run(doc)
                await add_metrics(domain_metrics)

                elapsed = time.time() - agent_start
                total_cost = sum(m.cost_usd for m in domain_metrics) if isinstance(domain_metrics, list) else domain_metrics.cost_usd
                _log_done("domain", elapsed, total_cost, extra=f"{len(evidence_result.items)} items")

                await event_queue.put(AgentCompletedEvent(
                    agent_id="domain",
                    findings_count=0,
                    time_ms=elapsed * 1000,
                    cost_usd=total_cost
                ))
            except Exception as e:
                _log_error("domain", str(e))
                evidence_result = EvidencePack.empty()
                # Domain failure is non-critical
            finally:
                domain_ready.set()

        async def run_clarity():
            """Clarity runs after Briefing, streams chunk completions."""
            await briefing_ready.wait()

            agent_start = time.time()
            clarity_agent = ClarityAgent(
                client=self._client,
                composer=self._composer
            )

            # Get chunk count for logging
            chunks = clarity_agent.get_chunks(doc)
            num_chunks = len(chunks)

            _log_start("clarity", f"{num_chunks} chunks")

            await event_queue.put(AgentStartedEvent(
                agent_id="clarity",
                title="Reviewing writing clarity",
                subtitle=f"Processing {num_chunks} chunks"
            ))

            total_findings = 0
            chunk_metrics: list[AgentMetrics] = []

            try:
                # Stream chunk completions
                async for chunk_result in clarity_agent.run_streaming(
                    doc,
                    briefing=briefing_result,
                    steering=config.steering_memo
                ):
                    chunk_idx, chunk_findings, chunk_metric, error = chunk_result
                    chunk_elapsed = chunk_metric.time_ms / 1000 if chunk_metric else 0

                    if error:
                        _log_chunk("clarity", chunk_idx, num_chunks, chunk_elapsed, 0, failed=True)
                        await event_queue.put(ChunkCompletedEvent(
                            agent_id="clarity",
                            chunk_index=chunk_idx,
                            total_chunks=num_chunks,
                            findings_count=0,
                            failed=True,
                            error=error
                        ))
                    else:
                        _log_chunk("clarity", chunk_idx, num_chunks, chunk_elapsed, len(chunk_findings))
                        chunk_metrics.append(chunk_metric)
                        total_findings += len(chunk_findings)

                        for finding in chunk_findings:
                            await add_finding(finding)

                        await event_queue.put(ChunkCompletedEvent(
                            agent_id="clarity",
                            chunk_index=chunk_idx,
                            total_chunks=num_chunks,
                            findings_count=len(chunk_findings),
                            failed=False
                        ))

                # Aggregate metrics for agent-level reporting
                if chunk_metrics:
                    await add_metrics(chunk_metrics)  # Add to total cost tracking
                    total_cost = sum(m.cost_usd for m in chunk_metrics)
                    elapsed = time.time() - agent_start
                    _log_done("clarity", elapsed, total_cost, total_findings, "total")

                    await event_queue.put(AgentCompletedEvent(
                        agent_id="clarity",
                        findings_count=total_findings,
                        time_ms=elapsed * 1000,
                        cost_usd=total_cost
                    ))

            except Exception as e:
                _log_error("clarity", str(e))
                # Clarity failure is non-critical

        async def run_rigor_find():
            """Rigor-Find runs after Briefing, streams chunk completions."""
            nonlocal rigor_findings_result
            await briefing_ready.wait()

            agent_start = time.time()
            rigor_finder = RigorFinder(
                client=self._client,
                composer=self._composer
            )

            # Get section count for logging
            sections = rigor_finder.get_sections(doc)
            num_sections = len(sections)

            _log_start("rigor_find", f"{num_sections} sections")

            await event_queue.put(AgentStartedEvent(
                agent_id="rigor_find",
                title="Finding methodological issues",
                subtitle=f"Processing {num_sections} sections"
            ))

            chunk_metrics: list[AgentMetrics] = []

            try:
                async for chunk_result in rigor_finder.run_streaming(
                    doc,
                    briefing=briefing_result,
                    steering=config.steering_memo
                ):
                    chunk_idx, chunk_findings, chunk_metric, error = chunk_result
                    chunk_elapsed = chunk_metric.time_ms / 1000 if chunk_metric else 0

                    if error:
                        _log_chunk("rigor_find", chunk_idx, num_sections, chunk_elapsed, 0, failed=True)
                        await event_queue.put(ChunkCompletedEvent(
                            agent_id="rigor_find",
                            chunk_index=chunk_idx,
                            total_chunks=num_sections,
                            findings_count=0,
                            failed=True,
                            error=error
                        ))
                    else:
                        _log_chunk("rigor_find", chunk_idx, num_sections, chunk_elapsed, len(chunk_findings))
                        chunk_metrics.append(chunk_metric)
                        rigor_findings_result.extend(chunk_findings)

                        for finding in chunk_findings:
                            await add_finding(finding)

                        await event_queue.put(ChunkCompletedEvent(
                            agent_id="rigor_find",
                            chunk_index=chunk_idx,
                            total_chunks=num_sections,
                            findings_count=len(chunk_findings),
                            failed=False
                        ))

                # Aggregate metrics
                if chunk_metrics:
                    await add_metrics(chunk_metrics)  # Add to total cost tracking
                    total_cost = sum(m.cost_usd for m in chunk_metrics)
                    elapsed = time.time() - agent_start
                    _log_done("rigor_find", elapsed, total_cost, len(rigor_findings_result), "total")

                    await event_queue.put(AgentCompletedEvent(
                        agent_id="rigor_find",
                        findings_count=len(rigor_findings_result),
                        time_ms=elapsed * 1000,
                        cost_usd=total_cost
                    ))

            except Exception as e:
                _log_error("rigor_find", str(e))
                # Non-critical
            finally:
                rigor_find_ready.set()

        async def run_rigor_rewrite():
            """Rigor-Rewrite runs after Rigor-Find completes."""
            await rigor_find_ready.wait()

            if not rigor_findings_result:
                _log_start("rigor_rewrite", "skipped - no findings")
                return

            agent_start = time.time()
            _log_start("rigor_rewrite", f"{len(rigor_findings_result)} findings")

            await event_queue.put(AgentStartedEvent(
                agent_id="rigor_rewrite",
                title="Generating rewrites",
                subtitle=f"Improving {len(rigor_findings_result)} findings"
            ))

            try:
                rigor_rewriter = RigorRewriter(
                    client=self._client,
                    composer=self._composer
                )
                rewritten, rewrite_metrics = await rigor_rewriter.run(
                    rigor_findings_result,
                    doc
                )
                await add_metrics(rewrite_metrics)

                elapsed = time.time() - agent_start
                total_cost = sum(m.cost_usd for m in rewrite_metrics) if isinstance(rewrite_metrics, list) else rewrite_metrics.cost_usd
                _log_done("rigor_rewrite", elapsed, total_cost, len(rewritten))

                await event_queue.put(AgentCompletedEvent(
                    agent_id="rigor_rewrite",
                    findings_count=len(rewritten),
                    time_ms=elapsed * 1000,
                    cost_usd=total_cost
                ))

            except Exception as e:
                _log_error("rigor_rewrite", str(e))
                # Non-critical - use original findings

        async def run_adversary():
            """Adversary runs after Briefing, Rigor-Find, and Domain all complete."""
            await asyncio.gather(
                briefing_ready.wait(),
                rigor_find_ready.wait(),
                domain_ready.wait()
            )

            agent_start = time.time()
            mode = "panel" if config.panel_mode else "single"
            _log_start("adversary", mode)

            await event_queue.put(AgentStartedEvent(
                agent_id="adversary",
                title="Challenging arguments",
                subtitle=f"{'Panel mode' if config.panel_mode else 'Single model'}"
            ))

            try:
                adversary_agent = AdversaryAgent(
                    panel_mode=config.panel_mode,
                    client=self._client,
                    composer=self._composer
                )
                adversary_findings, adversary_metrics = await adversary_agent.run(
                    doc,
                    briefing=briefing_result,
                    rigor_findings=rigor_findings_result,
                    evidence=evidence_result,
                    steering=config.steering_memo
                )
                await add_metrics(adversary_metrics)

                for finding in adversary_findings:
                    await add_finding(finding)

                elapsed = time.time() - agent_start
                if isinstance(adversary_metrics, list):
                    total_cost = sum(m.cost_usd for m in adversary_metrics)
                else:
                    total_cost = adversary_metrics.cost_usd
                _log_done("adversary", elapsed, total_cost, len(adversary_findings))

                await event_queue.put(AgentCompletedEvent(
                    agent_id="adversary",
                    findings_count=len(adversary_findings),
                    time_ms=elapsed * 1000,
                    cost_usd=total_cost
                ))

            except Exception as e:
                _log_error("adversary", str(e))
                # Non-critical

        # ============================================================
        # LAUNCH ALL TASKS (respecting agent toggles from settings)
        # ============================================================
        settings = get_settings()

        # Helper to create a skip task that just signals ready
        async def skip_agent(name: str, ready_event: asyncio.Event | None = None):
            _log_skip(name)
            if ready_event:
                ready_event.set()

        # Briefing is always needed (other agents depend on it)
        if settings.enable_briefing:
            briefing_task = asyncio.create_task(run_briefing())
        else:
            briefing_task = asyncio.create_task(skip_agent("briefing", briefing_ready))

        # Domain (parallel with briefing, feeds adversary)
        if settings.enable_domain and config.enable_domain:
            domain_task = asyncio.create_task(run_domain())
        else:
            domain_task = asyncio.create_task(skip_agent("domain", domain_ready))

        # Clarity (needs briefing)
        if settings.enable_clarity:
            clarity_task = asyncio.create_task(run_clarity())
        else:
            clarity_task = asyncio.create_task(skip_agent("clarity"))

        # Rigor (needs briefing)
        if settings.enable_rigor:
            rigor_find_task = asyncio.create_task(run_rigor_find())
            rigor_rewrite_task = asyncio.create_task(run_rigor_rewrite())
        else:
            rigor_find_task = asyncio.create_task(skip_agent("rigor_find", rigor_find_ready))
            rigor_rewrite_task = asyncio.create_task(skip_agent("rigor_rewrite"))

        # Adversary (needs briefing + rigor + domain)
        if settings.enable_adversary:
            adversary_task = asyncio.create_task(run_adversary())
        else:
            adversary_task = asyncio.create_task(skip_agent("adversary"))

        async def run_assembler_and_complete():
            """Wait for all agents, run assembler, signal completion."""
            # Wait for all finding-producing agents
            await asyncio.gather(
                clarity_task,
                rigor_rewrite_task,
                adversary_task,
                return_exceptions=True
            )

            # Run assembler
            agent_start = time.time()
            _log_start("assembler", f"{len(all_findings)} findings")

            await event_queue.put(AgentStartedEvent(
                agent_id="assembler",
                title="Synthesizing results",
                subtitle=f"Processing {len(all_findings)} raw findings"
            ))

            assembler = Assembler()
            review_output = assembler.assemble(all_findings, all_metrics)

            elapsed = time.time() - agent_start
            removed = len(all_findings) - len(review_output.findings)
            _log_done("assembler", elapsed, findings=len(review_output.findings),
                     extra=f"(removed {removed})" if removed else "")

            await event_queue.put(AgentCompletedEvent(
                agent_id="assembler",
                findings_count=len(review_output.findings),
                time_ms=elapsed * 1000
            ))

            # Final summary
            total_elapsed = time.time() - start_time
            total_cost = review_output.metadata.total_cost_usd

            _log_summary(total_elapsed, total_cost, len(review_output.findings), len(all_findings))

            await event_queue.put(ReviewCompletedEvent(
                total_findings=review_output.summary.total_findings,
                findings=review_output.findings,
                metrics={
                    "total_time_ms": total_elapsed * 1000,
                    "total_cost_usd": total_cost,
                    "agents_run": review_output.metadata.agents_run,
                    "by_track": review_output.summary.by_track,
                    "by_severity": review_output.summary.by_severity,
                    "by_dimension": review_output.summary.by_dimension,
                }
            ))
            await event_queue.put(None)  # Signal end

        complete_task = asyncio.create_task(run_assembler_and_complete())

        # ============================================================
        # YIELD EVENTS AS THEY ARRIVE
        # ============================================================

        all_tasks = [briefing_task, domain_task, clarity_task,
                    rigor_find_task, rigor_rewrite_task, adversary_task,
                    complete_task]

        try:
            while True:
                event = await event_queue.get()
                if event is None:
                    break
                yield event
        except Exception as e:
            yield ErrorEvent(message=str(e), recoverable=False)
        finally:
            # Ensure all tasks complete or cancel
            for task in all_tasks:
                if not task.done():
                    task.cancel()
                    try:
                        await task
                    except asyncio.CancelledError:
                        pass
