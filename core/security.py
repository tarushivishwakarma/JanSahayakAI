"""
Centralized Security and Authentication Dependencies for JanSahayakAI.
Provides Firebase ID token verification, role-based admin authorization,
and in-memory thread-safe rate limiting.
"""

import os
import time
import logging
import threading
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv

load_dotenv()

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger("jansahayak.security")

# Reusable security scheme (auto_error=False allows structured custom 401 handling)
security_scheme = HTTPBearer(auto_error=False)

def get_admin_emails() -> List[str]:
    """Load and normalize admin emails from environment."""
    raw = os.getenv("ADMIN_EMAILS", "admin@jansahayak.in,admin@test.com")
    return [e.strip().lower() for e in raw.split(",") if e.strip()]


def sanitize_url(url: Optional[str]) -> str:
    """
    Centralized Safe URL Sanitizer.
    Allows only http:// and https:// URLs.
    Rejects javascript:, data:, vbscript:, malformed schemes.
    Returns '#' if unsafe or invalid.
    """
    if not url or not isinstance(url, str):
        return "#"
    trimmed = url.strip()
    lower = trimmed.lower()
    if lower.startswith(("javascript:", "data:", "vbscript:", "file:", "blob:")):
        return "#"
    try:
        from urllib.parse import urlparse
        parsed = urlparse(trimmed)
        if parsed.scheme in ("http", "https") and parsed.netloc:
            return trimmed
        if trimmed.startswith("/") and not trimmed.startswith("//"):
            return trimmed
    except Exception:
        return "#"
    return "#"


class SlidingWindowRateLimiter:
    """Thread-safe in-memory sliding window rate limiter per user key."""

    def __init__(self):
        self._lock = threading.Lock()
        self._requests: Dict[str, List[float]] = {}

    def check_rate_limit(self, key: str, max_requests: int = 15, window_seconds: int = 60) -> None:
        """
        Enforces a sliding window rate limit.
        Raises HTTP 429 when the limit is exceeded.
        """
        now = time.time()
        with self._lock:
            timestamps = self._requests.get(key, [])
            # Prune records outside the sliding window
            valid_timestamps = [t for t in timestamps if t > now - window_seconds]

            if len(valid_timestamps) >= max_requests:
                oldest = valid_timestamps[0]
                retry_after = max(1, int(window_seconds - (now - oldest)))
                self._requests[key] = valid_timestamps
                logger.warning(
                    "Rate limit exceeded for user %s (%d requests in %ds, retry after %ds)",
                    key[:8] if len(key) >= 8 else key,
                    len(valid_timestamps),
                    window_seconds,
                    retry_after
                )
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded. Maximum {max_requests} requests per {window_seconds}s. Please wait {retry_after}s before retrying.",
                    headers={"Retry-After": str(retry_after)}
                )

            valid_timestamps.append(now)
            self._requests[key] = valid_timestamps


# Global rate limiter instance for LLM requests
llm_rate_limiter = SlidingWindowRateLimiter()


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme)
) -> Dict[str, Any]:
    """
    Validates Firebase ID token from 'Authorization: Bearer <token>' header.
    Returns normalized dictionary with authoritative user identity:
    {
        'uid': str,
        'email': str,
        'name': str,
        'claims': dict,
        'is_admin': bool
    }
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required: Missing Authorization Bearer token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if not credentials.scheme or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required: Invalid authentication scheme, Bearer required",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = credentials.credentials
    if not token or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required: Empty token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Verify token with Firebase Admin SDK
    try:
        import firebase_admin
        from firebase_admin import auth as fb_auth
    except ImportError:
        logger.error("firebase-admin package is not installed.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable"
        )

    if not firebase_admin._apps:
        # Attempt deferred initialization
        try:
            import firebase_service
            firebase_service.init_firebase()
        except Exception as e:
            logger.error("Deferred Firebase initialization failed: %s", e)

        if not firebase_admin._apps:
            logger.error("Firebase Admin SDK is not initialized; cannot verify token.")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service unavailable"
            )

    try:
        decoded_token = fb_auth.verify_id_token(token)
    except Exception as e:
        logger.warning("Token verification failed: %s", type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    uid = decoded_token.get("uid")
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing subject identifier",
            headers={"WWW-Authenticate": "Bearer"}
        )

    email = (decoded_token.get("email") or "").lower()
    admin_emails = get_admin_emails()
    is_admin = bool(
        decoded_token.get("admin") is True or
        (email and email in admin_emails)
    )

    return {
        "uid": uid,
        "email": email,
        "name": decoded_token.get("name", ""),
        "claims": decoded_token,
        "is_admin": is_admin
    }


async def get_current_admin_user(
    user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Validates that the authenticated user possesses administrative privileges.
    Fails closed with HTTP 403 if the user is not an admin.
    """
    if not user.get("is_admin"):
        logger.warning("Admin access denied for authenticated user UID %s", user.get("uid", "")[:8])
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin authorization required"
        )
    return user


def check_llm_rate_limit(user: Dict[str, Any] = Depends(get_current_user)) -> None:
    """Dependency that enforces per-user rate limit (15 req/min) for LLM chat."""
    llm_rate_limiter.check_rate_limit(key=user["uid"], max_requests=15, window_seconds=60)
