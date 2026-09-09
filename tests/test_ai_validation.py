"""
JanSahayakAI — AI Grounding and Hallucination Shield Test Suite.
Verifies:
- Deterministic response validation against ground truth.
- Catching contradictory eligibility assertions.
- Flagging unauthorized scheme fees / payment requests.
- Sanitizing unsafe URLs.
"""

import unittest
from core.ai_validator import validate_ai_response, extract_urls


class AIValidatorTestCase(unittest.TestCase):
    def test_01_valid_grounded_response_passes(self):
        """Grounded response adhering to official rules passes validation."""
        text = (
            "PM Kisan Samman Nidhi provides ₹6,000 per year to eligible landholder farmer families. "
            "You can apply directly on the official portal at https://pmkisan.gov.in."
        )
        res = validate_ai_response(text, {"occupation": "Farmer", "ownsCultivableLand": True})
        self.assertTrue(res["is_valid"])
        self.assertFalse(res["has_contradiction"])
        self.assertEqual(len(res["warnings"]), 0)

    def test_02_catches_contradiction_for_ineligible_citizen(self):
        """Catch AI claiming citizen qualifies for PM-Kisan when profile is ineligible."""
        text = "Congratulations! You are eligible for PM-Kisan and will receive ₹6,000 per year."
        # Citizen is a student (not a farmer)
        res = validate_ai_response(text, {"occupation": "Student", "age": 22})
        self.assertTrue(res["has_contradiction"])
        self.assertTrue(any("Contradiction: AI stated eligibility for PM-Kisan" in w for w in res["warnings"]))
        # Sanitized text must contain official advisory
        self.assertIn("Official Eligibility Advisory", res["sanitized_text"])

    def test_03_catches_contradiction_for_landless_farmer(self):
        """Catch AI claiming PM-Kisan eligibility when farmer owns no cultivable land."""
        text = "You qualify for PM Kisan Samman Nidhi benefits."
        res = validate_ai_response(text, {"occupation": "Farmer", "ownsCultivableLand": False})
        self.assertTrue(res["has_contradiction"])
        self.assertTrue(any("does not own cultivable land" in w for w in res["warnings"]))

    def test_04_flags_fake_application_fees(self):
        """Flags responses that falsely demand an application fee for free government schemes."""
        texts = [
            "Please pay an application fee of ₹250 to submit your form.",
            "There is a portal fee of ₹500 for document verification.",
            "You need to pay ₹100 as processing fee."
        ]
        for t in texts:
            res = validate_ai_response(t)
            self.assertTrue(any("Unsupported scheme fee mention detected" in w for w in res["warnings"]))
            self.assertIn("zero application fee", res["sanitized_text"])

    def test_05_sanitizes_javascript_urls(self):
        """Replaces javascript: and data: URLs with safe placeholder '#'."""
        evil_text = "Click here to apply: javascript:alert(document.cookie) immediately."
        res = validate_ai_response(evil_text)
        self.assertNotIn("javascript:", res["sanitized_text"])
        self.assertIn("#", res["sanitized_text"])
        self.assertTrue(any("Disallowed script URL" in w for w in res["warnings"]))

    def test_06_url_extraction_helper(self):
        """Extracts URLs accurately from text."""
        text = "Visit https://pmkisan.gov.in or https://pmjay.gov.in for details."
        urls = extract_urls(text)
        self.assertEqual(len(urls), 2)
        self.assertIn("https://pmkisan.gov.in", urls)
        self.assertIn("https://pmjay.gov.in", urls)


if __name__ == "__main__":
    unittest.main()
