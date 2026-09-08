# Architecture

## Overview

JanSahayakAI is a single-page application (SPA) with a Python/FastAPI backend. There is no build step — the frontend is plain HTML/CSS/ES module JavaScript served by Firebase Hosting.

```
Browser ──────────────────────────────────────────────────────┐
│  Firebase Hosting (CDN)                                      │
│  index.html + ES modules (app.js, chatbot.js, …)            │
│  Firebase Auth SDK (compat v9)                               │
│  Firebase Firestore SDK (read-only citizen access)           │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTTPS + Firebase ID Token (Bearer)
                       ▼
         JanSahayak FastAPI Backend (Render)
         ├── CORS middleware (whitelist only)
         ├── Firebase ID Token verification (firebase-admin)
         ├── /api/applications  (Firestore CRUD)
         ├── /api/ocr/extract   (Tesseract OCR)
         ├── /api/admin/*       (admin RBAC)
         ├── /api/schemes       (schemes.json serve)
         ├── /api/schemes/evaluate (eligibility engine)
         └── /api/llm/chat      (AI via Gemini API)
                       │
                       ▼
              Firebase Firestore
              (authoritative application store)
```

## Frontend Architecture

The frontend is a SPA managed by `app.js` as the central router. Pages are `<section>` elements toggled with CSS `active` class. There is no framework; all logic is vanilla ES modules.

| Module | Responsibility |
|--------|---------------|
| `app.js` | Router, auth callbacks, translations, theme, toast |
| `auth.js` | Firebase sign-in/out, Google OAuth, anonymous auth |
| `chatbot.js` | Scheme finder (profile collection) + FAQ floating chatbot |
| `scheme-results.js` | Eligibility results display, backend evaluation integration |
| `form-wizard.js` | Multi-step application form, draft persistence, submission |
| `tracker.js` | Application status tracker |
| `admin.js` | Admin dashboard (backend-authoritative) |
| `ocr.js` | OCR upload UI and field extraction display |
| `utils.js` | `authFetch`, `getBackendUrl`, `escapeHtml`, `sanitizeUrl` |
| `i18n.js` | English/Hindi translations dictionary |
| `services.js` | Service card grid rendering |
| `voice.js` | Web Speech API voice input |
| `accessibility.js` | Contrast, font size, keyboard mode controls |
| `firebase-config.js` | Firebase SDK initialization |

## Backend Architecture

The backend is a FastAPI application started by Uvicorn. Firebase Admin SDK is initialized once on startup via the lifespan context manager.

| Module | Responsibility |
|--------|---------------|
| `main.py` | App creation, CORS, router registration, lifespan |
| `applications.py` | Citizen application CRUD (Firestore) |
| `admin.py` | Admin endpoints (analytics, status updates) |
| `ocr.py` | Image upload, validation, OCR extraction |
| `firebase_service.py` | Firestore CRUD layer (singleton client) |
| `schemas.py` | Pydantic models for all request/response shapes |
| `core/security.py` | Firebase token verification, admin RBAC, rate limiter |
| `core/eligibility.py` | Deterministic tri-state eligibility engine |
| `core/ai_validator.py` | AI response hallucination validator |
| `ai/service.py` | LLM orchestration, PII masking, scheme grounding |
| `ai/router.py` | `/api/llm/chat` endpoint with auth + rate limiting |

## Data Flow: Scheme Eligibility

```
1. Citizen answers chatbot questions
2. chatbot.js → onComplete(userData)
3. app.js → renderResults(userData)
4. scheme-results.js:
   a. Instant client-side filter (UI response)
   b. POST /api/schemes/evaluate with profile
5. core/eligibility.py → evaluate_all_schemes()
   → 25 scheme evaluations → ELIGIBLE/INELIGIBLE/UNKNOWN
6. Frontend updates cards with authoritative result
7. If chatbot queries AI → ai/service.py injects eligibility
   results as ground truth into LLM system prompt
```

## Data Flow: Application Submission

```
1. Citizen fills form-wizard.js
2. submitForm() → disable button (prevent double-submit)
3. authFetch POST /api/applications (30s timeout + AbortController)
4. applications.py → verify Firebase token → extract UID
5. firebase_service.create_application() → Firestore
6. 200 OK → clearOfflineProgress() → success callback
7. Error → re-enable button → preserve draft → show toast
```
