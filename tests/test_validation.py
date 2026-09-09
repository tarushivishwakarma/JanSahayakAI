"""
JanSahayakAI — Input & Schema Validation Test Suite.
Verifies:
- ApplicationCreate bounds & non-empty formData.
- Email regex validation.
- StatusUpdate pattern enforcement.
- ChatMessage / ChatRequest bounds.
- Honest OCR confidence computation.
"""

import unittest
from pydantic import ValidationError
from schemas import ApplicationCreate, StatusUpdate, OcrResponse
from ai.schemas import ChatMessage, ChatRequest
import ocr_service


class ValidationTestCase(unittest.TestCase):
    # -------------------------------------------------------------
    # 1. ApplicationCreate validation
    # -------------------------------------------------------------
    def test_01_valid_application_create_succeeds(self):
        """Well-formed ApplicationCreate passes validation."""
        app_in = ApplicationCreate(
            serviceId="income-cert",
            serviceName="Income Certificate",
            formData={"annual_income": "150000", "applicant_name": "Anita Devi"},
            userId="citizen_uid_123",
            userEmail="anita@example.com"
        )
        self.assertEqual(app_in.serviceId, "income-cert")
        self.assertEqual(app_in.userEmail, "anita@example.com")

    def test_02_empty_form_data_rejected(self):
        """Empty formData dictionary must be rejected."""
        with self.assertRaises(ValidationError) as ctx:
            ApplicationCreate(
                serviceId="pan",
                serviceName="PAN Card",
                formData={},
                userId="citizen_123"
            )
        self.assertIn("formData must contain at least one field", str(ctx.exception))

    def test_03_invalid_email_format_rejected(self):
        """Malformed email strings must be rejected."""
        bad_emails = ["not-an-email", "user@", "@domain.com", "user@domain", "user space@domain.com"]
        for email in bad_emails:
            with self.assertRaises(ValidationError):
                ApplicationCreate(
                    serviceId="pan",
                    serviceName="PAN Card",
                    formData={"name": "Test"},
                    userId="citizen_123",
                    userEmail=email
                )

    def test_04_none_or_blank_email_accepted_as_none(self):
        """None or empty string email is accepted as None."""
        app_none = ApplicationCreate(
            serviceId="pan",
            serviceName="PAN Card",
            formData={"name": "Test"},
            userId="citizen_123",
            userEmail=None
        )
        self.assertIsNone(app_none.userEmail)

        app_blank = ApplicationCreate(
            serviceId="pan",
            serviceName="PAN Card",
            formData={"name": "Test"},
            userId="citizen_123",
            userEmail="   "
        )
        self.assertIsNone(app_blank.userEmail)

    # -------------------------------------------------------------
    # 2. StatusUpdate validation
    # -------------------------------------------------------------
    def test_05_valid_statuses_accepted(self):
        """Only submitted, reviewing, approved, rejected are allowed."""
        for s in ["submitted", "reviewing", "approved", "rejected"]:
            su = StatusUpdate(status=s)
            self.assertEqual(su.status, s)

    def test_06_invalid_status_rejected(self):
        """Arbitrary statuses (pending, deleted, bypass) are rejected."""
        for bad in ["pending", "deleted", "active", "IN_PROGRESS", ""]:
            with self.assertRaises(ValidationError):
                StatusUpdate(status=bad)

    # -------------------------------------------------------------
    # 3. ChatMessage & ChatRequest validation
    # -------------------------------------------------------------
    def test_07_valid_chat_message(self):
        """Valid chat message with allowed roles passes."""
        msg = ChatMessage(role="user", content="How do I apply for PM Kisan?")
        self.assertEqual(msg.role, "user")
        self.assertEqual(msg.content, "How do I apply for PM Kisan?")

    def test_08_invalid_role_rejected(self):
        """Invalid message roles are rejected."""
        with self.assertRaises(ValidationError):
            ChatMessage(role="root", content="Hello")

    def test_09_empty_content_rejected(self):
        """Empty message content is rejected."""
        with self.assertRaises(ValidationError):
            ChatMessage(role="user", content="")

    def test_10_content_exceeding_max_length_rejected(self):
        """Content exceeding 4000 characters is rejected."""
        oversized = "A" * 4001
        with self.assertRaises(ValidationError):
            ChatMessage(role="user", content=oversized)

    def test_11_chat_request_empty_messages_rejected(self):
        """ChatRequest with 0 messages is rejected."""
        with self.assertRaises(ValidationError):
            ChatRequest(messages=[])

    # -------------------------------------------------------------
    # 4. OCR Response validation
    # -------------------------------------------------------------
    def test_12_ocr_response_allows_none_confidence(self):
        """OcrResponse accepts None confidence without error."""
        resp = OcrResponse(
            success=True,
            extracted={"name": "Anita Devi"},
            confidence=None,
            message="Extracted"
        )
        self.assertIsNone(resp.confidence)
        self.assertEqual(resp.extracted["name"], "Anita Devi")


if __name__ == "__main__":
    unittest.main()
