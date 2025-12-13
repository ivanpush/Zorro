"""Configuration settings from environment variables"""

from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # API Configuration
    app_name: str = "ZORRO Review API"
    app_version: str = "0.1.0"
    api_prefix: str = "/api/v1"
    debug: bool = False

    # Server Configuration
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = False
    workers: int = 1

    # CORS Configuration
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    cors_allow_credentials: bool = True
    cors_allow_methods: list[str] = ["*"]
    cors_allow_headers: list[str] = ["*"]

    # API Keys (Required)
    anthropic_api_key: str
    perplexity_api_key: str | None = None  # Optional for now

    # Model Configuration
    anthropic_model: str = "claude-3-5-sonnet-20241022"
    perplexity_model: str = "llama-3.1-sonar-large-128k-online"

    # Agent Configuration
    max_concurrent_agents: int = 4
    agent_timeout_seconds: int = 300  # 5 minutes per agent
    enable_structured_outputs: bool = True

    # Document Processing
    max_document_size_mb: int = 10
    max_pages: int = 100
    max_paragraphs: int = 1000

    # Demo Mode
    demo_mode_default: bool = False
    demo_fixtures_path: str = "fixtures"

    # Logging
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    log_format: Literal["json", "console"] = "json"
    log_file: str | None = None

    # Job Management
    job_retention_hours: int = 24  # How long to keep completed jobs in memory
    max_jobs_in_memory: int = 100

    # Rate Limiting (per minute)
    rate_limit_uploads: int = 10
    rate_limit_reviews: int = 20
    rate_limit_exports: int = 30

    # File Storage
    upload_dir: str = "uploads"
    export_dir: str = "exports"
    temp_dir: str = "temp"

    @property
    def has_perplexity(self) -> bool:
        """Check if Perplexity API is available"""
        return self.perplexity_api_key is not None

    @property
    def is_production(self) -> bool:
        """Check if running in production mode"""
        return not self.debug and not self.reload


# Global settings instance
settings = Settings()