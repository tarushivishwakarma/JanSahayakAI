# JanSahayakAI Test Suite & Quality Assurance

This document details the automated testing architecture, coverage, and execution instructions for JanSahayakAI.

---

## 1. Test Architecture

The backend test suite is written using Python's standard `unittest` framework with `fastapi.testclient.TestClient`. Tests are fully isolated from live third-party cloud services using mocks for Firebase Admin SDK and external LLM APIs.

### Test Files & Scope

| Test File | Focus Area | Key Invariants Tested |
|-----------|------------|-----------------------|
| `test_security.py` | Security & Auth | Token verification, closed-by-default admin RBAC, CORS headers, URL sanitization |
| `test_eligibility.py` | Deterministic Rules | Tri-state evaluation across all 25 schemes, boundary testing, sentinel semantics |
| `test_pm_kisan.py` | PM-Kisan Correctness | Land ownership requirements, statutory exclusion filters (pension >= 10k, income tax, professionals) |
| `test_ai_grounding.py` | AI Guardrails | Grounding in `schemes.json`, PII masking (Aadhaar/PAN), validator intervention |
| `test_validation.py` | Input Schemas | Pydantic model validation, status enumeration, empty payload rejection |
| `test_phase3_5_data_integrity.py` | Data Authenticity | Verified government scheme benefits, income limits, BBBP awareness handling |
| `test_phase4_hardening.py` | Production Hardening | Removal of fake admin data, removal of duplicate client eligibility, bounded OCR reads, rate limiter memory cleanup, a11y roles |

---

## 2. Running Automated Tests

### Python Backend Tests
Run the entire test suite from the repository root:

```bash
python -m unittest discover -s tests -v
```

Or using `pytest`:
```bash
python -m pytest tests/ -v
```

**Current Verification Baseline:**
- **138 tests passing**
- **0 failures**
- **0 errors**

### Frontend JavaScript Syntax Verification
The frontend uses vanilla ES modules without a build step. Every file is validated for syntax errors using Node.js:

```bash
node -c frontend/admin.js
node -c frontend/form-wizard.js
node -c frontend/scheme-results.js
node -c frontend/ocr.js
node -c frontend/chatbot.js
node -c frontend/tracker.js
node -c frontend/services.js
node -c frontend/app.js
node -c frontend/utils.js
node -c frontend/firebase-config.js
node -c frontend/i18n.js
node -c frontend/auth.js
node -c frontend/accessibility.js
node -c frontend/landing.js
node -c frontend/voice.js
```

---

## 3. Regression Safeguards

1. **No Fake Data Invariant:** Tests in `test_phase4_hardening.py` assert that `getDemoApplications`, `user.isDemo`, and fake IDs (`demo-1`) do not exist in production frontend scripts.
2. **No Client Eligibility Duplication:** Tests verify that `filterSchemes()` is absent from `scheme-results.js`, preventing multiple sources of truth.
3. **No Bare Print Invariant:** Tests ensure `print()` statements are prohibited in `ai/` modules in favor of structured logging.
4. **Memory Leak Protection:** Tests assert `SlidingWindowRateLimiter` actively prunes expired keys when user count exceeds thresholds.
