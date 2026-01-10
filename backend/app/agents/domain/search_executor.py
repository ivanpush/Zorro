"""
Stage 3: Search Executor

Executes search queries using Perplexity API.
"""

from app.agents.base import BaseAgent
from app.models import QueryGeneratorOutput, SearchResult, SourceSnippet, AgentMetrics
from app.core.perplexity import get_perplexity_client


class SearchExecutor(BaseAgent):
    """
    Stage 3: Execute search queries via Perplexity.

    Takes generated queries and executes them using the Perplexity API
    to gather external evidence from the literature.
    """

    @property
    def agent_id(self) -> str:
        return "domain_search"

    async def run(
        self, query_output: QueryGeneratorOutput
    ) -> tuple[tuple[list[SearchResult], list[SourceSnippet]], list[AgentMetrics]]:
        """
        Execute search queries via Perplexity.

        Args:
            query_output: Generated queries from stage 2

        Returns:
            Tuple of ((list[SearchResult], list[SourceSnippet]), list[AgentMetrics])
        """
        # Get Perplexity client
        perplexity = get_perplexity_client()

        # Convert queries to format expected by perplexity client
        queries_to_execute = [
            (query.query_id, query.query_text)
            for query in query_output.queries
        ]

        # Execute searches
        results, snippets, metrics_list = await perplexity.search_batch(queries_to_execute)

        # Return results and metrics
        return (results, snippets), metrics_list
