"""
Application settings using pydantic-settings.
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

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


# Singleton instance
settings = Settings()
