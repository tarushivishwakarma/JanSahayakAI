"""
JanSahayakAI — Comprehensive Phase 2 Security Regression Test Suite.
Verifies all 27 critical/high security requirements identified in Phase 1 audit.
Runs with mocks; zero external API or cloud calls.
"""

import io
import os
import unittest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient
from PIL import Image

# Initialize dummy firebase_admin._apps if needed so imports do not fail
import firebase_admin
if not firebase_admin._apps:
    dummy_app = MagicMock()
    dummy_app.name = "[DEFAULT]"
    firebase_admin._apps["[DEFAULT]"] = dummy_app

from main import app
from core.security import sanitize_url, llm_rate_limiter, get_current_user, get_current_admin_user
from ai.service import mask_pii_text, sanitize_context
from applications import _in_memory_store


def mock_verify_token(token: str):
    """Mocks Firebase ID token verification."""
    if token == "valid_citizen_token":
        return {
            "uid": "citizen_uid_101",
            "email": "citizen@example.com",
            "name": "Citizen User",
            "admin": False
        }
    elif token == "valid_citizen_b_token":
        return {
            "uid": "citizen_uid_202",
            "email": "citizen2@example.com",
            "name": "Citizen B",
            "admin": False
        }
    elif token == "valid_admin_token":
        return {
            "uid": "admin_uid_999",
            "email": "admin@jansahayak.in",
            "name": "System Administrator",
            "admin": True
        }
    elif token == "admin_email_only_token":
        return {
            "uid": "admin_uid_888",
            "email": "admin@test.com",
            "name": "Email Admin",
            "admin": False  # Admin via ADMIN_EMAILS configuration
        }
    raise ValueError("Invalid or expired Firebase ID token")


