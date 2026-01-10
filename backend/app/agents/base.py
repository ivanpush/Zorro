"""
Base agent abstract class.
All agents inherit from this and implement run().
"""

from abc import ABC, abstractmethod
from typing import Any

from app.core.llm import LLMClient, get_llm_client
from app.composer.builder import Composer


class BaseAgent(ABC):
    """
    Abstract base class for all agents.

    Provides:
    - LLM client access
    - Composer for prompt building
    - Abstract run() method
    """

    def __init__(self, client: LLMClient | None = None, composer: Composer | None = None):
        """
        Initialize agent with optional dependency injection.

        Args:
            client: LLM client (uses singleton if not provided)
            composer: Prompt composer (creates new if not provided)
        """
        self.client = client or get_llm_client()
        self.composer = composer or Composer()

    @property
    @abstractmethod
    def agent_id(self) -> str:
        """Return the agent identifier used for metrics and model lookup."""
        pass

    @abstractmethod
    async def run(self, *args: Any, **kwargs: Any) -> Any:
        """
        Execute the agent's main task.

        Returns:
            Tuple of (output, metrics) or (output, list[metrics]) for chunked agents
        """
        pass
