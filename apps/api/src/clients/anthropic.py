"""
Anthropic API client wrapper with structured outputs.

This module provides a wrapper around the Anthropic SDK with support for
structured outputs using Instructor, retry logic, and model selection.
"""

import asyncio
import os
from typing import Type, TypeVar, Optional, Any, Dict, List
from datetime import datetime, timezone

import structlog
from anthropic import AsyncAnthropic
from pydantic import BaseModel
import instructor

from ..models.review import ReviewTier, AgentId
from ..config import settings

logger = structlog.get_logger()

T = TypeVar('T', bound=BaseModel)


class AnthropicClient:
    """
    Wrapper around Anthropic SDK with structured output support.

    Uses Instructor for reliable JSON schema enforcement and includes
    retry logic for rate limits and transient errors.
    """

    # Model mapping
    MODELS = {
        'haiku': 'claude-3-5-haiku-20241022',
        'sonnet': 'claude-3-5-sonnet-20241022',
        'opus': 'claude-3-opus-20240229'
    }

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the Anthropic client.

        Args:
            api_key: API key (defaults to environment variable)
        """
        api_key = api_key or os.getenv('ANTHROPIC_API_KEY')
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not found in environment")

        # Initialize base client
        base_client = AsyncAnthropic(api_key=api_key)

        # Wrap with Instructor for structured outputs
        self.client = instructor.from_anthropic(base_client)

        logger.info("anthropic_client_initialized")

    def get_model_for_agent(self, agent_id: AgentId, tier: ReviewTier) -> str:
        """
        Get the appropriate model for an agent based on tier.

        Args:
            agent_id: The agent identifier
            tier: The review tier (standard or deep)

        Returns:
            Model string for use with Anthropic API
        """
        if tier == ReviewTier.STANDARD:
            # Standard tier: Haiku for clarity, Sonnet for others
            if agent_id == AgentId.CLARITY:
                model = self.MODELS['haiku']
            else:
                model = self.MODELS['sonnet']
        else:
            # Deep tier: Sonnet for clarity, Opus for others
            if agent_id == AgentId.CLARITY:
                model = self.MODELS['sonnet']
            else:
                model = self.MODELS['opus']

        logger.debug(
            "model_selected",
            agent_id=agent_id.value,
            tier=tier.value,
            model=model
        )
        return model

    async def complete_structured(
        self,
        model: str,
        system: str,
        messages: List[Dict[str, Any]],
        response_model: Type[T],
        max_tokens: int = 4096,
        temperature: float = 0.7,
        max_retries: int = 3
    ) -> T:
        """
        Make a completion request and parse into a Pydantic model.

        Uses Instructor to enforce JSON schema via tool use.

        Args:
            model: Model name (use MODELS constants or get_model_for_agent)
            system: System prompt
            messages: Message history
            response_model: Pydantic model class for response
            max_tokens: Maximum tokens in response
            temperature: Sampling temperature (0-1)
            max_retries: Maximum retry attempts

        Returns:
            Parsed response as instance of response_model

        Raises:
            Exception: On API errors after retries exhausted
        """
        start_time = datetime.now(timezone.utc)

        for attempt in range(max_retries):
            try:
                logger.info(
                    "anthropic_request_started",
                    model=model,
                    response_model=response_model.__name__,
                    attempt=attempt + 1,
                    max_tokens=max_tokens
                )

                # Make request using Instructor
                response = await self.client.messages.create(
                    model=model,
                    system=system,
                    messages=messages,
                    response_model=response_model,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    max_retries=1  # Let us handle retries
                )

                # Calculate metrics
                duration = (datetime.now(timezone.utc) - start_time).total_seconds()

                logger.info(
                    "anthropic_request_completed",
                    model=model,
                    response_model=response_model.__name__,
                    duration_seconds=duration,
                    attempt=attempt + 1
                )

                return response

            except Exception as e:
                error_message = str(e)

                # Check for rate limit error
                if '429' in error_message or 'rate_limit' in error_message.lower():
                    wait_time = min(2 ** attempt, 60)  # Exponential backoff, max 60s
                    logger.warning(
                        "anthropic_rate_limited",
                        attempt=attempt + 1,
                        wait_seconds=wait_time,
                        error=error_message
                    )
                    if attempt < max_retries - 1:
                        await asyncio.sleep(wait_time)
                        continue

                # Check for transient errors
                elif any(code in error_message for code in ['500', '502', '503']):
                    wait_time = 2 * (attempt + 1)
                    logger.warning(
                        "anthropic_transient_error",
                        attempt=attempt + 1,
                        wait_seconds=wait_time,
                        error=error_message
                    )
                    if attempt < max_retries - 1:
                        await asyncio.sleep(wait_time)
                        continue

                # Bad request - don't retry
                elif '400' in error_message:
                    logger.error(
                        "anthropic_bad_request",
                        model=model,
                        error=error_message
                    )
                    raise

                # Unknown error
                else:
                    logger.error(
                        "anthropic_unknown_error",
                        attempt=attempt + 1,
                        error=error_message
                    )
                    if attempt >= max_retries - 1:
                        raise

        # Should not reach here
        raise Exception(f"Failed after {max_retries} attempts")

    async def complete_structured_safe(
        self,
        model: str,
        system: str,
        messages: List[Dict[str, Any]],
        response_model: Type[T],
        max_tokens: int = 4096,
        temperature: float = 0.7
    ) -> Optional[T]:
        """
        Safe version of complete_structured that returns None on failure.

        Useful for non-critical completions where failure is acceptable.

        Args:
            Same as complete_structured

        Returns:
            Parsed response or None if failed
        """
        try:
            return await self.complete_structured(
                model=model,
                system=system,
                messages=messages,
                response_model=response_model,
                max_tokens=max_tokens,
                temperature=temperature
            )
        except Exception as e:
            logger.error(
                "anthropic_safe_completion_failed",
                model=model,
                response_model=response_model.__name__,
                error=str(e)
            )
            return None

    @staticmethod
    def estimate_tokens(text: str) -> int:
        """
        Rough token estimate for text.

        Uses approximation of 4 characters per token.

        Args:
            text: Input text

        Returns:
            Estimated token count
        """
        return len(text) // 4

    async def check_context_window(
        self,
        model: str,
        system: str,
        messages: List[Dict[str, Any]]
    ) -> bool:
        """
        Check if content fits within model's context window.

        Args:
            model: Model name
            system: System prompt
            messages: Message history

        Returns:
            True if within limits, False otherwise
        """
        # Context window sizes (conservative estimates)
        context_limits = {
            self.MODELS['haiku']: 180000,   # 200k actual
            self.MODELS['sonnet']: 180000,  # 200k actual
            self.MODELS['opus']: 180000     # 200k actual
        }

        limit = context_limits.get(model, 100000)

        # Estimate total tokens
        total_text = system + ' '.join(
            msg.get('content', '') for msg in messages
        )
        estimated_tokens = self.estimate_tokens(total_text)

        within_limit = estimated_tokens < limit

        if not within_limit:
            logger.warning(
                "context_window_exceeded",
                model=model,
                estimated_tokens=estimated_tokens,
                limit=limit
            )

        return within_limit


# Global instance (will be initialized with settings)
anthropic_client: Optional[AnthropicClient] = None


def get_anthropic_client() -> AnthropicClient:
    """Get or create the global Anthropic client."""
    global anthropic_client
    if anthropic_client is None:
        anthropic_client = AnthropicClient()
    return anthropic_client