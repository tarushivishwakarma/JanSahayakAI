# JanSahayakAI

**AI-powered Indian government scheme finder and citizen services portal**

JanSahayakAI helps Indian citizens instantly discover which of 25 central and state government schemes they are eligible for, apply for citizen services, and get answers to government scheme queries — in English and Hindi.

---

## Quick Links

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design and component overview |
| [API.md](docs/API.md) | Backend REST API reference |
| [SECURITY.md](docs/SECURITY.md) | Security model and authentication |
| [AI_METHODOLOGY.md](docs/AI_METHODOLOGY.md) | AI grounding, validator, and hallucination shield |
| [ELIGIBILITY_ENGINE.md](docs/ELIGIBILITY_ENGINE.md) | Deterministic eligibility engine (25 schemes) |
| [OCR.md](docs/OCR.md) | OCR document extraction |
| [TESTING.md](docs/TESTING.md) | Test suite and how to run tests |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production deployment guide |
| [LIMITATIONS.md](docs/LIMITATIONS.md) | Known limitations and unverified scheme data |

---

## Live Production

| Component | URL |
|-----------|-----|
| Frontend | https://jansahayakai.web.app |
| Backend API | https://jansahayakai-ukbl.onrender.com |
| API Docs | https://jansahayakai-ukbl.onrender.com/docs |

---

## Features

- **Scheme Finder**: Conversational chatbot collects citizen profile → deterministic eligibility engine evaluates all 25 schemes → AI summarises results
- **Service Applications**: Apply for Aadhaar correction, PAN update, pension, scholarship, ration card, income certificate
- **Application Tracker**: Track submitted application status in real-time
- **OCR Document Extraction**: Upload Aadhaar/PAN card image → automatically extract name, DOB, address, ID number
- **Admin Dashboard**: View all applications, update statuses, analytics
- **Multilingual**: Full English and Hindi support throughout
- **Accessibility**: Skip links, ARIA labels, keyboard navigation, screen reader support

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML5 / CSS3 / JavaScript (ES modules) |
| Backend | Python 3.12 · FastAPI · Uvicorn |
| Authentication | Firebase Authentication (Google OAuth + Anonymous) |
| Database | Firebase Firestore |
| Hosting | Firebase Hosting (frontend) · Render (backend) |
| OCR | Tesseract via pytesseract · Pillow |
| AI | Google Gemini 1.5 Flash (via OpenAI-compatible endpoint) |

---

## Local Development

### Prerequisites

- Python 3.12+
- Node.js 18+ (for syntax checking only — no build step)
- Tesseract OCR ([Windows installer](https://github.com/UB-Mannheim/tesseract/wiki))
- Firebase project with Authentication and Firestore enabled

### Backend Setup

```bash
# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env
# Edit .env with your Firebase service account and LLM API key

# Run development server
uvicorn main:app --reload --port 8000
```

### Frontend Setup

The frontend is pure HTML/CSS/JS with no build step. Use any static server:

```bash
# Python simple server
python -m http.server 5500 --directory frontend

# Or VS Code Live Server extension
```

Open http://localhost:5500 in your browser.

---

## Running Tests

```bash
# Run complete test suite (128 tests)
python -m unittest discover -s tests -v

# Check frontend JS syntax
node -c frontend/admin.js && node -c frontend/form-wizard.js && \
node -c frontend/scheme-results.js && node -c frontend/ocr.js && \
node -c frontend/chatbot.js && node -c frontend/tracker.js

# Start backend (health check)
uvicorn main:app --port 8001
curl http://localhost:8001/health
```

---

## Project Structure

```
JanSahayakAI/
├── main.py                  # FastAPI entry point, CORS, routers
├── applications.py          # Application CRUD endpoints
├── admin.py                 # Admin endpoints (protected)
├── ocr.py                   # OCR upload endpoint
├── firebase_service.py      # Firestore CRUD layer
├── schemas.py               # Pydantic request/response models
├── schemes.json             # 25-scheme catalog (single source of truth)
├── requirements.txt         # Python dependencies
├── runtime.txt              # Python 3.12 version pin (Render)
├── firestore.rules          # Firestore security rules
├── firebase.json            # Firebase Hosting config
├── .env.example             # Environment variable template
├── core/
│   ├── eligibility.py       # Deterministic eligibility engine
│   ├── security.py          # Firebase auth, RBAC, rate limiter
│   └── ai_validator.py      # AI hallucination validator
├── ai/
│   ├── service.py           # LLM orchestration + PII masking
│   ├── router.py            # /api/llm/chat endpoint
│   ├── config.py            # LLM configuration
│   └── schemas.py           # Chat request/response models
├── frontend/
│   ├── index.html           # Single-page application shell
│   ├── styles.css           # Complete design system
│   ├── app.js               # SPA router and orchestrator
│   ├── auth.js              # Firebase authentication flows
│   ├── chatbot.js           # Scheme finder + FAQ chatbot
│   ├── scheme-results.js    # Scheme results display
│   ├── form-wizard.js       # Multi-step application form
│   ├── tracker.js           # Application status tracker
│   ├── admin.js             # Admin dashboard
│   ├── ocr.js               # OCR upload interface
│   ├── utils.js             # Shared utilities (authFetch, escapeHtml, etc.)
│   ├── services.js          # Service card grid
│   ├── i18n.js              # English/Hindi translations
│   ├── voice.js             # Web Speech API integration
│   └── accessibility.js     # A11y controls (contrast, font size)
├── tests/
│   ├── test_eligibility.py          # Eligibility engine tests
│   ├── test_pm_kisan.py             # PM-Kisan statutory rules
│   ├── test_ai_validation.py        # AI hallucination validator tests
│   ├── test_persistence.py          # Firestore persistence tests
│   ├── test_validation.py           # Schema/input validation tests
│   ├── test_security_regression.py  # Security hardening regression
│   ├── test_scheme_data_authenticity.py  # 25-scheme data correctness
│   └── test_phase4_hardening.py     # Phase 4 hardening regression
└── docs/
    ├── ARCHITECTURE.md
    ├── API.md
    ├── SECURITY.md
    ├── AI_METHODOLOGY.md
    ├── ELIGIBILITY_ENGINE.md
    ├── OCR.md
    ├── TESTING.md
    ├── DEPLOYMENT.md
    └── LIMITATIONS.md
```

---

## Phases Completed

| Phase | Focus | Status |
|-------|-------|--------|
| Phase 1 | Read-only audit | ✅ Complete |
| Phase 2 | Security hardening | ✅ Complete |
| Phase 3 | Core correctness, AI grounding, OCR | ✅ Complete |
| Phase 3.5 | Scheme data authenticity (25 schemes) | ✅ Complete |
| Phase 4 | Performance, UX, accessibility, docs | ✅ Complete |

---

## Important Notes

- All 25 schemes in `schemes.json` have been audited against official government sources. **7 schemes contain unverified fields** — see [LIMITATIONS.md](docs/LIMITATIONS.md).
- The project is on branch `feature/security-hardening`. `main` is the original production baseline.
- Do not deploy from `feature/security-hardening` without final integration testing.
