"""
Perplexity API client for domain validation searches.

This module provides an async client for the Perplexity API, used by
the Domain Validator agent to search for current information.
"""

import os
import asyncio
from typing import Optional, List
from datetime import datetime, timezone, timedelta

import httpx
import structlog
from pydantic import BaseModel, Field

from ..models.review import ReviewTier
from ..config import settings

logger = structlog.get_logger()


class PerplexityResponse(BaseModel):
    """Response model for Perplexity API searches."""
    answer: str = Field(description="The search result answer")
    citations: List[str] = Field(default_factory=list, description="List of source citations")
    confidence: float = Field(description="Confidence score derived from response", ge=0, le=1)


class PerplexityClient:
    """
    Async client for Perplexity API.

    Handles rate limiting, retries, and structured responses for
    domain-specific searches.
    """

    API_BASE_URL = "https://api.perplexity.ai"

    # Model selection based on tier
    MODELS = {
        ReviewTier.STANDARD: "llama-3.1-sonar-small-128k-online",
        ReviewTier.DEEP: "llama-3.1-sonar-large-128k-online"
    }

    # Rate limiting
    MAX_REQUESTS_PER_MINUTE = 20

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the Perplexity client.

        Args:
            api_key: API key (defaults to environment variable)
        """
        self.api_key = api_key or os.getenv('PERPLEXITY_API_KEY')
        if not self.api_key:
            raise ValueError("PERPLEXITY_API_KEY not found in environment")

        # HTTP client with timeout
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
        )

        # Rate limiting tracking
        self._request_times: List[datetime] = []
        self._rate_limit_lock = asyncio.Lock()

        logger.info("perplexity_client_initialized")

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit - close HTTP client."""
        await self.client.aclose()

    async def _enforce_rate_limit(self) -> None:
        """
        Enforce rate limiting by tracking request times.

        Delays if necessary to stay within rate limits.
        """
        async with self._rate_limit_lock:
            now = datetime.now(timezone.utc)

            # Remove requests older than 1 minute
            self._request_times = [
                t for t in self._request_times
                if now - t < timedelta(minutes=1)
            ]

            # If at limit, calculate wait time
            if len(self._request_times) >= self.MAX_REQUESTS_PER_MINUTE:
                oldest_request = self._request_times[0]
                wait_until = oldest_request + timedelta(minutes=1)
                if now < wait_until:
                    wait_seconds = (wait_until - now).total_seconds()
                    logger.warning(
                        "perplexity_rate_limit_delay",
                        wait_seconds=wait_seconds,
                        current_requests=len(self._request_times)
                    )
                    await asyncio.sleep(wait_seconds)
                    # Remove the oldest request after waiting
                    self._request_times.pop(0)

            # Record this request
            self._request_times.append(now)

    async def search_with_context(
        self,
        query: str,
        context: str,
        tier: ReviewTier = ReviewTier.STANDARD,
        max_tokens: int = 1024,
        max_retries: int = 3
    ) -> PerplexityResponse:
        """
        Search for information related to a query with document context.

        Args:
            query: The search query
            context: Document context to ground the search
            tier: Review tier for model selection
            max_tokens: Maximum tokens in response
            max_retries: Maximum retry attempts

        Returns:
            PerplexityResponse with search results and citations

        Raises:
            Exception: On API errors after retries exhausted
        """
        # Enforce rate limiting
        await self._enforce_rate_limit()

        model = self.MODELS[tier]

        # Construct the prompt
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a research assistant helping validate claims in academic documents. "
                    "Search for current information and provide citations for your findings."
                )
            },
            {
                "role": "user",
                "content": (
                    f"Document context:\n{context[:2000]}\n\n"  # Truncate context if too long
                    f"Query: {query}\n\n"
                    "Please search for relevant information and provide sources."
                )
            }
        ]

        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": 0.3,  # Lower temperature for factual searches
            "return_citations": True,
            "search_recency_filter": "year"  # Focus on recent information
        }

        start_time = datetime.now(timezone.utc)

        for attempt in range(max_retries):
            try:
                logger.info(
                    "perplexity_request_started",
                    model=model,
                    query_length=len(query),
                    attempt=attempt + 1
                )

                response = await self.client.post(
                    f"{self.API_BASE_URL}/chat/completions",
                    json=payload
                )

                if response.status_code == 200:
                    data = response.json()

                    # Extract response components
                    answer = data['choices'][0]['message']['content']
                    citations = data.get('citations', [])

                    # Derive confidence from response characteristics
                    confidence = self._calculate_confidence(answer, citations)

                    duration = (datetime.now(timezone.utc) - start_time).total_seconds()

                    logger.info(
                        "perplexity_request_completed",
                        model=model,
                        duration_seconds=duration,
                        citation_count=len(citations),
                        confidence=confidence
                    )

                    return PerplexityResponse(
                        answer=answer,
                        citations=citations,
                        confidence=confidence
                    )

                elif response.status_code == 429:
                    # Rate limit error
                    wait_time = min(2 ** attempt * 5, 60)
                    logger.warning(
                        "perplexity_rate_limited",
                        attempt=attempt + 1,
                        wait_seconds=wait_time
                    )
                    if attempt < max_retries - 1:
                        await asyncio.sleep(wait_time)
                        continue

                elif response.status_code in [500, 502, 503]:
                    # Server errors - retry with backoff
                    wait_time = 2 * (attempt + 1)
                    logger.warning(
                        "perplexity_server_error",
                        status_code=response.status_code,
                        attempt=attempt + 1,
                        wait_seconds=wait_time
                    )
                    if attempt < max_retries - 1:
                        await asyncio.sleep(wait_time)
                        continue

                else:
                    # Other errors
                    logger.error(
                        "perplexity_api_error",
                        status_code=response.status_code,
                        response=response.text
                    )
                    raise Exception(f"Perplexity API error: {response.status_code}")

            except httpx.TimeoutException:
                logger.warning(
                    "perplexity_timeout",
                    attempt=attempt + 1
                )
                if attempt < max_retries - 1:
                    await asyncio.sleep(2 * (attempt + 1))
                    continue
                raise

            except Exception as e:
                logger.error(
                    "perplexity_unexpected_error",
                    attempt=attempt + 1,
                    error=str(e)
                )
                if attempt >= max_retries - 1:
                    raise

        raise Exception(f"Failed after {max_retries} attempts")

    def _calculate_confidence(self, answer: str, citations: List[str]) -> float:
        """
        Calculate confidence score based on response characteristics.

        Args:
            answer: The answer text
            citations: List of citations

        Returns:
            Confidence score between 0 and 1
        """
        # Base confidence
        confidence = 0.5

        # Boost for citations
        if citations:
            confidence += min(len(citations) * 0.1, 0.3)

        # Boost for answer length (more detailed = more confident)
        if len(answer) > 500:
            confidence += 0.1
        elif len(answer) > 200:
            confidence += 0.05

        # Check for uncertainty markers
        uncertainty_markers = [
            "may", "might", "could", "possibly", "unclear",
            "uncertain", "appears", "seems", "suggests"
        ]
        uncertainty_count = sum(
            1 for marker in uncertainty_markers
            if marker in answer.lower()
        )
        confidence -= uncertainty_count * 0.05

        # Clamp to valid range
        return max(0.2, min(0.95, confidence))

    async def close(self) -> None:
        """Close the HTTP client."""
        await self.client.aclose()

    def get_stats(self) -> dict:
        """Get current client statistics."""
        now = datetime.now(timezone.utc)
        recent_requests = [
            t for t in self._request_times
            if now - t < timedelta(minutes=1)
        ]
        return {
            'requests_last_minute': len(recent_requests),
            'rate_limit': self.MAX_REQUESTS_PER_MINUTE
        }


# Global instance (optional, can be created per-use)
perplexity_client: Optional[PerplexityClient] = None


def get_perplexity_client() -> PerplexityClient:
    """Get or create the global Perplexity client."""
    global perplexity_client
    if perplexity_client is None:
        perplexity_client = PerplexityClient()
    return perplexity_client