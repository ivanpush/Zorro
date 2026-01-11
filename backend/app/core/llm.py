"""
Instructor-wrapped LLM client with automatic metrics collection.
"""

import time
from functools import lru_cache
from typing import TypeVar, Type

import instructor
from anthropic import AsyncAnthropic
from pydantic import BaseModel

from app.config import get_settings, get_model, calculate_cost
from app.models import AgentMetrics


T = TypeVar("T", bound=BaseModel)


class LLMClient:
    """
    LLM client wrapper that:
    1. Uses Instructor for structured outputs
    2. Automatically collects metrics (tokens, time, cost)
    3. Uses async client for true parallelism
    """

    def __init__(self):
        settings = get_settings()
        self._anthropic = AsyncAnthropic(api_key=settings.anthropic_api_key)
        self._instructor = instructor.from_anthropic(self._anthropic)

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

        start_time = time.perf_counter()

        # Make the call with Instructor (async)
        response = await self._instructor.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
            response_model=response_model,
        )

        elapsed_ms = (time.perf_counter() - start_time) * 1000

        # Extract token usage from the raw response
        # Instructor attaches _raw_response which is an Anthropic Message object
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

        return response, metrics

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

        start_time = time.perf_counter()

        response = await self._anthropic.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )

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

        text = response.content[0].text if response.content else ""
        return text, metrics


@lru_cache()
def get_llm_client() -> LLMClient:
    """Get cached LLM client instance."""
    return LLMClient()
