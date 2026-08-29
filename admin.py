"""Admin router — Analytics and application management (admin-only)"""

from fastapi import APIRouter, HTTPException, Header
from typing import Optional
import os

from schemas import AnalyticsResponse, StatusUpdate
import firebase_service
from applications import _in_memory_store

router = APIRouter()

ADMIN_EMAILS = os.getenv("ADMIN_EMAILS", "admin@jansahayak.in,admin@test.com").split(",")


@router.get("/admin/applications", summary="Get all applications (admin only)")
async def get_all_applications(limit: int = 100):
    """
    Fetch all applications for admin review.
    In production, this should require admin JWT token verification.
    """
    try:
        apps = await firebase_service.get_all_applications(limit=limit)
        if apps:
            return {"applications": apps, "count": len(apps)}
    except Exception:
        pass

    # In-memory fallback
    apps = list(_in_memory_store.values())
    return {"applications": apps, "count": len(apps)}


@router.get("/admin/analytics", response_model=AnalyticsResponse, summary="Get analytics summary")
async def get_analytics():
    """
    Returns counts by status and by service type.
    """
    try:
        apps = await firebase_service.get_all_applications()
    except Exception:
        apps = list(_in_memory_store.values())

    total = len(apps)
    status_counts = {"submitted": 0, "reviewing": 0, "approved": 0, "rejected": 0}
    service_counts: dict = {}

    for app in apps:
        status = app.get("status", "submitted")
        if status in status_counts:
            status_counts[status] += 1

        service = app.get("serviceId", "unknown")
        service_counts[service] = service_counts.get(service, 0) + 1

    return AnalyticsResponse(
        total=total,
        submitted=status_counts["submitted"],
        reviewing=status_counts["reviewing"],
        approved=status_counts["approved"],
        rejected=status_counts["rejected"],
        by_service=service_counts
    )
