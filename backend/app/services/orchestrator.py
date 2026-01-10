"""
Orchestrator - Pipeline coordination.

Runs agents in correct order with parallelization:
1. Briefing + Domain (parallel)
2. Clarity + Rigor-Find (parallel, after Briefing)
3. Rigor-Rewrite + Adversary (parallel, after Rigor-Find)
4. Assembler (final dedup/sort)
"""

import asyncio
from datetime import datetime
from typing import Union

from app.models import (
    DocObj, ReviewConfig, ReviewJob,
    BriefingOutput, EvidencePack, Finding,
    AgentMetrics, ReviewMetrics,
)
# Import agents directly to avoid circular imports
from app.agents.briefing import BriefingAgent
from app.agents.clarity import ClarityAgent
from app.agents.rigor import RigorFinder, RigorRewriter
from app.agents.adversary import AdversaryAgent
from app.agents.domain import DomainPipeline
from app.services.assembler import Assembler
from app.core import get_llm_client
from app.composer import Composer


class Orchestrator:
    """
    Pipeline orchestrator.

    Coordinates all agents in correct execution order.
    Aggregates metrics for dev banner.
    """

    def __init__(self):
        self._client = get_llm_client()
        self._composer = Composer()

    async def run(
        self,
        doc: DocObj,
        config: ReviewConfig
    ) -> ReviewJob:
        """
        Run complete review pipeline.

        Args:
            doc: Document to review
            config: Review configuration

        Returns:
            ReviewJob with findings and metrics
        """
        job = ReviewJob(
            document_id=doc.document_id,
            config=config,
            status="running",
        )

        metrics = ReviewMetrics()
        all_findings: list[Finding] = []

        try:
            # ========================================
            # PHASE 1: Briefing + Domain (parallel)
            # ========================================
            job.current_phase = "briefing_domain"

            briefing, evidence, phase1_metrics = await self._run_phase1(
                doc, config
            )

            for m in phase1_metrics:
                metrics.add(m)

            # ========================================
            # PHASE 2: Clarity + Rigor-Find (parallel)
            # ========================================
            job.current_phase = "clarity_rigor_find"

            clarity_findings, rigor_findings, phase2_metrics = await self._run_phase2(
                doc, briefing, config
            )

            all_findings.extend(clarity_findings)
            for m in phase2_metrics:
                metrics.add(m)

            # ========================================
            # PHASE 3: Rigor-Rewrite + Adversary (parallel)
            # ========================================
            job.current_phase = "rigor_rewrite_adversary"

            rewritten_findings, adversary_findings, phase3_metrics = await self._run_phase3(
                doc, briefing, rigor_findings, evidence, config
            )

            # Replace rigor findings with rewritten ones (if any)
            if rewritten_findings:
                all_findings.extend(rewritten_findings)
            else:
                all_findings.extend(rigor_findings)

            all_findings.extend(adversary_findings)

            for m in phase3_metrics:
                metrics.add(m)

            # ========================================
            # PHASE 4: Assembler (final)
            # ========================================
            job.current_phase = "assembler"

            assembler = Assembler()
            final_findings = assembler.assemble(all_findings)

            # Complete job
            job.status = "completed"
            job.current_phase = None
            job.findings = final_findings
            job.metrics = metrics
            job.completed_at = datetime.utcnow()

        except Exception as e:
            job.status = "failed"
            job.error = str(e)
            job.completed_at = datetime.utcnow()

        return job

    async def _run_phase1(
        self,
        doc: DocObj,
        config: ReviewConfig
    ) -> tuple[BriefingOutput, EvidencePack, list[AgentMetrics]]:
        """
        Phase 1: Briefing + Domain in parallel.

        Returns:
            Tuple of (briefing_output, evidence_pack, metrics)
        """
        all_metrics: list[AgentMetrics] = []

        # Create agents
        briefing_agent = BriefingAgent(
            client=self._client,
            composer=self._composer
        )

        # Prepare tasks
        tasks = []

        # Briefing task
        async def run_briefing():
            return await briefing_agent.run(
                doc,
                steering=config.steering_memo
            )

        tasks.append(run_briefing())

        # Domain task (if enabled)
        if config.enable_domain:
            domain_pipeline = DomainPipeline(
                client=self._client,
                composer=self._composer
            )

            async def run_domain():
                return await domain_pipeline.run(doc)

            tasks.append(run_domain())

        # Run in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        briefing_result = results[0]
        if isinstance(briefing_result, Exception):
            raise briefing_result

        briefing, briefing_metrics = briefing_result
        all_metrics.append(briefing_metrics)

        # Domain result
        if config.enable_domain and len(results) > 1:
            domain_result = results[1]
            if isinstance(domain_result, Exception):
                # Domain failure is non-critical, use empty evidence
                evidence = EvidencePack.empty()
            else:
                evidence, domain_metrics = domain_result
                all_metrics.extend(domain_metrics)
        else:
            evidence = EvidencePack.empty()

        return briefing, evidence, all_metrics

    async def _run_phase2(
        self,
        doc: DocObj,
        briefing: BriefingOutput,
        config: ReviewConfig
    ) -> tuple[list[Finding], list[Finding], list[AgentMetrics]]:
        """
        Phase 2: Clarity + Rigor-Find in parallel.

        Returns:
            Tuple of (clarity_findings, rigor_findings, metrics)
        """
        all_metrics: list[AgentMetrics] = []

        clarity_agent = ClarityAgent(
            client=self._client,
            composer=self._composer
        )
        rigor_finder = RigorFinder(
            client=self._client,
            composer=self._composer
        )

        # Run in parallel
        results = await asyncio.gather(
            clarity_agent.run(
                doc,
                briefing=briefing,
                steering=config.steering_memo
            ),
            rigor_finder.run(
                doc,
                briefing=briefing,
                steering=config.steering_memo
            ),
            return_exceptions=True
        )

        # Process clarity result
        clarity_findings = []
        if isinstance(results[0], Exception):
            # Non-critical failure, continue without clarity
            pass
        else:
            clarity_findings, clarity_metrics = results[0]
            all_metrics.extend(clarity_metrics)

        # Process rigor result
        rigor_findings = []
        if isinstance(results[1], Exception):
            # Non-critical failure, continue without rigor
            pass
        else:
            rigor_findings, rigor_metrics = results[1]
            all_metrics.extend(rigor_metrics)

        return clarity_findings, rigor_findings, all_metrics

    async def _run_phase3(
        self,
        doc: DocObj,
        briefing: BriefingOutput,
        rigor_findings: list[Finding],
        evidence: EvidencePack,
        config: ReviewConfig
    ) -> tuple[list[Finding], list[Finding], list[AgentMetrics]]:
        """
        Phase 3: Rigor-Rewrite + Adversary in parallel.

        Returns:
            Tuple of (rewritten_findings, adversary_findings, metrics)
        """
        all_metrics: list[AgentMetrics] = []

        rigor_rewriter = RigorRewriter(
            client=self._client,
            composer=self._composer
        )
        adversary_agent = AdversaryAgent(
            panel_mode=config.panel_mode,
            client=self._client,
            composer=self._composer
        )

        # Run in parallel
        results = await asyncio.gather(
            rigor_rewriter.run(rigor_findings, doc),
            adversary_agent.run(
                doc,
                briefing=briefing,
                rigor_findings=rigor_findings,
                evidence=evidence,
                steering=config.steering_memo
            ),
            return_exceptions=True
        )

        # Process rigor rewrite result
        rewritten_findings = []
        if isinstance(results[0], Exception):
            # Non-critical, use original findings
            pass
        else:
            rewritten_findings, rewrite_metrics = results[0]
            all_metrics.extend(rewrite_metrics)

        # Process adversary result
        adversary_findings = []
        if isinstance(results[1], Exception):
            # Non-critical failure
            pass
        else:
            adversary_result = results[1]
            adversary_findings = adversary_result[0]

            # Adversary returns single metrics or list depending on mode
            adversary_metrics = adversary_result[1]
            if isinstance(adversary_metrics, list):
                all_metrics.extend(adversary_metrics)
            else:
                all_metrics.append(adversary_metrics)

        return rewritten_findings, adversary_findings, all_metrics
