"""
JanSahayakAI — Phase 3.5 Data Authenticity Regression Test Suite.

Verifies that:
1. Schemes with sentinel maxIncome (10,000,000) do NOT reject citizens based on income.
2. Schemes with sentinel maxAge (120) do NOT reject citizens based on age.
3. Corrected income ceilings are enforced correctly.
4. BBBP returns UNKNOWN (awareness campaign, no direct disbursement).
5. Anna Bhagya description does NOT reference DBT cash.
6. SSY benefit text mentions quarterly review.
7. PM-YASASVI uses ₹2.5L income ceiling (not ₹3.5L).
8. PMAY does NOT use the obsolete ₹18L ceiling.
9. All 25 schemes remain in the catalog.

These tests run against both the corrected schemes.json and the
updated eligibility engine. All Phase 1-3 tests are preserved.
"""

import unittest
from core.eligibility import (
    evaluate_all_schemes,
    evaluate_scheme_eligibility,
    get_scheme_by_id,
    load_schemes_data,
    SENTINEL_MAX_AGE,
    SENTINEL_MAX_INCOME,
)
from schemas import SchemeEvaluationProfile


class Phase35DataCorrectnessTestCase(unittest.TestCase):
    """Regression tests for Phase 3.5 verified data corrections."""

    @classmethod
    def setUpClass(cls):
        cls.schemes = load_schemes_data()
        # Reset the cache to force a fresh load from the corrected file
        import core.eligibility as eng
        eng._SCHEMES_CACHE = []
        cls.schemes = load_schemes_data()

    # ─── Sentinel constants ───────────────────────────────────────────────────

    def test_01_sentinel_constants_are_correct(self):
        """SENTINEL_MAX_AGE must be 120; SENTINEL_MAX_INCOME must be 10,000,000."""
        self.assertEqual(SENTINEL_MAX_AGE, 120)
        self.assertEqual(SENTINEL_MAX_INCOME, 10_000_000)

    # ─── Ayushman Bharat (id=2) ───────────────────────────────────────────────

    def test_02_ayushman_bharat_income_sentinel_corrected(self):
        """
        Ayushman Bharat must NOT have maxIncome=300,000 (no official ₹3L cap).
        Verified correction: maxIncome must be the sentinel 10,000,000.
        """
        scheme = get_scheme_by_id(2)
        self.assertIsNotNone(scheme, "Ayushman Bharat (id=2) not found in catalog")
        self.assertEqual(
            scheme["maxIncome"],
            10_000_000,
            "Ayushman Bharat maxIncome must be sentinel 10,000,000 (no official flat cap). "
            "Previous incorrect value was 300,000."
        )

    def test_03_ayushman_bharat_does_not_reject_on_income_alone(self):
        """
        Ayushman Bharat must NOT return INELIGIBLE solely because income exceeds ₹3L.
        Eligibility is SECC/NFSA deprivation based, not a flat income limit.
        """
        scheme = get_scheme_by_id(2)
        # Income well above old incorrect ₹3L cap
        result = evaluate_scheme_eligibility(scheme, {"age": 35, "income": 500000, "gender": "Female"})
        self.assertNotEqual(
            result.status, "INELIGIBLE",
            "Ayushman Bharat must NOT reject citizen with income ₹5L "
            "(no official income ceiling exists)."
        )
        # Also check that no reason mentions ₹3L as a ceiling
        for reason in result.reasons:
            self.assertNotIn("300,000", reason,
                             "Income ceiling of ₹3,00,000 must not appear in Ayushman Bharat reasons.")

    def test_04_ayushman_bharat_official_income_field_documents_correction(self):
        """officialIncome must reference SECC/NFSA, not a flat ₹3L cap."""
        scheme = get_scheme_by_id(2)
        official_income = scheme.get("officialIncome", "")
        self.assertIn("SECC", official_income,
                      "officialIncome must document SECC-based eligibility")
        self.assertIn("CORRECTION", official_income,
                      "officialIncome must document the correction applied")

    # ─── PMAY (id=7) ─────────────────────────────────────────────────────────

    def test_05_pmay_obsolete_income_ceiling_removed(self):
        """
        PMAY maxIncome must NOT be 1,800,000 (no official basis).
        Corrected to 900,000 (MIG ceiling under PMAY-U 2.0).
        """
        scheme = get_scheme_by_id(7)
        self.assertIsNotNone(scheme, "PMAY (id=7) not found in catalog")
        self.assertNotEqual(
            scheme["maxIncome"],
            1_800_000,
            "PMAY maxIncome of ₹18L had no official basis and must be removed."
        )
        self.assertEqual(
            scheme["maxIncome"],
            900_000,
            "PMAY maxIncome must be 900,000 (MIG ceiling ₹9L per PMAY-U 2.0)."
        )

    def test_06_pmay_benefit_does_not_mention_obsolete_267_lakh(self):
        """
        PMAY benefit text must NOT reference ₹2.67 lakh (CLSS discontinued).
        Corrected benefit is up to ₹2.5 lakh.
        """
        scheme = get_scheme_by_id(7)
        benefit = scheme.get("benefit", "")
        self.assertNotIn(
            "2.67",
            benefit,
            "PMAY benefit must not mention ₹2.67 lakh (CLSS discontinued under PMAY-U 2.0)."
        )

    def test_07_pmay_high_income_correctly_rejected(self):
        """
        Citizen with income ₹15L (above MIG ₹9L ceiling) must be INELIGIBLE for PMAY.
        """
        scheme = get_scheme_by_id(7)
        result = evaluate_scheme_eligibility(scheme, {"age": 35, "income": 1_500_000})
        self.assertEqual(
            result.status, "INELIGIBLE",
            "Citizen earning ₹15L must be INELIGIBLE for PMAY (above MIG ₹9L ceiling)."
        )

    # ─── MUDRA (id=9) ────────────────────────────────────────────────────────

    def test_08_mudra_age_sentinel_corrected(self):
        """MUDRA maxAge must be sentinel 120 (no official upper age limit)."""
        scheme = get_scheme_by_id(9)
        self.assertIsNotNone(scheme, "MUDRA (id=9) not found in catalog")
        self.assertEqual(
            scheme["maxAge"],
            120,
            "MUDRA maxAge must be sentinel 120 (no official upper age limit). "
            "Previous incorrect value was 65."
        )

    def test_09_mudra_does_not_reject_age_above_65(self):
        """
        MUDRA must NOT return INELIGIBLE solely because applicant is older than 65.
        No statutory upper age limit exists in central guidelines.
        """
        scheme = get_scheme_by_id(9)
        result = evaluate_scheme_eligibility(
            scheme, {"age": 70, "income": 200000, "occupation": "Trader"}
        )
        self.assertNotEqual(
            result.status, "INELIGIBLE",
            "MUDRA must NOT reject a 70-year-old applicant (no official upper age limit)."
        )
        for reason in result.reasons:
            self.assertNotIn(
                "outside eligible range",
                reason,
                "MUDRA must not cite age as out of range for applicants 66-120."
            )

    # ─── Karnataka Anna Bhagya (id=13) ────────────────────────────────────────

    def test_10_anna_bhagya_description_no_dbt_cash(self):
        """
        Anna Bhagya description must NOT describe the discontinued DBT cash component
        as a current benefit (cash transfers discontinued February 2025).
        """
        scheme = get_scheme_by_id(13)
        self.assertIsNotNone(scheme, "Karnataka Anna Bhagya (id=13) not found")
        description = scheme.get("description", "")
        # Should not contain the old misleading phrase
        self.assertNotIn(
            "DBT cash support",
            description,
            "Anna Bhagya description must not claim DBT cash support is current "
            "(discontinued Feb 2025)."
        )
        # Should confirm grain distribution
        self.assertIn(
            "grain",
            description.lower(),
            "Anna Bhagya description should confirm physical grain distribution."
        )

    def test_11_anna_bhagya_officialSource_documents_correction(self):
        """officialSource must document the DBT correction."""
        scheme = get_scheme_by_id(13)
        official_source = scheme.get("officialSource", "")
        self.assertIn("CORRECTION", official_source,
                      "officialSource must document the DBT correction applied.")

    # ─── Stand Up India (id=14) ───────────────────────────────────────────────

    def test_12_standup_india_age_sentinel_corrected(self):
        """Stand Up India maxAge must be sentinel 120 (no official upper age limit)."""
        scheme = get_scheme_by_id(14)
        self.assertIsNotNone(scheme, "Stand Up India (id=14) not found")
        self.assertEqual(
            scheme["maxAge"],
            120,
            "Stand Up India maxAge must be sentinel 120. Previous incorrect value was 65."
        )

    def test_13_standup_india_does_not_reject_age_above_65(self):
        """
        Stand Up India must NOT return INELIGIBLE solely because applicant is older than 65.
        """
        scheme = get_scheme_by_id(14)
        result = evaluate_scheme_eligibility(
            scheme, {"age": 68, "income": 500000, "occupation": "Trader"}
        )
        self.assertNotEqual(
            result.status, "INELIGIBLE",
            "Stand Up India must NOT reject a 68-year-old applicant (no official upper age limit)."
        )

    # ─── Atal Pension Yojana (id=16) ─────────────────────────────────────────

    def test_14_apy_income_sentinel_corrected(self):
        """
        APY must NOT have maxIncome=500,000 (no ₹5L income cap exists).
        Corrected to sentinel 10,000,000.
        """
        scheme = get_scheme_by_id(16)
        self.assertIsNotNone(scheme, "APY (id=16) not found")
        self.assertNotEqual(
            scheme["maxIncome"],
            500_000,
            "APY maxIncome of ₹5L had no official basis; exclusion is IT-payer status."
        )
        self.assertEqual(
            scheme["maxIncome"],
            10_000_000,
            "APY maxIncome must be sentinel 10,000,000 (no official income ceiling)."
        )

    def test_15_apy_does_not_reject_income_above_5_lakh(self):
        """
        APY must NOT return INELIGIBLE solely because income exceeds ₹5L.
        The exclusion is income-tax-payer status, not an income level.
        """
        scheme = get_scheme_by_id(16)
        # Age within 18-40, income well above old ₹5L ceiling
        result = evaluate_scheme_eligibility(
            scheme, {"age": 30, "income": 700000, "occupation": "Worker"}
        )
        self.assertNotEqual(
            result.status, "INELIGIBLE",
            "APY must NOT reject citizen with income ₹7L (no official income cap)."
        )
        for reason in result.reasons:
            self.assertNotIn(
                "500,000",
                reason,
                "APY reasons must not cite a ₹5L income ceiling."
            )

    # ─── PM Vishwakarma (id=17) ───────────────────────────────────────────────

    def test_16_pm_vishwakarma_age_sentinel_corrected(self):
        """PM Vishwakarma maxAge must be sentinel 120 (no official upper age limit)."""
        scheme = get_scheme_by_id(17)
        self.assertIsNotNone(scheme, "PM Vishwakarma (id=17) not found")
        self.assertEqual(
            scheme["maxAge"],
            120,
            "PM Vishwakarma maxAge must be sentinel 120. Previous incorrect value was 60."
        )

    def test_17_pm_vishwakarma_does_not_reject_age_above_60(self):
        """
        PM Vishwakarma must NOT return INELIGIBLE solely because applicant is older than 60.
        The scheme has no official upper age limit (minimum age 18 only).
        """
        scheme = get_scheme_by_id(17)
        result = evaluate_scheme_eligibility(
            scheme, {"age": 65, "income": 100000, "occupation": "Worker"}
        )
        self.assertNotEqual(
            result.status, "INELIGIBLE",
            "PM Vishwakarma must NOT reject a 65-year-old artisan (no official upper age limit)."
        )

    # ─── PM-YASASVI (id=19) ───────────────────────────────────────────────────

    def test_18_pm_yasasvi_corrected_income_ceiling(self):
        """
        PM-YASASVI maxIncome must be 250,000 (₹2.5L), NOT 350,000 (₹3.5L).
        Official OBC/EBC/DNT limit is ₹2,50,000 per dosje.gov.in.
        """
        scheme = get_scheme_by_id(19)
        self.assertIsNotNone(scheme, "PM-YASASVI (id=19) not found")
        self.assertNotEqual(
            scheme["maxIncome"],
            350_000,
            "PM-YASASVI maxIncome of ₹3.5L was incorrect; must be corrected."
        )
        self.assertEqual(
            scheme["maxIncome"],
            250_000,
            "PM-YASASVI maxIncome must be 250,000 (₹2.5L per official dosje.gov.in guidelines)."
        )

    def test_19_pm_yasasvi_rejects_income_above_250k(self):
        """
        PM-YASASVI must return INELIGIBLE for income above ₹2.5L (e.g., ₹3L).
        """
        scheme = get_scheme_by_id(19)
        result = evaluate_scheme_eligibility(
            scheme, {"age": 15, "income": 300000, "occupation": "Student"}
        )
        self.assertEqual(
            result.status, "INELIGIBLE",
            "PM-YASASVI must reject student with income ₹3L (above ₹2.5L ceiling)."
        )

    def test_20_pm_yasasvi_social_category_corrected(self):
        """
        PM-YASASVI is for OBC, EBC, DNT sections — General is not a primary target.
        socialCategory must NOT include General.
        """
        scheme = get_scheme_by_id(19)
        categories = scheme.get("socialCategory", [])
        self.assertNotIn(
            "General",
            categories,
            "PM-YASASVI socialCategory must not include General (scheme targets OBC/EBC/DNT only)."
        )

    # ─── Sukanya Samriddhi Yojana (id=20) ─────────────────────────────────────

    def test_21_ssy_benefit_mentions_quarterly_review(self):
        """
        SSY benefit text must clarify that the interest rate is reviewed quarterly
        and is not a fixed permanent rate.
        """
        scheme = get_scheme_by_id(20)
        self.assertIsNotNone(scheme, "SSY (id=20) not found")
        benefit = scheme.get("benefit", "").lower()
        self.assertTrue(
            "quarter" in benefit or "reviewed" in benefit,
            "SSY benefit text must note that the 8.2% rate is reviewed quarterly by GoI."
        )

    # ─── Beti Bachao Beti Padhao (id=21) ─────────────────────────────────────

    def test_22_bbbp_income_sentinel_corrected(self):
        """
        BBBP maxIncome must be sentinel 10,000,000 (awareness campaign; no income restriction).
        Previous incorrect value was 500,000.
        """
        scheme = get_scheme_by_id(21)
        self.assertIsNotNone(scheme, "BBBP (id=21) not found")
        self.assertNotEqual(
            scheme["maxIncome"],
            500_000,
            "BBBP maxIncome of ₹5L had no official basis; scheme has no income restriction."
        )
        self.assertEqual(
            scheme["maxIncome"],
            10_000_000,
            "BBBP maxIncome must be sentinel 10,000,000 (no income restriction)."
        )

    def test_23_bbbp_age_sentinel_corrected(self):
        """
        BBBP maxAge must be sentinel 120 (no individual age cutoff).
        Previous incorrect value was 21.
        """
        scheme = get_scheme_by_id(21)
        self.assertNotEqual(
            scheme["maxAge"],
            21,
            "BBBP maxAge of 21 was incorrect; scheme has no individual age cutoff."
        )
        self.assertEqual(
            scheme["maxAge"],
            120,
            "BBBP maxAge must be sentinel 120 (no individual age cutoff)."
        )

    def test_24_bbbp_returns_unknown_not_ineligible_for_age_above_21(self):
        """
        BBBP must NOT return INELIGIBLE for a citizen aged 25 or older.
        (Engine uses dedicated evaluate_bbbp returning UNKNOWN — awareness campaign.)
        """
        scheme = get_scheme_by_id(21)
        result = evaluate_scheme_eligibility(scheme, {"age": 30, "gender": "Female", "income": 50000})
        self.assertNotEqual(
            result.status, "INELIGIBLE",
            "BBBP must NOT reject citizens over age 21; it is an awareness campaign."
        )
        # Engine returns UNKNOWN for BBBP (awareness scheme)
        self.assertEqual(
            result.status, "UNKNOWN",
            "BBBP must return UNKNOWN status (awareness campaign — no direct disbursement)."
        )

    def test_25_bbbp_reason_explains_campaign_nature(self):
        """
        BBBP evaluation reason must explain that it is an awareness campaign,
        not a direct cash-transfer scheme.
        """
        scheme = get_scheme_by_id(21)
        result = evaluate_scheme_eligibility(scheme, {"age": 10, "gender": "Female"})
        self.assertTrue(
            any("awareness" in r.lower() or "campaign" in r.lower() for r in result.reasons),
            "BBBP reasons must explain that it is an awareness/institutional campaign."
        )

    # ─── Sentinel behavior — universal schemes ────────────────────────────────

    def test_26_income_sentinel_schemes_skip_income_requirement(self):
        """
        Schemes with maxIncome=10,000,000 (sentinel) must NOT list income as
        a missing_field when income is not provided by citizen.
        Covers: Ayushman Bharat (id=2), APY (id=16), Sukanya Samriddhi (id=20).
        """
        sentinel_income_scheme_ids = [2, 16, 20]
        for sid in sentinel_income_scheme_ids:
            scheme = get_scheme_by_id(sid)
            result = evaluate_scheme_eligibility(scheme, {})
            self.assertNotIn(
                "income",
                result.missing_fields,
                f"Scheme id={sid} must NOT require income (sentinel maxIncome=10,000,000)."
            )

    def test_27_age_sentinel_schemes_skip_age_requirement(self):
        """
        Schemes with minAge=0 and maxAge=120 (fully universal age) must NOT list
        age as missing_field when age is not provided.
        Covers: MUDRA (id=9), Stand Up India (id=14), PM Vishwakarma has minAge=18.
        """
        # MUDRA: minAge=18, maxAge=120 → age is still required (minAge > 0)
        # Ayushman: minAge=0, maxAge=120 → age is fully universal
        scheme_ab = get_scheme_by_id(2)  # Ayushman Bharat: minAge=0, maxAge=120
        result = evaluate_scheme_eligibility(scheme_ab, {})
        self.assertNotIn(
            "age",
            result.missing_fields,
            "Ayushman Bharat (minAge=0, maxAge=120) must NOT require age field."
        )

    def test_28_income_sentinel_does_not_reject_high_income(self):
        """
        For schemes with income sentinel, providing a very high income (₹50L)
        must NOT produce an INELIGIBLE result solely on income grounds.
        Tests: Ayushman Bharat (id=2).
        """
        scheme = get_scheme_by_id(2)
        result = evaluate_scheme_eligibility(scheme, {"age": 45, "income": 5_000_000})
        for reason in result.reasons:
            self.assertNotIn(
                "exceeds maximum ceiling",
                reason,
                "Ayushman Bharat must not cite income ceiling for sentinel-income schemes."
            )

    # ─── Catalog integrity ────────────────────────────────────────────────────

    def test_29_catalog_still_has_25_schemes(self):
        """The corrected schemes.json must still contain exactly 25 schemes."""
        self.assertEqual(len(self.schemes), 25, "schemes.json must contain exactly 25 schemes.")

    def test_30_all_schemes_have_official_source(self):
        """Every scheme must have a non-empty officialSource for traceability."""
        for scheme in self.schemes:
            self.assertIn(
                "officialSource", scheme,
                f"Scheme id={scheme['id']} missing officialSource field."
            )
            self.assertTrue(
                len(scheme["officialSource"].strip()) > 0,
                f"Scheme id={scheme['id']} has empty officialSource."
            )

    def test_31_all_corrected_schemes_document_corrections(self):
        """
        Schemes that received data corrections must have CORRECTION documented
        in their officialIncome or officialAge or officialSource field.
        """
        corrected_ids = {
            2: "officialIncome",   # Ayushman Bharat income sentinel
            7: "officialIncome",   # PMAY income ceiling
            9: "officialAge",      # MUDRA age sentinel
            13: "officialSource",  # Anna Bhagya DBT
            14: "officialAge",     # Stand Up India age sentinel
            16: "officialIncome",  # APY income sentinel
            17: "officialAge",     # PM Vishwakarma age sentinel
            19: "officialIncome",  # PM-YASASVI income ceiling
            21: "officialIncome",  # BBBP income + age sentinel
        }
        for sid, field in corrected_ids.items():
            scheme = get_scheme_by_id(sid)
            value = scheme.get(field, "")
            self.assertIn(
                "CORRECTION",
                value,
                f"Scheme id={sid} field '{field}' must contain CORRECTION notice."
            )

    def test_32_evaluate_all_25_returns_correct_totals(self):
        """evaluate_all_schemes must still evaluate all 25 and return valid tri-state totals."""
        result = evaluate_all_schemes({"age": 30, "income": 200000, "occupation": "Worker", "gender": "Female"})
        self.assertEqual(result.total_evaluated, 25)
        self.assertEqual(
            result.eligible_count + result.ineligible_count + result.unknown_count,
            25,
            "Tri-state totals must sum to 25."
        )


if __name__ == "__main__":
    unittest.main()
