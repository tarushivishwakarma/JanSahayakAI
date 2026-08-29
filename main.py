"""
JanSahayak FastAPI Backend
Main entry point — CORS enabled, modular routers
Run: uvicorn main:app --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import applications, ocr, admin
from ai import router as llm_router

app = FastAPI(
    title="JanSahayak API",
    description="Backend API for JanSahayak – Government Scheme Finder",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# ——— CORS — allow frontend origins ———
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",      # Live Server (VS Code)
        "http://127.0.0.1:5500",
        "http://localhost:3000",
        "https://jansahayak.vercel.app",  # Vercel deployment
        "*"  # Remove in production and list exact origins
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
