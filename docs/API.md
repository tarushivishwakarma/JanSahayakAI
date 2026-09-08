# JanSahayakAI API Specification

Base URL:
- Local Development: `http://localhost:8000`
- Production: `https://jansahayakai-ukbl.onrender.com`

All protected endpoints require an HTTP `Authorization: Bearer <firebase_id_token>` header.

---

## 1. Schemes

### 1.1 List All Schemes
- **Method:** `GET`
- **Path:** `/api/schemes`
- **Auth:** Public
- **Description:** Returns the complete 25-scheme catalog containing metadata, descriptions, eligibility criteria, and official government application links.
- **Response:** `200 OK` — Array of scheme objects.

### 1.2 Evaluate Scheme Eligibility
- **Method:** `POST`
- **Path:** `/api/schemes/evaluate`
- **Auth:** Optional / Public (Token attached if signed in)
- **Description:** Deterministically evaluates a citizen profile against all 25 government schemes using strict tri-state criteria (`ELIGIBLE`, `INELIGIBLE`, `UNKNOWN`).
- **Request Body (`application/json`):**
  ```json
  {
    "age": 28,
    "income": 180000,
    "state": "Karnataka",
    "gender": "Female",
    "occupation": "Artisan",
    "socialCategory": "OBC",
    "disability": "No",
    "maritalStatus": "Married",
    "ownsCultivableLand": false,
    "isInstitutionalLandholder": false,
    "isConstitutionalPostHolder": false,
    "isGovernmentEmployee": false,
    "monthlyPensionGte10k": false,
    "isIncomeTaxPayer": false,
    "isRegisteredProfessional": false
  }
  ```
- **Response:** `200 OK`
  ```json
  {
    "results": [
      {
        "scheme_id": 1,
        "scheme_name": "PM Kisan Samman Nidhi",
        "status": "INELIGIBLE",
        "reasons": ["Requires farmer occupation", "Requires land ownership"]
      }
    ]
  }
  ```

---

## 2. Artificial Intelligence

### 2.1 Scheme Chatbot
- **Method:** `POST`
- **Path:** `/api/llm/chat`
- **Auth:** Required (`Bearer <token>`)
- **Rate Limit:** 15 requests / minute per user UID (`HTTP 429` on exceed)
- **Request Body:**
  ```json
  {
    "messages": [
      {"role": "user", "content": "Am I eligible for PM Vishwakarma?"}
    ],
    "context": {},
    "language": "en"
  }
  ```
- **Response:** `200 OK`
  ```json
  {
    "reply": "Based on the PM Vishwakarma scheme criteria..."
  }
  ```
- **Error Codes:**
  - `400 Bad Request`: Empty message or invalid role
  - `401 Unauthorized`: Missing or invalid Firebase ID token
  - `429 Too Many Requests`: Per-user rate limit exceeded (`Retry-After` header included)
  - `500 Internal Server Error`: AI generation or validator failure

---

## 3. Optical Character Recognition (OCR)

### 3.1 Extract ID Card
- **Method:** `POST`
- **Path:** `/api/ocr/extract`
- **Auth:** Optional / Bearer attached
- **Payload:** `multipart/form-data` with `file` field
- **Constraints:**
  - Maximum size: 5 MB (bounded read enforced before decoding)
  - Formats: JPG, PNG, WebP (validated via client MIME + server magic bytes)
- **Response:** `200 OK`
  ```json
  {
    "success": true,
    "extracted": {
      "name": "Jane Doe",
      "dob": "15/08/1995",
      "idNumber": "XXXX-XXXX-1234",
      "gender": "Female"
    },
    "confidence": 0.88,
    "raw_text": null,
    "message": "Document fields extracted successfully."
  }
  ```
- **Error Codes:**
  - `400 Bad Request`: Unsupported file type
  - `413 Payload Too Large`: Upload exceeds 5 MB

---

## 4. Citizen Applications

### 4.1 Submit Application
- **Method:** `POST`
- **Path:** `/api/applications`
- **Auth:** Required (`Bearer <token>`)
- **Request Body:**
  ```json
  {
    "serviceId": "aadhaar-correction",
    "serviceName": "Aadhaar Correction",
    "formData": { "correctionType": "Address" }
  }
  ```
- **Response:** `200 OK`
  ```json
  {
    "success": true,
    "applicationId": "APP-1748000123",
    "status": "submitted",
    "submittedAt": "2026-09-08T08:30:00.000Z"
  }
  ```

### 4.2 Get User Applications
- **Method:** `GET`
- **Path:** `/api/applications/user/{user_id}`
- **Auth:** Required (`Bearer <token>`)
- **Description:** Retrieves all applications submitted by `user_id`. Authorization check ensures callers can only view their own applications (or admin viewing any user).
- **Response:** `200 OK`
  ```json
  {
    "applications": [
      {
        "id": "app_doc_id",
        "applicationId": "APP-1748000123",
        "serviceName": "Aadhaar Correction",
        "status": "submitted",
        "submittedAt": "2026-09-08T08:30:00.000Z"
      }
    ]
  }
  ```

---

## 5. Administration (RBAC Protected)

### 5.1 List All Applications
- **Method:** `GET`
- **Path:** `/api/admin/applications`
- **Auth:** Admin Required (`Bearer <token>` with admin claim or configured email)
- **Response:** `200 OK`
  ```json
  {
    "applications": [ ... ]
  }
  ```
- **Error Codes:**
  - `401 Unauthorized`: Invalid or expired session
  - `403 Forbidden`: Authenticated user lacks administrative privileges

### 5.2 Update Application Status
- **Method:** `PATCH`
- **Path:** `/api/applications/{app_id}/status`
- **Auth:** Admin Required
- **Request Body:**
  ```json
  {
    "status": "approved"
  }
  ```
- **Allowed Statuses:** `submitted`, `reviewing`, `approved`, `rejected`

---

## 6. System Health

### 6.1 Health Check
- **Method:** `GET`
- **Path:** `/health`
- **Auth:** Public
- **Response:** `200 OK`
  ```json
  {
    "status": "healthy",
    "service": "JanSahayakAI Backend"
  }
  ```
