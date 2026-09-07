"""Applications router — CRUD for government scheme applications"""

from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from datetime import datetime
import uuid

from schemas import ApplicationCreate, ApplicationResponse, StatusUpdate
import firebase_service

router = APIRouter()

# In-memory store (used as fallback when Firestore is not configured)
_in_memory_store: dict = {}


@router.post("/applications", response_model=dict, summary="Submit a new application")
async def create_application(
    application: ApplicationCreate,
    x_user_id: Optional[str] = Header(None)
):
    """
    Submit a new government service application.
    Saves to Firestore if configured, otherwise to in-memory store.
    """
    app_id = application.applicationId or f"APP-{uuid.uuid4().hex[:10].upper()}"
    
    data = {
        "applicationId": app_id,
        "serviceId": application.serviceId,
        "serviceName": application.serviceName,
        "formData": application.formData,
        "userId": application.userId or x_user_id or "anonymous",
        "userEmail": application.userEmail or "",
        "status": "submitted",
        "submittedAt": datetime.utcnow().isoformat(),
    }

    try:
        doc_id = await firebase_service.create_application(data)
        data["id"] = doc_id
    except Exception:
        # Fallback to in-memory
        doc_id = str(uuid.uuid4())
        data["id"] = doc_id
        _in_memory_store[doc_id] = data

    return {
        "success": True,
        "application_id": app_id,
        "id": doc_id,
        "status": "submitted",
        "message": "Application submitted successfully"
    }


@router.get("/applications/{app_id}", summary="Get application by ID")
async def get_application(app_id: str):
    """Fetch a single application by its document ID"""
    try:
        app = await firebase_service.get_application_by_id(app_id)
        if app:
            return app
    except Exception:
        pass

    # Check in-memory
    if app_id in _in_memory_store:
        return _in_memory_store[app_id]

    raise HTTPException(status_code=404, detail="Application not found")


@router.get("/applications/user/{user_id}", summary="Get all applications for a user")
async def get_user_applications(user_id: str, x_user_id: Optional[str] = Header(None)):
    """
    Fetch all applications submitted by a specific user.
    Only the user themselves (or admin) should call this endpoint.
    """
    try:
        apps = await firebase_service.get_user_applications(user_id)
        if apps:
            return {"applications": apps, "count": len(apps)}
    except Exception:
        pass

    # In-memory fallback
    apps = [a for a in _in_memory_store.values() if a.get("userId") == user_id]
    return {"applications": apps, "count": len(apps)}


@router.patch("/applications/{app_id}/status", summary="Update application status")
async def update_status(app_id: str, status_update: StatusUpdate):
    """
    Update the status of an application.
    Valid statuses: submitted, reviewing, approved, rejected
    """
    try:
        success = await firebase_service.update_application_status(app_id, status_update.status)
        if success:
            return {"success": True, "status": status_update.status}
    except Exception:
        pass

    # In-memory fallback
    if app_id in _in_memory_store:
        _in_memory_store[app_id]["status"] = status_update.status
        _in_memory_store[app_id]["updatedAt"] = datetime.utcnow().isoformat()
        return {"success": True, "status": status_update.status}

    # Also check by applicationId
    for doc_id, app in _in_memory_store.items():
        if app.get("applicationId") == app_id:
            app["status"] = status_update.status
            return {"success": True, "status": status_update.status}

    raise HTTPException(status_code=404, detail="Application not found")
