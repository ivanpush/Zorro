"""
Application settings using pydantic-settings.

Agent toggles allow testing individual agents:
  ENABLE_BRIEFING=true
  ENABLE_CLARITY=false  # Skip clarity for faster testing
  etc.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    # API Keys
    anthropic_api_key: str = ""
    perplexity_api_key: str = ""

    # App config
    debug: bool = False
    log_level: str = "INFO"

    # Demo mode
    demo_mode_default: bool = True

    # Concurrency
    max_concurrent_agents: int = 4

    # Chunking - smaller = more parallelism = faster
    DEFAULT_CHUNK_WORDS: int = 400
    CONTEXT_OVERLAP_SENTENCES: int = 3

    # ===========================================
    # Agent Toggles - set to False to skip agent
    # ===========================================
    enable_briefing: bool = True    # Always needed for other agents
    enable_clarity: bool = True     # Clarity inspector
    enable_rigor: bool = True       # Rigor finder + rewriter
    enable_domain: bool = True      # Domain validation (Perplexity)
    enable_adversary: bool = True   # Adversarial critic

    # ===========================================
    # Debug Settings
    # ===========================================
    llm_debug: bool = False         # Log full prompts/responses
    debug_dump: bool = False        # Save intermediate outputs to JSON files

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


# Singleton instance
settings = Settings()
