"""
Applications router — Citizen application submission, tracking, and status management.
Uses authoritative Firestore persistence only. Misleading in-memory fallbacks are eliminated.
"""

import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List

from fastapi import APIRouter, HTTPException, status, Depends
from schemas import ApplicationCreate, StatusUpdate
import firebase_service
from core.security import get_current_user, get_current_admin_user

router = APIRouter()
logger = logging.getLogger("jansahayak.applications")


@router.post("/applications", response_model=dict, summary="Submit a new application")
async def create_application(
    application: ApplicationCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Submit a new government service application.
    Requires an authenticated Firebase user.
    Authoritative identity is derived strictly from verified token UID.
    Saves strictly to authoritative Firestore; fails closed with HTTP 503 if unavailable.
    """
    authenticated_uid = current_user["uid"]
    app_id = application.applicationId or f"APP-{uuid.uuid4().hex[:10].upper()}"
    now_iso = datetime.now(timezone.utc).isoformat()

    data = {
        "applicationId": app_id,
        "serviceId": application.serviceId,
        "serviceName": application.serviceName,
        "formData": application.formData,
        "userId": authenticated_uid,  # Authoritative identity from token
        "userEmail": current_user.get("email") or application.userEmail or "",
        "status": "submitted",
        "submittedAt": now_iso,
    }

    try:
        doc_id = await firebase_service.create_application(data)
        data["id"] = doc_id
    except Exception as e:
        logger.error("Failed to save application to authoritative Firestore: %s", type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Application submission service temporarily unavailable. Could not save to authoritative database. Please retry."
        )

    logger.info("Application submitted successfully: %s by user %s", app_id, authenticated_uid[:8])
    return {
        "success": True,
        "application_id": app_id,
        "id": doc_id,
        "status": "submitted",
        "message": "Application submitted successfully"
    }


@router.get("/applications/{app_id}", summary="Get application by ID")
async def get_application(
    app_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Fetch a single application by its document ID or citizen applicationId.
    Requires ownership (application.userId == authenticated UID) or admin privileges.
    Fails closed with 404 to prevent ID enumeration.
    """
    try:
        app = await firebase_service.get_application_by_id(app_id)
    except Exception as e:
        logger.error("Error retrieving application %s from Firestore: %s", app_id, type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable"
        )

    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    # Enforce ownership or admin
    is_owner = app.get("userId") == current_user["uid"]
    is_admin = current_user.get("is_admin", False)

    if not (is_owner or is_admin):
        logger.warning(
            "Unauthorized access attempt to application %s by user %s",
            app_id,
            current_user["uid"][:8]
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    return app


@router.get("/applications/user/{user_id}", summary="Get all applications for a user")
async def get_user_applications(
    user_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Fetch all applications submitted by a specific user from authoritative Firestore.
    Only the user themselves or an admin can access this endpoint.
    """
    is_owner = user_id == current_user["uid"]
    is_admin = current_user.get("is_admin", False)

    if not (is_owner or is_admin):
        logger.warning(
            "Forbidden access: User %s attempted to read applications of user %s",
            current_user["uid"][:8],
            user_id[:8]
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Cannot access applications of another user"
        )

    try:
        apps = await firebase_service.get_user_applications(user_id)
    except Exception as e:
        logger.error("Error querying user applications from Firestore: %s", type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable"
        )

    return {"applications": apps, "count": len(apps)}


@router.patch("/applications/{app_id}/status", summary="Update application status")
async def update_status(
    app_id: str,
    status_update: StatusUpdate,
    admin_user: Dict[str, Any] = Depends(get_current_admin_user)
):
    """
    Update the status of an application in authoritative Firestore.
    Requires admin privileges.
    Valid statuses: submitted, reviewing, approved, rejected
    """
    try:
        updated = await firebase_service.update_application_status(app_id, status_update.status)
    except Exception as e:
        logger.error("Error updating status in Firestore for %s: %s", app_id, type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable"
        )

    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    logger.info("Application %s status updated to '%s' by admin %s", app_id, status_update.status, admin_user["uid"][:8])
    return {"success": True, "status": status_update.status}
