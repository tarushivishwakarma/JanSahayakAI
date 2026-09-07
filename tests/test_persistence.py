"""
JanSahayakAI — Phase 3 Persistence Regression Tests.
Verifies authoritative Firestore persistence:
- Complete removal of _in_memory_store fallback.
- Fail-closed behavior (HTTP 503) when Firestore is unreachable.
- No false success reporting.
"""

import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# Mock Firebase app
import firebase_admin
if not firebase_admin._apps:
    dummy_app = MagicMock()
    dummy_app.name = "[DEFAULT]"
    firebase_admin._apps["[DEFAULT]"] = dummy_app

from main import app
import applications
import admin


def mock_verify_token(token: str):
    if token == "valid_citizen_token":
        return {"uid": "citizen_123", "email": "citizen@test.in", "admin": False}
    elif token == "valid_admin_token":
        return {"uid": "admin_123", "email": "admin@jansahayak.in", "admin": True}
    raise ValueError("Invalid token")


class PersistenceRegressionTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_in_memory_store_eliminated(self):
        """Confirms _in_memory_store has been eliminated from applications and admin modules."""
        self.assertFalse(hasattr(applications, "_in_memory_store"), "_in_memory_store still exists in applications.py")
        self.assertFalse(hasattr(admin, "_in_memory_store"), "_in_memory_store still exists in admin.py")

    @patch("firebase_admin.auth.verify_id_token", side_effect=mock_verify_token)
    @patch("firebase_service.create_application", side_effect=Exception("Database connection timeout"))
    def test_create_application_fails_closed_503_on_db_down(self, mock_fb, mock_auth):
        """Backend must fail closed with HTTP 503 if Firestore is unreachable."""
        headers = {"Authorization": "Bearer valid_citizen_token"}
        payload = {
            "serviceId": "aadhaar-update",
            "serviceName": "Aadhaar Update",
            "userId": "citizen_123",
            "formData": {"name": "Test User", "pincode": "221001"}
        }
        resp = self.client.post("/api/applications", json=payload, headers=headers)
        self.assertEqual(resp.status_code, 503)
        self.assertIn("authoritative database", resp.json().get("detail", ""))

    @patch("firebase_admin.auth.verify_id_token", side_effect=mock_verify_token)
    @patch("firebase_service.get_application_by_id", side_effect=Exception("Firestore offline"))
    def test_get_application_fails_closed_503_on_db_down(self, mock_fb, mock_auth):
        """Backend must return 503 if database errors out during retrieval."""
        headers = {"Authorization": "Bearer valid_citizen_token"}
        resp = self.client.get("/api/applications/APP-TEST-99", headers=headers)
        self.assertEqual(resp.status_code, 503)
        self.assertIn("Database service unavailable", resp.json().get("detail", ""))

    @patch("firebase_admin.auth.verify_id_token", side_effect=mock_verify_token)
    @patch("firebase_service.update_application_status", side_effect=Exception("Firestore write failure"))
    def test_status_update_fails_closed_503_on_db_down(self, mock_fb, mock_auth):
        """Admin status update fails closed with 503 if Firestore cannot write."""
        headers = {"Authorization": "Bearer valid_admin_token"}
        resp = self.client.patch(
            "/api/applications/APP-TEST-99/status",
            json={"status": "approved"},
            headers=headers
        )
        self.assertEqual(resp.status_code, 503)
        self.assertIn("Database service unavailable", resp.json().get("detail", ""))

    @patch("firebase_admin.auth.verify_id_token", side_effect=mock_verify_token)
    @patch("firebase_service.get_all_applications", side_effect=Exception("Firestore read failure"))
    def test_admin_applications_fails_closed_503_on_db_down(self, mock_fb, mock_auth):
        """Admin application listing fails closed with 503 on database read errors."""
        headers = {"Authorization": "Bearer valid_admin_token"}
        resp = self.client.get("/api/admin/applications", headers=headers)
        self.assertEqual(resp.status_code, 503)
        self.assertIn("Database service unavailable", resp.json().get("detail", ""))


if __name__ == "__main__":
    unittest.main()
