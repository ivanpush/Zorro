"""
ZORRO API - FastAPI application entry point.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import review_router

app = FastAPI(
    title="ZORRO API",
    description="Multi-agent document review system",
    version="0.1.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(review_router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}
