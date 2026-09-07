"""Applications router — CRUD for government scheme applications"""

import os
import uuid
import logging
from datetime import datetime
from typing import Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Depends, status
from schemas import ApplicationCreate, ApplicationResponse, StatusUpdate
import firebase_service
from core.security import get_current_user, get_current_admin_user

router = APIRouter()
logger = logging.getLogger("jansahayak.applications")

# In-memory store (used as fallback when Firestore is not configured)
_in_memory_store: dict = {}


@router.post("/applications", response_model=dict, summary="Submit a new application")
async def create_application(
    application: ApplicationCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Submit a new government service application.
    Requires an authenticated Firebase user.
    Authoritative identity is derived strictly from verified token UID.
    """
    authenticated_uid = current_user["uid"]
    app_id = application.applicationId or f"APP-{uuid.uuid4().hex[:10].upper()}"

    data = {
        "applicationId": app_id,
        "serviceId": application.serviceId,
        "serviceName": application.serviceName,
        "formData": application.formData,
        "userId": authenticated_uid,  # Authoritative identity
        "userEmail": current_user.get("email") or application.userEmail or "",
        "status": "submitted",
        "submittedAt": datetime.utcnow().isoformat(),
    }

    doc_id = None
    try:
        doc_id = await firebase_service.create_application(data)
        data["id"] = doc_id
    except Exception as e:
        logger.error("Failed to save application to Firestore (%s). Falling back to in-memory store.", type(e).__name__)
        doc_id = str(uuid.uuid4())
        data["id"] = doc_id
        _in_memory_store[doc_id] = data

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
    Fetch a single application by its document ID.
    Requires ownership (application.userId == authenticated UID) or admin privileges.
    Fails closed with 404 to prevent ID enumeration.
    """
    app = None
    try:
        app = await firebase_service.get_application_by_id(app_id)
    except Exception as e:
        logger.error("Error retrieving application %s from Firestore: %s", app_id, type(e).__name__)

    # Check in-memory fallback
    if not app:
        if app_id in _in_memory_store:
            app = _in_memory_store[app_id]
        else:
            for doc_id, item in _in_memory_store.items():
                if item.get("applicationId") == app_id:
                    app = item
                    break

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
    Fetch all applications submitted by a specific user.
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

    apps = []
    try:
        apps = await firebase_service.get_user_applications(user_id)
    except Exception as e:
        logger.error("Error querying user applications from Firestore: %s", type(e).__name__)

    if not apps:
        apps = [a for a in _in_memory_store.values() if a.get("userId") == user_id]

    return {"applications": apps, "count": len(apps)}


@router.patch("/applications/{app_id}/status", summary="Update application status")
async def update_status(
    app_id: str,
    status_update: StatusUpdate,
    admin_user: Dict[str, Any] = Depends(get_current_admin_user)
):
    """
    Update the status of an application.
    Requires admin privileges.
    Valid statuses: submitted, reviewing, approved, rejected
    """
    updated = False
    try:
        updated = await firebase_service.update_application_status(app_id, status_update.status)
    except Exception as e:
        logger.error("Error updating status in Firestore for %s: %s", app_id, type(e).__name__)

    if updated:
        logger.info("Application %s status updated to '%s' by admin %s", app_id, status_update.status, admin_user["uid"][:8])
        return {"success": True, "status": status_update.status}

    # In-memory fallback
    if app_id in _in_memory_store:
        _in_memory_store[app_id]["status"] = status_update.status
        _in_memory_store[app_id]["updatedAt"] = datetime.utcnow().isoformat()
        return {"success": True, "status": status_update.status}

    for doc_id, app in _in_memory_store.items():
        if app.get("applicationId") == app_id:
            app["status"] = status_update.status
            app["updatedAt"] = datetime.utcnow().isoformat()
            return {"success": True, "status": status_update.status}

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
