"""Admin router — Analytics and application management (admin-only)"""

import logging
from typing import Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from schemas import AnalyticsResponse
import firebase_service
from core.security import get_current_admin_user

router = APIRouter()
logger = logging.getLogger("jansahayak.admin")


@router.get("/admin/applications", summary="Get all applications (admin only)")
async def get_all_applications(
    limit: int = 100,
    admin_user: Dict[str, Any] = Depends(get_current_admin_user)
):
    """
    Fetch all applications for admin review from authoritative Firestore.
    Requires verified admin privileges.
    Fails closed with HTTP 503 if Firestore is unreachable.
    """
    logger.info("Admin %s accessed all applications (limit=%d)", admin_user["uid"][:8], limit)
    try:
        apps = await firebase_service.get_all_applications(limit=limit)
        return {"applications": apps, "count": len(apps)}
    except Exception as e:
        logger.error("Error retrieving admin applications from Firestore: %s", type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable"
        )


@router.get("/admin/analytics", response_model=AnalyticsResponse, summary="Get analytics summary")
async def get_analytics(
    admin_user: Dict[str, Any] = Depends(get_current_admin_user)
):
    """
    Returns counts by status and by service type from authoritative Firestore.
    Requires verified admin privileges.
    Fails closed with HTTP 503 if Firestore is unreachable.
    """
    logger.info("Admin %s accessed analytics summary", admin_user["uid"][:8])
    try:
        apps = await firebase_service.get_all_applications()
    except Exception as e:
        logger.error("Error retrieving analytics from Firestore: %s", type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable"
        )

    total = len(apps)
    status_counts = {"submitted": 0, "reviewing": 0, "approved": 0, "rejected": 0}
    service_counts: dict = {}

    for app in apps:
        status_val = app.get("status", "submitted")
        if status_val in status_counts:
            status_counts[status_val] += 1

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
