"""
JanSahayakAI — PM-Kisan Correctness Test Suite.
Verifies strict statutory criteria for PM Kisan Samman Nidhi:
- Requires cultivable landholding in applicant's name.
- Missing landholding yields UNKNOWN, never ELIGIBLE.
- Explicit non-ownership yields INELIGIBLE.
- Enforces all 6 statutory exclusion categories.
"""

import unittest
from core.eligibility import evaluate_all_schemes, get_scheme_by_id, evaluate_scheme_eligibility
from fastapi.testclient import TestClient
from main import app


class PMKisanCorrectnessTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.scheme = get_scheme_by_id(1)
        cls.assertIsNotNone(cls.scheme, "PM-Kisan (ID 1) not found in schemes.json")
        cls.client = TestClient(app)

    def test_01_eligible_farmer_with_cultivable_land(self):
        """Farmer owning cultivable land with no exclusions must be ELIGIBLE."""
        profile = {
            "occupation": "Farmer",
            "ownsCultivableLand": True,
            "age": 42,
            "income": 120000,
            "state": "Uttar Pradesh"
        }
        res = evaluate_scheme_eligibility(self.scheme, profile)
        self.assertEqual(res.status, "ELIGIBLE")
        self.assertIn("Cultivable land ownership verified.", res.reasons)

    def test_02_missing_land_ownership_yields_unknown(self):
        """If landholding is missing, status must be UNKNOWN, never ELIGIBLE."""
        profile = {
            "occupation": "Farmer",
            "age": 35,
            "income": 90000
        }
        res = evaluate_scheme_eligibility(self.scheme, profile)
        self.assertEqual(res.status, "UNKNOWN")
        self.assertIn("ownsCultivableLand", res.missing_fields)

    def test_03_non_landholder_farmer_is_ineligible(self):
        """Farmer without land ownership must be INELIGIBLE."""
        profile = {
            "occupation": "Farmer",
            "ownsCultivableLand": False,
            "age": 35,
            "income": 90000
        }
        res = evaluate_scheme_eligibility(self.scheme, profile)
        self.assertEqual(res.status, "INELIGIBLE")
        self.assertTrue(any("does not own cultivable land" in r for r in res.reasons))

    def test_04_non_farmer_occupation_is_ineligible(self):
        """Non-farmer occupations (Student, Worker, etc.) must be INELIGIBLE."""
        for occ in ["Student", "Worker", "Trader", "Doctor", "Engineer"]:
            profile = {
                "occupation": occ,
                "ownsCultivableLand": True,
                "age": 30,
                "income": 100000
            }
            res = evaluate_scheme_eligibility(self.scheme, profile)
            self.assertEqual(res.status, "INELIGIBLE", f"Failed for occupation {occ}")

    def test_05_statutory_exclusion_institutional_landholder(self):
        """Institutional landholders are disqualified."""
        profile = {
            "occupation": "Farmer",
            "ownsCultivableLand": True,
            "isInstitutionalLandholder": True
        }
        res = evaluate_scheme_eligibility(self.scheme, profile)
        self.assertEqual(res.status, "INELIGIBLE")
        self.assertTrue(any("Institutional landholder" in r for r in res.reasons))

    def test_06_statutory_exclusion_constitutional_post_holder(self):
        """Constitutional post holders are disqualified."""
        profile = {
            "occupation": "Farmer",
            "ownsCultivableLand": True,
            "isConstitutionalPostHolder": True
        }
        res = evaluate_scheme_eligibility(self.scheme, profile)
        self.assertEqual(res.status, "INELIGIBLE")
        self.assertTrue(any("Constitutional post holder" in r for r in res.reasons))

    def test_07_statutory_exclusion_government_employee(self):
        """Government employees/officers are disqualified."""
        profile = {
            "occupation": "Farmer",
            "ownsCultivableLand": True,
            "isGovernmentEmployee": True
        }
        res = evaluate_scheme_eligibility(self.scheme, profile)
        self.assertEqual(res.status, "INELIGIBLE")
        self.assertTrue(any("government officer or employee" in r for r in res.reasons))

    def test_08_statutory_exclusion_pension_gte_10k(self):
        """Pensioners with monthly pension >= 10,000 are disqualified."""
        profile = {
            "occupation": "Farmer",
            "ownsCultivableLand": True,
            "monthlyPensionGte10k": True
        }
        res = evaluate_scheme_eligibility(self.scheme, profile)
        self.assertEqual(res.status, "INELIGIBLE")
        self.assertTrue(any("₹10,000 or more" in r for r in res.reasons))

    def test_09_statutory_exclusion_income_tax_payer(self):
        """Income tax payers in the last assessment year are disqualified."""
        profile = {
            "occupation": "Farmer",
            "ownsCultivableLand": True,
            "isIncomeTaxPayer": True
        }
        res = evaluate_scheme_eligibility(self.scheme, profile)
        self.assertEqual(res.status, "INELIGIBLE")
        self.assertTrue(any("Income tax payer" in r for r in res.reasons))

    def test_10_statutory_exclusion_registered_professional(self):
        """Registered professionals (Doctors, Lawyers, Engineers, CA) are disqualified."""
        profile = {
            "occupation": "Farmer",
            "ownsCultivableLand": True,
            "isRegisteredProfessional": True
        }
        res = evaluate_scheme_eligibility(self.scheme, profile)
        self.assertEqual(res.status, "INELIGIBLE")
        self.assertTrue(any("Registered professional" in r for r in res.reasons))

    def test_11_api_evaluate_pm_kisan_endpoint_integration(self):
        """POST /api/schemes/evaluate integration test for PM-Kisan."""
        resp = self.client.post("/api/schemes/evaluate", json={
            "occupation": "Farmer",
            "ownsCultivableLand": True,
            "age": 45,
            "income": 100000,
            "isGovernmentEmployee": False
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        pm_kisan = next(r for r in data["results"] if r["scheme_id"] == 1)
        self.assertEqual(pm_kisan["status"], "ELIGIBLE")


if __name__ == "__main__":
    unittest.main()
