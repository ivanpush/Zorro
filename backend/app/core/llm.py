"""
Instructor-wrapped LLM client with automatic metrics collection.

Features:
- Concurrency control (max 6 parallel calls)
- Retry with exponential backoff
- Timeout enforcement (120s default, configurable via LLM_TIMEOUT)
- Detailed logging
"""

import asyncio
import time
import logging
from functools import lru_cache
from typing import TypeVar, Type

import instructor
from anthropic import AsyncAnthropic, APIError, RateLimitError, APIConnectionError
from pydantic import BaseModel
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

from app.config import get_settings, get_model, calculate_cost
from app.models import AgentMetrics


T = TypeVar("T", bound=BaseModel)

# Module-level semaphore - initialized lazily from settings
_semaphore: asyncio.Semaphore | None = None


def _get_semaphore() -> asyncio.Semaphore:
    """Get or create semaphore from settings."""
    global _semaphore
    if _semaphore is None:
        from app.config import get_settings
        _semaphore = asyncio.Semaphore(get_settings().max_concurrent_agents)
    return _semaphore

# Logger
logger = logging.getLogger("zorro.llm")


class LLMTimeoutError(Exception):
    """Raised when an LLM call times out."""
    pass


class LLMClient:
    """
    LLM client wrapper that:
    1. Uses Instructor for structured outputs
    2. Automatically collects metrics (tokens, time, cost)
    3. Uses async client for true parallelism
    4. Limits concurrent calls (configurable via MAX_CONCURRENT_AGENTS)
    5. Retries transient failures with exponential backoff
    6. Enforces timeout (configurable via LLM_TIMEOUT, default 120s)
    """

    def __init__(self):
        settings = get_settings()
        self._anthropic = AsyncAnthropic(api_key=settings.anthropic_api_key)
        self._instructor = instructor.from_anthropic(self._anthropic)
        self._timeout = settings.llm_timeout  # configurable, default 120s
        self._debug = settings.llm_debug

    async def call(
        self,
        agent_id: str,
        system: str,
        user: str,
        response_model: Type[T],
        max_tokens: int = 4096,
        chunk_index: int | None = None,
        chunk_total: int | None = None,
    ) -> tuple[T, AgentMetrics]:
        """
        Make LLM call and return (response, metrics).

        Args:
            agent_id: Which agent is calling (for model lookup and metrics)
            system: System prompt
            user: User prompt
            response_model: Pydantic model for structured output
            max_tokens: Max output tokens
            chunk_index: Optional chunk index for parallelized agents
            chunk_total: Optional total chunks

        Returns:
            Tuple of (parsed response, metrics)
        """
        model = get_model(agent_id)

        async with _get_semaphore():
            start_time = time.perf_counter()

            # Debug: log full prompts
            if self._debug:
                logger.debug(f"[LLM DEBUG] agent={agent_id} system=\n{system[:500]}...")
                logger.debug(f"[LLM DEBUG] agent={agent_id} user=\n{user[:500]}...")

            try:
                response = await asyncio.wait_for(
                    self._make_call_with_retry(
                        model=model,
                        system=system,
                        user=user,
                        response_model=response_model,
                        max_tokens=max_tokens,
                    ),
                    timeout=self._timeout,
                )
            except asyncio.TimeoutError:
                logger.error(f"LLM call timed out: agent={agent_id} model={model} timeout={self._timeout}s")
                raise LLMTimeoutError(f"LLM call timed out after {self._timeout}s for agent {agent_id}")

            elapsed_ms = (time.perf_counter() - start_time) * 1000

            # Extract token usage from the raw response
            raw = getattr(response, '_raw_response', None)
            if raw is not None and hasattr(raw, 'usage'):
                input_tokens = raw.usage.input_tokens
                output_tokens = raw.usage.output_tokens
            else:
                # Fallback: rough estimate (4 chars per token)
                input_tokens = (len(system) + len(user)) // 4
                output_tokens = max_tokens // 4

            cost = calculate_cost(model, input_tokens, output_tokens)

            metrics = AgentMetrics(
                agent_id=agent_id,
                model=model,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                time_ms=elapsed_ms,
                cost_usd=cost,
                chunk_index=chunk_index,
                chunk_total=chunk_total,
            )

            # Log successful call
            chunk_info = f" chunk={chunk_index}/{chunk_total}" if chunk_index is not None else ""
            logger.info(
                f"LLM call: agent={agent_id} model={model}{chunk_info} "
                f"in={input_tokens} out={output_tokens} "
                f"time={elapsed_ms:.0f}ms cost=${cost:.4f}"
            )

            return response, metrics

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((APIError, RateLimitError, APIConnectionError)),
        before_sleep=before_sleep_log(logger, logging.WARNING),
    )
    async def _make_call_with_retry(
        self,
        model: str,
        system: str,
        user: str,
        response_model: Type[T],
        max_tokens: int,
    ) -> T:
        """Internal method with retry decorator."""
        return await self._instructor.messages.create(
            model=model,
            max_tokens=max_tokens,
            temperature=0,
            system=system,
            messages=[{"role": "user", "content": user}],
            response_model=response_model,
        )

    async def call_raw(
        self,
        agent_id: str,
        system: str,
        user: str,
        max_tokens: int = 4096,
    ) -> tuple[str, AgentMetrics]:
        """
        Make LLM call without structured output.
        Returns raw text response.
        """
        model = get_model(agent_id)

        async with _get_semaphore():
            start_time = time.perf_counter()

            try:
                response = await asyncio.wait_for(
                    self._make_raw_call_with_retry(
                        model=model,
                        system=system,
                        user=user,
                        max_tokens=max_tokens,
                    ),
                    timeout=self._timeout,
                )
            except asyncio.TimeoutError:
                logger.error(f"LLM raw call timed out: agent={agent_id} model={model}")
                raise LLMTimeoutError(f"LLM call timed out after {self._timeout}s for agent {agent_id}")

            elapsed_ms = (time.perf_counter() - start_time) * 1000

            input_tokens = response.usage.input_tokens
            output_tokens = response.usage.output_tokens
            cost = calculate_cost(model, input_tokens, output_tokens)

            metrics = AgentMetrics(
                agent_id=agent_id,
                model=model,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                time_ms=elapsed_ms,
                cost_usd=cost,
            )

            logger.info(
                f"LLM raw call: agent={agent_id} model={model} "
                f"in={input_tokens} out={output_tokens} "
                f"time={elapsed_ms:.0f}ms cost=${cost:.4f}"
            )

            text = response.content[0].text if response.content else ""
            return text, metrics

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((APIError, RateLimitError, APIConnectionError)),
        before_sleep=before_sleep_log(logger, logging.WARNING),
    )
    async def _make_raw_call_with_retry(
        self,
        model: str,
        system: str,
        user: str,
        max_tokens: int,
    ):
        """Internal raw call method with retry decorator."""
        return await self._anthropic.messages.create(
            model=model,
            max_tokens=max_tokens,
            temperature=0,
            system=system,
            messages=[{"role": "user", "content": user}],
        )


@lru_cache()
def get_llm_client() -> LLMClient:
    """Get cached LLM client instance."""
    return LLMClient()
