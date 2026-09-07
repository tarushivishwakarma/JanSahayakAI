"""
JanSahayakAI — Deterministic Eligibility Engine Test Suite.
Verifies tri-state logic across all 25 verified schemes:
- Complete catalog coverage.
- Correct age, income, state, gender, disability, marital status enforcement.
- Proper UNKNOWN state when mandatory criteria are missing.
"""

import unittest
from core.eligibility import (
    evaluate_all_schemes,
    evaluate_scheme_eligibility,
    get_scheme_by_id,
    load_schemes_data
)
from schemas import SchemeEvaluationProfile
from fastapi.testclient import TestClient
from main import app


class EligibilityEngineTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schemes = load_schemes_data()
        cls.client = TestClient(app)

    def test_01_catalog_has_25_schemes(self):
        """Verified catalog must contain exactly 25 schemes."""
        self.assertEqual(len(self.schemes), 25)

    def test_02_all_schemes_evaluated_by_engine(self):
        """evaluate_all_schemes must return evaluation for all 25 schemes."""
        res = evaluate_all_schemes({"age": 25, "income": 150000, "occupation": "Student", "state": "Uttar Pradesh", "gender": "Female"})
        self.assertEqual(res.total_evaluated, 25)
        self.assertEqual(len(res.results), 25)
        self.assertEqual(res.eligible_count + res.ineligible_count + res.unknown_count, 25)

    def test_03_tri_state_values_are_strictly_valid(self):
        """Every result status must strictly be ELIGIBLE, INELIGIBLE, or UNKNOWN."""
        res = evaluate_all_schemes({})
        for r in res.results:
            self.assertIn(r.status, ["ELIGIBLE", "INELIGIBLE", "UNKNOWN"])
            self.assertIsInstance(r.reasons, list)

    def test_04_age_boundary_enforcement(self):
        """Older applicant (65) must be INELIGIBLE for youth scholarships."""
        # Scheme 3: National Scholarship Portal (age 16-30)
        scheme_nsp = get_scheme_by_id(3)
        res = evaluate_scheme_eligibility(scheme_nsp, {"age": 65, "income": 50000, "occupation": "Student"})
        self.assertEqual(res.status, "INELIGIBLE")
        self.assertTrue(any("Age 65 is outside eligible range" in r for r in res.reasons))

    def test_05_income_ceiling_enforcement(self):
        """Applicant with income above cap must be INELIGIBLE."""
        # Scheme 12: Maharashtra Sanjay Gandhi Niradhar Scheme (maxIncome 21000)
        scheme_sg = get_scheme_by_id(12)
        res = evaluate_scheme_eligibility(scheme_sg, {"age": 45, "income": 100000, "state": "Maharashtra"})
        self.assertEqual(res.status, "INELIGIBLE")
        self.assertTrue(any("exceeds maximum ceiling" in r for r in res.reasons))

    def test_06_state_restriction_enforcement(self):
        """Resident of Bihar must be INELIGIBLE for Tamil Nadu or UP schemes."""
        # Scheme 25: Tamil Nadu Free Laptop Scheme
        scheme_tn = get_scheme_by_id(25)
        res = evaluate_scheme_eligibility(scheme_tn, {"state": "Bihar", "age": 18, "occupation": "Student"})
        self.assertEqual(res.status, "INELIGIBLE")
        self.assertTrue(any("restricted to residents of Tamil Nadu" in r for r in res.reasons))

    def test_07_gender_restriction_enforcement(self):
        """Male applicant must be INELIGIBLE for female-specific schemes."""
        # Scheme 20: Sukanya Samriddhi Yojana (Gender: Female)
        scheme_ssy = get_scheme_by_id(20)
        res = evaluate_scheme_eligibility(scheme_ssy, {"gender": "Male", "age": 5})
        self.assertEqual(res.status, "INELIGIBLE")
        self.assertTrue(any("restricted to Female" in r for r in res.reasons))

    def test_08_marital_status_enforcement(self):
        """Married applicant must be INELIGIBLE for widow pension."""
        # Scheme 4: Indira Gandhi National Widow Pension (maritalStatus: Widow)
        scheme_widow = get_scheme_by_id(4)
        res = evaluate_scheme_eligibility(scheme_widow, {"gender": "Female", "maritalStatus": "Married", "age": 50, "income": 50000})
        self.assertEqual(res.status, "INELIGIBLE")
        self.assertTrue(any("Marital status must be 'Widow'" in r for r in res.reasons))

    def test_09_disability_pension_enforcement(self):
        """Applicant without disability must be INELIGIBLE for disability pension."""
        # Scheme 8: Indira Gandhi National Disability Pension
        scheme_disability = get_scheme_by_id(8)
        res_no = evaluate_scheme_eligibility(scheme_disability, {"disability": "No", "age": 30, "income": 50000})
        self.assertEqual(res_no.status, "INELIGIBLE")

        # Missing disability yields UNKNOWN
        res_none = evaluate_scheme_eligibility(scheme_disability, {"age": 30, "income": 50000})
        self.assertEqual(res_none.status, "UNKNOWN")
        self.assertIn("disability", res_none.missing_fields)

    def test_10_missing_mandatory_fields_yield_unknown(self):
        """Scheme requiring state yields UNKNOWN if state is not provided."""
        # Scheme 10: Kanya Sumangala (UP only)
        scheme_ks = get_scheme_by_id(10)
        res = evaluate_scheme_eligibility(scheme_ks, {"gender": "Female", "age": 10, "income": 50000})
        self.assertEqual(res.status, "UNKNOWN")
        self.assertIn("state", res.missing_fields)

    def test_11_pydantic_profile_object_supported(self):
        """Engine accepts Pydantic SchemeEvaluationProfile instances."""
        profile = SchemeEvaluationProfile(
            age=22,
            income=120000.0,
            occupation="Student",
            state="Uttar Pradesh",
            gender="Female"
        )
        res = evaluate_all_schemes(profile)
        self.assertEqual(res.total_evaluated, 25)
        self.assertGreater(res.eligible_count, 0)

    def test_12_api_evaluate_endpoint_response_structure(self):
        """API POST /api/schemes/evaluate returns well-formed response."""
        resp = self.client.post("/api/schemes/evaluate", json={
            "age": 24,
            "income": 150000,
            "occupation": "Student",
            "state": "Karnataka",
            "gender": "Female"
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["total_evaluated"], 25)
        self.assertIn("eligible_count", data)
        self.assertIn("ineligible_count", data)
        self.assertIn("unknown_count", data)
        self.assertEqual(len(data["results"]), 25)


if __name__ == "__main__":
    unittest.main()
