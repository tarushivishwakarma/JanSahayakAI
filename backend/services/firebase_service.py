"""
Firebase Admin SDK service — Firestore CRUD operations
Initializes Firebase Admin once and provides helper functions.
"""

import os
import json
from datetime import datetime
from typing import Optional, List, Dict, Any

# Lazy import to avoid hard failure if firebase-admin is not installed
try:
    import firebase_admin
    from firebase_admin import credentials, firestore as fs
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False
    print("⚠️  firebase-admin not installed. Install with: pip install firebase-admin")

_db = None  # Firestore client singleton


def init_firebase():
    """Initialize Firebase Admin SDK (call once on startup)"""
    global _db

    if not FIREBASE_AVAILABLE:
        return False

    if firebase_admin._apps:
        _db = fs.client()
        return True

    # Try JSON file path first
    sa_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "")
    sa_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "")

    try:
        if sa_path and os.path.exists(sa_path):
            cred = credentials.Certificate(sa_path)
        elif sa_json:
            sa_dict = json.loads(sa_json)
            cred = credentials.Certificate(sa_dict)
        else:
            print("WARNING: Firebase credentials not configured. Running without Firestore.")
            return False

        firebase_admin.initialize_app(cred)
        _db = fs.client()
        print("Firebase Admin initialized")
        return True

    except Exception as e:
        print(f"WARNING: Firebase init failed: {e}")
        return False


def get_db():
    """Get Firestore client"""
    return _db


# ——— Applications Collection ———

async def create_application(data: Dict[str, Any]) -> str:
    """Save a new application to Firestore, return document ID"""
    if not _db:
        raise RuntimeError("Firestore not available")
    doc_ref = _db.collection("applications").document()
    data["createdAt"] = datetime.utcnow()
    data["updatedAt"] = datetime.utcnow()
    doc_ref.set(data)
    return doc_ref.id


async def get_application_by_id(app_id: str) -> Optional[Dict]:
    """Fetch a single application by Firestore document ID"""
    if not _db:
        return None
    doc = _db.collection("applications").document(app_id).get()
    if doc.exists:
        return {"id": doc.id, **doc.to_dict()}
    return None


async def get_user_applications(user_id: str) -> List[Dict]:
    """Fetch all applications for a given user"""
    if not _db:
        return []
    docs = (
        _db.collection("applications")
        .where("userId", "==", user_id)
        .order_by("submittedAt", direction=fs.Query.DESCENDING)
        .limit(50)
        .stream()
    )
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]


async def get_all_applications(limit: int = 100) -> List[Dict]:
    """Fetch all applications (admin only)"""
    if not _db:
        return []
    docs = (
        _db.collection("applications")
        .order_by("submittedAt", direction=fs.Query.DESCENDING)
        .limit(limit)
        .stream()
    )
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]


async def update_application_status(app_id: str, status: str) -> bool:
    """Update the status of an application"""
    if not _db:
        return False
    try:
        _db.collection("applications").document(app_id).update({
            "status": status,
            "updatedAt": datetime.utcnow()
        })
        return True
    except Exception as e:
        print(f"Error updating status: {e}")
        return False
