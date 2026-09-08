# Known Limitations

This document honestly describes limitations, unverified data, and technical constraints. **Do not claim that all 25 schemes are completely factually verified.**

---

## Unverified Scheme Data

The following schemes were audited in Phase 3.5 but contain fields that could not be definitively verified against official primary sources. They are labelled `UNVERIFIED` in `schemes.json`.

| Scheme ID | Scheme Name | Unverified Fact |
|-----------|-------------|-----------------|
| 3 | National Scholarship Portal (NSP) | Age heuristic 16–30 used; official portal covers Class 1 to PhD — no single official age cap documented |
| 4 | Indira Gandhi National Widow Pension Scheme | ₹2L `maxIncome` is a BPL proxy — no universal numeric income threshold published; state top-ups vary |
| 5 | Indira Gandhi National Old Age Pension Scheme | Same BPL proxy issue; state top-ups vary significantly |
| 11 | UP Scholarship | Income ceiling nuances for specific sub-schemes within the portal differ |
| 12 | Maharashtra Shasan Ghoshit Nivrutti Vetan | Benefit amounts ₹1,000–₹1,500/month — Maharashtra state government; limited official online documentation |
| 15 | Pradhan Mantri Matru Vandana Yojana | `maxAge = 45` used; no official upper age limit explicitly stated in main PMMVY guidelines |
| 25 | TN Free Laptop Scheme | Distribution schedules and current availability — scheme restarts vary by state election cycle |

> [!WARNING]
> The eligibility engine may return INELIGIBLE for citizens who are actually eligible for these schemes if the unverified field values are incorrect. Always direct citizens to the official portal for final determination.

---

## AI Chatbot Limitations

- **Not a legal authority**: AI responses are informational only. The AI cannot submit applications, verify documents, or make official eligibility determinations.
- **Grounded but not perfect**: The AI is grounded in verified scheme data and cannot override the deterministic eligibility engine, but it may still produce incorrect summaries of complex eligibility rules.
- **Language nuance**: Hindi responses are machine-generated and may contain awkward phrasing — they are not reviewed by native Hindi-speaking government officials.
- **Scheme updates**: Government schemes change. The data in `schemes.json` reflects the state at audit time (September 2026). Benefits, income limits, and eligibility rules may have been updated.
- **Rate limiting**: The AI chatbot is rate-limited to 15 requests per minute per user. Burst usage will result in a 429 response.

---

## OCR Limitations

- **Accuracy varies**: OCR accuracy depends on image quality, lighting, resolution, and card condition. Low-quality photos may extract incorrect or partial data.
- **Images only**: PDF uploads are not supported. Only JPEG, PNG, and WebP are accepted.
- **No PDF support**: Tesseract on the Render runtime does not support PDF processing. This is a known limitation of the deployment environment.
- **Hindi OCR**: Hindi text extraction uses Tesseract `hin+eng` mode. Accuracy for handwritten Hindi is low.
- **5 MB limit**: Files larger than 5 MB are rejected before processing.
- **Extracted data must be verified**: Citizens should always review and correct extracted fields before submitting applications.

---

## Rate Limiter Limitations

The LLM rate limiter is **in-memory and process-local**:

- On Render free tier (single instance), this works correctly.
- If the backend ever scales to multiple processes or instances, the rate limiter will not share state between them — each process has its own independent counter.
- This is an acceptable trade-off for a final-year project at this scale. A production deployment requiring distributed rate limiting would use Redis or a similar shared store.

---

## Firestore Sync Limitations

- Firestore operations in `firebase_service.py` are synchronous despite `async def` wrappers. FastAPI runs them in a thread pool. At high concurrency this may create contention.
- The application tracker has a localStorage fallback — this means a citizen may see an outdated status if the backend and Firestore are both unavailable. The localStorage data is not authoritative.

---

## Accessibility Limitations

- Voice input uses the Web Speech API which is not universally supported (works in Chrome/Edge, limited in Firefox/Safari).
- Complex schemes with long eligibility criteria may be verbose for screen reader users.
- The admin table may be difficult to navigate on narrow screens.

---

## Production Readiness

Phase 4 implementation concludes with:

> **"Ready for final integration testing and controlled production verification"**

This means:
- All 128 automated tests pass ✅
- No security regressions ✅
- Frontend JS syntax clean ✅
- Backend starts successfully ✅
- Production URLs unchanged ✅

It does **NOT** mean:
- All 25 scheme data fields are 100% verified
- The AI chatbot is error-free
- The system has been load tested
- The OCR is reliable for all document types
- The rate limiter is production-grade distributed

A controlled production deployment with real user testing is recommended before public launch.
