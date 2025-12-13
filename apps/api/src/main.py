"""Main FastAPI application entry point"""

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer() if settings.log_format == "json"
        else structlog.dev.ConsoleRenderer(colors=True),
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
    docs_url=f"{settings.api_prefix}/docs" if settings.debug else None,
    redoc_url=f"{settings.api_prefix}/redoc" if settings.debug else None,
    openapi_url=f"{settings.api_prefix}/openapi.json" if settings.debug else None,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=settings.cors_allow_methods,
    allow_headers=settings.cors_allow_headers,
)


@app.on_event("startup")
async def startup_event():
    """Initialize application on startup"""
    logger.info(
        "application_started",
        app_name=settings.app_name,
        version=settings.app_version,
        debug=settings.debug,
        demo_mode=settings.demo_mode_default,
        has_perplexity=settings.has_perplexity,
    )

    # Create necessary directories
    import os
    for dir_path in [settings.upload_dir, settings.export_dir, settings.temp_dir]:
        os.makedirs(dir_path, exist_ok=True)
        logger.debug("directory_created", path=dir_path)


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up on application shutdown"""
    logger.info("application_shutdown")


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return JSONResponse(
        content={
            "status": "healthy",
            "version": settings.app_version,
            "demo_mode": settings.demo_mode_default,
        }
    )


# API info endpoint
@app.get(f"{settings.api_prefix}/info")
async def api_info():
    """Get API information"""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "api_prefix": settings.api_prefix,
        "features": {
            "demo_mode": settings.demo_mode_default,
            "perplexity_enabled": settings.has_perplexity,
            "max_document_size_mb": settings.max_document_size_mb,
            "max_concurrent_agents": settings.max_concurrent_agents,
        },
    }


# Placeholder for routers (to be added)
# from .routers import document, review, export
# app.include_router(document.router, prefix=f"{settings.api_prefix}/document", tags=["document"])
# app.include_router(review.router, prefix=f"{settings.api_prefix}/review", tags=["review"])
# app.include_router(export.router, prefix=f"{settings.api_prefix}/export", tags=["export"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
        workers=settings.workers if not settings.reload else 1,
        log_level=settings.log_level.lower(),
    )