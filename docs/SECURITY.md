# Security Model

## Authentication

All protected endpoints require a Firebase ID Token in the `Authorization: Bearer <token>` header.

### How It Works

1. Citizen signs in via Firebase (Google OAuth or anonymous)
2. Firebase issues a signed JWT (ID Token, valid 1 hour)
3. Frontend uses `authFetch()` (in `utils.js`) which automatically injects the token
4. Backend verifies the token using `firebase-admin` SDK (`fb_auth.verify_id_token()`)
5. Token expiry is handled by Firebase SDK on the frontend (auto-refresh)

### What Cannot Happen

- A client cannot forge a Firebase ID Token — they are RSA-signed by Google
- A client cannot promote themselves to admin by sending a modified token
- Anonymous users can use the chatbot but cannot submit applications or view tracker without explicit identity

## Authorization

### Application Ownership

Every application stored in Firestore has a `userId` field set to the **token UID** (server-side, never from client payload):

```python
authenticated_uid = current_user["uid"]  # From verified token
data["userId"] = authenticated_uid       # Overrides any client-sent userId
```

A citizen can only fetch/track their own applications. The `GET /api/applications/user/{user_id}` endpoint checks:

```python
if user_id != current_user["uid"] and not current_user["is_admin"]:
    raise HTTPException(403, "Access denied")
```

Non-existent applications return 404 (not 403) to prevent ID enumeration.

### Admin RBAC

Admin status is determined server-side by:

1. **Firebase Custom Claim**: `decoded_token.get("admin") is True`
2. **Email Whitelist**: `email in ADMIN_EMAILS` (from `ADMIN_EMAILS` env var)

`ADMIN_EMAILS` loads strictly from environment — empty list if unset. No default test accounts exist.

The client UI does NOT implement admin access control (the backend is authoritative). If the backend returns 401/403, the frontend shows a permission-denied message rather than falling back to fabricated data.

## Firestore Security Rules

Firestore rules enforce ownership at the database level (defence-in-depth):

```
match /applications/{docId} {
  allow read: if isOwner() || isAdmin();
  allow create: if request.auth != null && isOwner();
  allow update: if isAdmin();
  allow delete: if false;
}
```

`isAdmin()` checks the Firebase custom claim — a client cannot manufacture this claim.

## CORS

CORS is enforced by `CORSMiddleware` with an explicit whitelist. Wildcard (`*`) is explicitly rejected:

```python
allowed_origins = [
    origin.strip()
    for origin in raw_origins.split(",")
    if origin.strip() and origin.strip() != "*"
]
```

Production allows: `https://jansahayakai.web.app`, `https://jansahayakai.firebaseapp.com`

Development allows: localhost variants (overridden in production via `ALLOWED_ORIGINS` env var)

## Rate Limiting

LLM chat endpoint enforces a per-user sliding window rate limit:

- **Limit**: 15 requests per 60 seconds per authenticated UID
- **Implementation**: `SlidingWindowRateLimiter` in `core/security.py` — thread-safe with `threading.Lock`
- **Pruning**: Stale timestamps are pruned on every check (no unbounded growth)
- **Response**: HTTP 429 with `Retry-After` header

**Limitation**: The rate limiter is in-memory and process-local. On multi-process deployments it does not share state. Document this — for this project's scale it is acceptable.

## Upload Security (OCR)

1. MIME type validated from client `Content-Type` header
2. File read is **bounded** to `MAX_FILE_SIZE + 1` bytes — oversized uploads are rejected before expensive allocation
3. Magic bytes inspected (JPEG, PNG, WebP only)
4. Pillow `img.verify()` called to reject malformed/corrupted images
5. PDF is not accepted (Tesseract-only runtime on Render)

## PII Handling

- Aadhaar numbers in AI prompts are masked: `XXXX-XXXX-1234`
- PAN numbers are masked: `XXXXX1234X`
- Full street addresses are replaced with `[Address redacted for privacy]`
- Raw OCR text is not returned to the AI (dropped in `sanitize_context`)
- Firebase ID tokens are never logged (only UID prefix is logged, e.g., `uid[:8]`)

## Secrets Management

| Secret | Storage |
|--------|---------|
| Firebase service account | Environment variable (`FIREBASE_SERVICE_ACCOUNT_JSON`) on Render |
| LLM API key | Environment variable (`LLM_API_KEY`) on Render |
| Admin emails | Environment variable (`ADMIN_EMAILS`) on Render |
| Firebase client config | Public in `firebase-config.js` (Firebase client config is designed to be public; security is enforced by Firestore rules and Firebase Auth) |

No secrets are committed to the repository. `.env` is in `.gitignore`.
