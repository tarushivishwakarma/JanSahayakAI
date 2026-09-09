# Deployment Architecture & Production Infrastructure

This document outlines the deployment topology, runtime configuration, and environment setup for JanSahayakAI.

> **IMPORTANT:** This repository does NOT automatically deploy during development phases. Deployments are executed under controlled release procedures.

---

## 1. Architecture Topology

```
┌───────────────────────────────┐
│     Firebase Hosting (CDN)    │
│   https://jansahayakai.web.app │
└───────────────┬───────────────┘
                │
                │ HTTPS (CORS restricted)
                ▼
┌───────────────────────────────┐
│     Render Web Service        │
│ https://jansahayakai-ukbl.onrender.com
│  (Python 3.12 / FastAPI)       │
└───────────────┬───────────────┘
                │
                ├──► Firebase Admin SDK (Auth Token Verification & Firestore Persistence)
                ├──► External LLM Provider (Groq / OpenAI API for Chat Explanations)
                └──► Tesseract OCR Engine (System package for ID scanning)
```

---

## 2. Frontend Deployment (Firebase Hosting)

- **Target URL:** `https://jansahayakai.web.app`
- **Hosting Provider:** Firebase Hosting
- **Build Artifacts:** Plain HTML, Vanilla CSS, ES Module JavaScript (no build/bundling step required).
- **Configuration File:** `firebase.json`
- **Deployment Command (Production Release Only):**
  ```bash
  firebase deploy --only hosting
  ```

---

## 3. Backend Deployment (Render Web Service)

- **Target URL:** `https://jansahayakai-ukbl.onrender.com`
- **Hosting Provider:** Render Web Service
- **Runtime Environment:**
  - Runtime pinned to Python 3.12 via `runtime.txt` (`python-3.12.3`)
  - Operating System: Linux (Debian-based)
  - System Dependencies: `tesseract-ocr`
- **Start Command:**
  ```bash
  uvicorn main:app --host 0.0.0.0 --port $PORT
  ```

---

## 4. Production Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ENVIRONMENT` | Yes | Set to `production` (disables debug endpoints, enforces strict CORS) |
| `CORS_ORIGINS` | Yes | Allowed frontend origins (e.g., `https://jansahayakai.web.app`) |
| `FIREBASE_CREDENTIALS_JSON` | Yes | Base64 or stringified JSON of Google Cloud service account credentials |
| `GROQ_API_KEY` | Optional | API key for external LLM inference |
| `ADMIN_EMAILS` | Optional | Comma-separated list of administrative emails (fails closed if empty) |

---

## 5. Security & Isolation

- **Production URLs are fixed:** No staging or development overrides are hardcoded into production code.
- **Fail Closed:** If `ADMIN_EMAILS` is empty or unset, email-based admin escalation fails closed. Firebase custom claims (`admin: true`) are the primary authoritative RBAC mechanism.
- **Secrets:** No production secrets, service account keys, or API tokens are checked into version control.
