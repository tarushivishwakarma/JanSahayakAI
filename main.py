"""
JanSahayak FastAPI Backend
Main entry point — CORS enabled, modular routers
Run: uvicorn main:app --reload
"""

import os
import logging
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import applications, ocr, admin
from ai.router import router as llm_router
import firebase_service

logger = logging.getLogger("jansahayak.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Safely initialize services on startup."""
    try:
        firebase_service.init_firebase()
    except Exception as e:
        logger.error("Startup Firebase initialization error: %s", e)
    yield


app = FastAPI(
    title="JanSahayak API",
    description="Backend API for JanSahayak – Government Scheme Finder",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# ——— CORS — environment-driven origins (no wildcard '*') ———
raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "https://jansahayakai.web.app,https://jansahayakai.firebaseapp.com,http://localhost:5500,http://127.0.0.1:5500,http://localhost:3000,http://localhost:8080,http://127.0.0.1:8080"
)
allowed_origins = [
    origin.strip()
    for origin in raw_origins.split(",")
    if origin.strip() and origin.strip() != "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
)

# ——— Include routers ———
app.include_router(applications.router, prefix="/api", tags=["Applications"])
app.include_router(ocr.router, prefix="/api", tags=["OCR"])
app.include_router(admin.router, prefix="/api", tags=["Admin"])
app.include_router(llm_router, prefix="/api/llm", tags=["LLM"])


@app.get("/", tags=["Health"])
async def root():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "JanSahayak API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health", tags=["Health"])
async def health():
    """Simple health check"""
    return {"status": "healthy"}


@app.get("/api/schemes", tags=["Schemes"])
async def get_schemes():
    """Return the full schemes dataset (single source of truth — serves Firebase Hosting)"""
    path = os.path.join(os.path.dirname(__file__), "schemes.json")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="schemes.json not found")
    return FileResponse(path, media_type="application/json")


from schemas import SchemeEvaluationProfile, SchemeEvaluationResponse
from core.eligibility import evaluate_all_schemes


@app.post("/api/schemes/evaluate", response_model=SchemeEvaluationResponse, tags=["Schemes"])
async def evaluate_schemes(profile: SchemeEvaluationProfile):
    """
    Deterministically evaluates citizen profile against all 25 government schemes.
    Returns tri-state status (ELIGIBLE, INELIGIBLE, UNKNOWN) with itemized reasons.
    """
    try:
        return evaluate_all_schemes(profile)
    except Exception as e:
        logger.error("Scheme evaluation error: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail="Failed to evaluate scheme eligibility")