class SecurityRegressionTestCase(unittest.TestCase):
    """Suite of tests verifying Phase 2 security hardening."""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        _in_memory_store.clear()
        llm_rate_limiter._requests.clear()

    # -------------------------------------------------------------
    # 1. Missing Authorization header -> 401
    # -------------------------------------------------------------
    def test_01_missing_authorization_header_returns_401(self):
        resp = self.client.post("/api/applications", json={
            "serviceId": "aadhaar-update",
            "serviceName": "Aadhaar Update",
            "formData": {"name": "Test User"}
        })
        self.assertEqual(resp.status_code, 401)
        self.assertIn("Authentication required", resp.json().get("detail", ""))

    # -------------------------------------------------------------
    # 2. Malformed Bearer token -> 401
    # -------------------------------------------------------------
    def test_02_malformed_bearer_token_returns_401(self):
        malformed_headers = [
            {"Authorization": "Basic 12345"},
            {"Authorization": "Bearer"},
            {"Authorization": "Token some_token"},
            {"Authorization": "Bearer   "}
        ]
        for h in malformed_headers:
            resp = self.client.post("/api/applications", json={"serviceId": "pan"}, headers=h)
            self.assertEqual(resp.status_code, 401, f"Failed for header: {h}")

    # -------------------------------------------------------------
    # 3. Invalid token -> 401
    # -------------------------------------------------------------
    @patch("firebase_admin.auth.verify_id_token", side_effect=ValueError("Token expired"))
    def test_03_invalid_or_expired_token_returns_401(self, mock_auth):
        headers = {"Authorization": "Bearer invalid_expired_token"}
        resp = self.client.post("/api/applications", json={"serviceId": "pan"}, headers=headers)
        self.assertEqual(resp.status_code, 401)
        self.assertIn("Invalid or expired", resp.json().get("detail", ""))

    # -------------------------------------------------------------
    # 4. Valid token correctly yields uid and claims
    # -------------------------------------------------------------
    @patch("firebase_admin.auth.verify_id_token", side_effect=mock_verify_token)
    def test_04_valid_token_yields_correct_claims(self, mock_auth):
        headers = {"Authorization": "Bearer valid_citizen_token"}
        resp = self.client.get("/api/applications/user/citizen_uid_101", headers=headers)
        self.assertEqual(resp.status_code, 200)
        self.assertIn("applications", resp.json())
        self.assertEqual(resp.json().get("count"), 0)

    # -------------------------------------------------------------
    # 5. POST application cannot spoof userId
    # -------------------------------------------------------------
    @patch("firebase_admin.auth.verify_id_token", side_effect=mock_verify_token)
    @patch("firebase_service.create_application", side_effect=Exception("Use in-memory"))
    def test_05_post_application_cannot_spoof_user_id(self, mock_fb, mock_auth):
        headers = {"Authorization": "Bearer valid_citizen_token"}
        # Attacker tries to submit application on behalf of victim "victim_user_999"
        malicious_payload = {
            "serviceId": "income-certificate",
            "serviceName": "Income Certificate",
            "userId": "victim_user_999",
            "userEmail": "victim@example.com",
            "formData": {"annual_income": "120000"}
        }
        resp = self.client.post("/api/applications", json=malicious_payload, headers=headers)
        self.assertEqual(resp.status_code, 200)

        # Inspect saved record in in-memory store
        doc_id = resp.json()["id"]
        saved_app = _in_memory_store[doc_id]
        # Must be authoritative UID of authenticated user, NOT victim_user_999
        self.assertEqual(saved_app["userId"], "citizen_uid_101")
        self.assertNotEqual(saved_app["userId"], "victim_user_999")

    # -------------------------------------------------------------
    # 6. Application GET prevents IDOR/BOLA
    # -------------------------------------------------------------
    @patch("firebase_admin.auth.verify_id_token", side_effect=mock_verify_token)
    def test_06_application_get_prevents_idor_bola(self, mock_auth):
        # Create an application owned by User B
        app_id = "APP-CONFIDENTIAL-01"
        _in_memory_store[app_id] = {
            "id": app_id,
            "applicationId": app_id,
            "userId": "citizen_uid_202",
            "serviceId": "scholarship",
            "status": "submitted"
        }

        # User A attempts to read User B's application
        headers_user_a = {"Authorization": "Bearer valid_citizen_token"}
        resp = self.client.get(f"/api/applications/{app_id}", headers=headers_user_a)
        # Must return 404 to prevent ID enumeration
        self.assertEqual(resp.status_code, 404)

        # Owner (User B) can read it
        headers_user_b = {"Authorization": "Bearer valid_citizen_b_token"}
        resp_b = self.client.get(f"/api/applications/{app_id}", headers=headers_user_b)
        self.assertEqual(resp_b.status_code, 200)
        self.assertEqual(resp_b.json()["userId"], "citizen_uid_202")

    # -------------------------------------------------------------
    # 7. User A cannot query User B's application list
    # -------------------------------------------------------------
    @patch("firebase_admin.auth.verify_id_token", side_effect=mock_verify_token)
    def test_07_user_a_cannot_query_user_b_application_list(self, mock_auth):
        headers_user_a = {"Authorization": "Bearer valid_citizen_token"}
        # User A tries to query applications for User B
        resp = self.client.get("/api/applications/user/citizen_uid_202", headers=headers_user_a)
        self.assertEqual(resp.status_code, 403)
        self.assertIn("Access denied", resp.json().get("detail", ""))

    # -------------------------------------------------------------
    # 8. Non-admin cannot change application status
    # -------------------------------------------------------------
    @patch("firebase_admin.auth.verify_id_token", side_effect=mock_verify_token)
    def test_08_non_admin_cannot_change_application_status(self, mock_auth):
        app_id = "APP-TEST-01"
        _in_memory_store[app_id] = {
            "id": app_id,
            "applicationId": app_id,
            "userId": "citizen_uid_101",
            "status": "submitted"
        }
        headers = {"Authorization": "Bearer valid_citizen_token"}
        resp = self.client.patch(
            f"/api/applications/{app_id}/status",
            json={"status": "approved"},
            headers=headers
        )
        self.assertEqual(resp.status_code, 403)
        self.assertIn("Admin authorization required", resp.json().get("detail", ""))

    # -------------------------------------------------------------
    # 9. Admin can change application status
    # -------------------------------------------------------------
    @patch("firebase_admin.auth.verify_id_token", side_effect=mock_verify_token)
    @patch("firebase_service.update_application_status", side_effect=Exception("Fallback in-memory"))
    def test_09_admin_can_change_application_status(self, mock_fb, mock_auth):
        app_id = "APP-TEST-02"
        _in_memory_store[app_id] = {
            "id": app_id,
            "applicationId": app_id,
            "userId": "citizen_uid_101",
            "status": "submitted"
        }
        headers = {"Authorization": "Bearer valid_admin_token"}
        resp = self.client.patch(
            f"/api/applications/{app_id}/status",
            json={"status": "approved"},
            headers=headers
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "approved")
        self.assertEqual(_in_memory_store[app_id]["status"], "approved")

    # -------------------------------------------------------------
    # 10. Admin endpoints reject unauthenticated requests
    # -------------------------------------------------------------
    def test_10_admin_endpoints_reject_unauthenticated(self):
        resp1 = self.client.get("/api/admin/applications")
        self.assertEqual(resp1.status_code, 401)

        resp2 = self.client.get("/api/admin/analytics")
        self.assertEqual(resp2.status_code, 401)

    # -------------------------------------------------------------
    # 11. Admin endpoints reject authenticated non-admin users
    # -------------------------------------------------------------
    @patch("firebase_admin.auth.verify_id_token", side_effect=mock_verify_token)
    def test_11_admin_endpoints_reject_authenticated_non_admin(self, mock_auth):
        headers = {"Authorization": "Bearer valid_citizen_token"}

        resp1 = self.client.get("/api/admin/applications", headers=headers)
        self.assertEqual(resp1.status_code, 403)

        resp2 = self.client.get("/api/admin/analytics", headers=headers)
        self.assertEqual(resp2.status_code, 403)

    # -------------------------------------------------------------
    # 12. OCR rejects mismatched magic bytes
    # -------------------------------------------------------------
    def test_12_ocr_rejects_mismatched_magic_bytes(self):
        # A text file renamed to fake.png
        fake_png_content = b"This is just plain text masquerading as PNG"
        file_obj = io.BytesIO(fake_png_content)

        resp = self.client.post(
            "/api/ocr/extract",
            files={"file": ("fake.png", file_obj, "image/png")}
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Invalid image signature", resp.json().get("detail", ""))

    # -------------------------------------------------------------
    # 13. OCR rejects invalid/malformed image files
    # -------------------------------------------------------------
    def test_13_ocr_rejects_invalid_malformed_image_files(self):
        # Valid PNG magic header but corrupted payload
        corrupt_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00corrupt_payload_data"
        file_obj = io.BytesIO(corrupt_bytes)

        resp = self.client.post(
            "/api/ocr/extract",
            files={"file": ("corrupt.png", file_obj, "image/png")}
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Corrupted or malformed image file.", resp.json().get("detail", ""))

    # -------------------------------------------------------------
    # 14. OCR failure returns success=False
    # -------------------------------------------------------------
    @patch("ocr.extract_text_from_image", return_value={})
    def test_14_ocr_failure_returns_success_false(self, mock_ocr):
        # Create a valid minimal PNG
        img = Image.new("RGB", (30, 30), color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)

        resp = self.client.post(
            "/api/ocr/extract",
            files={"file": ("blank.png", buf, "image/png")}
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertFalse(data["success"])
        self.assertIsNone(data["extracted"])

    # -------------------------------------------------------------
    # 15. OCR failure contains no fake "Ramesh Kumar Singh" data
    # -------------------------------------------------------------
    @patch("ocr.extract_text_from_image", return_value={})
    def test_15_ocr_failure_contains_no_ramesh_kumar_singh(self, mock_ocr):
        img = Image.new("RGB", (30, 30), color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)

        resp = self.client.post(
            "/api/ocr/extract",
            files={"file": ("blank.png", buf, "image/png")}
        )
        data = resp.json()
        raw_text = str(data)
        self.assertNotIn("Ramesh Kumar Singh", raw_text)
        self.assertNotIn("Rampur", raw_text)
        self.assertNotIn("1234 5678 9012", raw_text)

    # -------------------------------------------------------------
    # 16. No hardcoded OCR confidence 0.85
    # -------------------------------------------------------------
    @patch("ocr.extract_text_from_image", return_value={"name": "Verified Name"})
    def test_16_no_hardcoded_ocr_confidence_085(self, mock_ocr):
        img = Image.new("RGB", (30, 30), color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)

        resp = self.client.post(
            "/api/ocr/extract",
            files={"file": ("doc.png", buf, "image/png")}
        )
        data = resp.json()
        # Genuine confidence is either None or measured, never fake 0.85
        self.assertNotEqual(data.get("confidence"), 0.85)

    # -------------------------------------------------------------
    # 17. URL sanitizer rejects javascript: URLs
    # -------------------------------------------------------------
    def test_17_url_sanitizer_rejects_javascript_urls(self):
        bad_urls = [
            "javascript:alert(document.cookie)",
            "JAVASCRIPT:prompt(1)",
            "  javascript:evil()"
        ]
        for u in bad_urls:
            self.assertEqual(sanitize_url(u), "#")

    # -------------------------------------------------------------
    # 18. URL sanitizer rejects data: URLs
    # -------------------------------------------------------------
    def test_18_url_sanitizer_rejects_data_urls(self):
        bad_urls = [
            "data:text/html,<script>alert(1)</script>",
            "DATA:image/svg+xml;base64,PHN2Zz4=",
            "vbscript:msgbox(1)"
        ]
        for u in bad_urls:
            self.assertEqual(sanitize_url(u), "#")

    # -------------------------------------------------------------
    # 19. URL sanitizer accepts legitimate HTTPS official URLs
    # -------------------------------------------------------------
    def test_19_url_sanitizer_accepts_official_https_urls(self):
        good_urls = [
            "https://pmkisan.gov.in",
            "https://pmjay.gov.in/apply",
            "http://scholarships.gov.in"
        ]
        for u in good_urls:
            self.assertEqual(sanitize_url(u), u)

    # -------------------------------------------------------------
    # 20. LLM endpoint rejects unauthenticated requests
    # -------------------------------------------------------------
    def test_20_llm_endpoint_rejects_unauthenticated_requests(self):
        resp = self.client.post("/api/llm/chat", json={
            "messages": [{"role": "user", "content": "How to apply for PM Kisan?"}],
            "language": "en"
        })
        self.assertEqual(resp.status_code, 401)

    # -------------------------------------------------------------
    # 21. LLM endpoint enforces rate limiting (15 req/min)
    # -------------------------------------------------------------
    @patch("firebase_admin.auth.verify_id_token", side_effect=mock_verify_token)
    @patch("ai.router.generate_chat_response", new_callable=AsyncMock)
    def test_21_llm_endpoint_enforces_rate_limiting(self, mock_llm, mock_auth):
        mock_llm.return_value = "Mocked AI reply"
        headers = {"Authorization": "Bearer valid_citizen_token"}
        payload = {"messages": [{"role": "user", "content": "Hello"}]}

        # First 15 requests must succeed
        for i in range(15):
            resp = self.client.post("/api/llm/chat", json=payload, headers=headers)
            self.assertEqual(resp.status_code, 200, f"Request {i+1} failed")

        # 16th request must be rejected with 429
        resp16 = self.client.post("/api/llm/chat", json=payload, headers=headers)
        self.assertEqual(resp16.status_code, 429)
        self.assertIn("Rate limit exceeded", resp16.json().get("detail", ""))

    # -------------------------------------------------------------
    # 22. Rate limiting identifies users by verified UID
    # -------------------------------------------------------------
    @patch("firebase_admin.auth.verify_id_token", side_effect=mock_verify_token)
    @patch("ai.router.generate_chat_response", new_callable=AsyncMock)
    def test_22_rate_limiting_isolates_by_verified_uid(self, mock_llm, mock_auth):
        mock_llm.return_value = "Mocked AI reply"
        headers_user_a = {"Authorization": "Bearer valid_citizen_token"}
        headers_user_b = {"Authorization": "Bearer valid_citizen_b_token"}
        payload = {"messages": [{"role": "user", "content": "Hello"}]}

        # Max out user A
        for _ in range(15):
            self.client.post("/api/llm/chat", json=payload, headers=headers_user_a)

        resp_user_a = self.client.post("/api/llm/chat", json=payload, headers=headers_user_a)
        self.assertEqual(resp_user_a.status_code, 429)

        # User B should NOT be rate limited
        resp_user_b = self.client.post("/api/llm/chat", json=payload, headers=headers_user_b)
        self.assertEqual(resp_user_b.status_code, 200)

    # -------------------------------------------------------------
    # 23. Aadhaar is masked before LLM prompt assembly
    # -------------------------------------------------------------
    def test_23_aadhaar_is_masked_correctly(self):
        samples = [
            ("My Aadhaar is 9876 5432 1234", "My Aadhaar is XXXX-XXXX-1234"),
            ("Aadhaar: 9876-5432-1234", "Aadhaar: XXXX-XXXX-1234"),
            ("Continuous: 987654321234", "Continuous: XXXX-XXXX-1234")
        ]
        for raw, expected in samples:
            masked = mask_pii_text(raw)
            self.assertEqual(masked, expected)

        # Verify ordinary numbers (age, income) are NOT accidentally altered
        ordinary = "I am 35 years old and earn 250000 per year in pincode 221001"
        self.assertEqual(mask_pii_text(ordinary), ordinary)

    # -------------------------------------------------------------
    # 24. PAN is masked before LLM prompt assembly
    # -------------------------------------------------------------
    def test_24_pan_is_masked_correctly(self):
        samples = [
            ("My PAN is ABCDE1234F", "My PAN is XXXXX1234X"),
            ("PAN: XYZPK5678Q for filing", "PAN: XXXXX5678X for filing")
        ]
        for raw, expected in samples:
            masked = mask_pii_text(raw)
            self.assertEqual(masked, expected)

    # -------------------------------------------------------------
    # 25. Full unnecessary address is removed/redacted before LLM
    # -------------------------------------------------------------
    def test_25_unnecessary_full_address_is_redacted(self):
        context = {
            "name": "Citizen User",
            "age": 42,
            "income": 180000,
            "address": "Flat 402, Royal Palms, MG Road, Pune, Maharashtra",
            "aadhaar_number": "123456789012",
            "pan_number": "ABCDE1234F"
        }
        sanitized = sanitize_context(context)
        self.assertEqual(sanitized["name"], "Citizen User")
        self.assertEqual(sanitized["age"], 42)
        self.assertEqual(sanitized["income"], 180000)
        self.assertEqual(sanitized["address"], "[Address redacted for privacy]")
        self.assertEqual(sanitized["aadhaar_number"], "XXXX-XXXX-9012")
        self.assertEqual(sanitized["pan_number"], "XXXXX1234X")

    # -------------------------------------------------------------
    # 26. Wildcard CORS is not used for production configuration
    # -------------------------------------------------------------
    def test_26_wildcard_cors_not_used_in_production(self):
        from main import allowed_origins
        self.assertNotIn("*", allowed_origins)
        # Production web app origin must be present
        self.assertIn("https://jansahayakai.web.app", allowed_origins)

    # -------------------------------------------------------------
    # 27. Firestore diagnostics are not publicly writable/readable
    # -------------------------------------------------------------
    def test_27_firestore_diagnostics_not_publicly_accessible(self):
        rules_path = os.path.join(os.path.dirname(__file__), "..", "firestore.rules")
        with open(rules_path, "r", encoding="utf-8") as f:
            rules_content = f.read()

        # The insecure public diagnostic rule must be completely gone
        self.assertNotIn("_diagnostics", rules_content)
        # Verify default deny is present
        self.assertIn("match /{document=**} {", rules_content)
        self.assertIn("allow read, write: if false;", rules_content)


if __name__ == "__main__":
    unittest.main()
