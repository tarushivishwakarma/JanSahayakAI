"""
Deterministic Scheme Eligibility Engine for JanSahayakAI.
Evaluates citizen profile against verified scheme criteria from schemes.json.
Implements mathematically sound Tri-State logic:
- ELIGIBLE: All mandatory criteria met and no exclusions.
- INELIGIBLE: At least one hard requirement failed or exclusion triggered.
- UNKNOWN: No disqualifications, but mandatory criteria cannot be verified due to missing profile information.
"""

import json
import os
from typing import Dict, Any, List, Optional, Union
from schemas import SchemeEvaluationProfile, SchemeEvaluationResult, SchemeEvaluationResponse

# Cache loaded schemes
_SCHEMES_CACHE: List[Dict[str, Any]] = []


def load_schemes_data() -> List[Dict[str, Any]]:
    """Loads and caches the 25 verified schemes from schemes.json."""
    global _SCHEMES_CACHE
    if not _SCHEMES_CACHE:
        json_path = os.path.join(os.path.dirname(__file__), "..", "schemes.json")
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                _SCHEMES_CACHE = json.load(f)
        except Exception as e:
            # Fallback relative to project root
            fallback_path = os.path.abspath("schemes.json")
            if os.path.exists(fallback_path):
                with open(fallback_path, "r", encoding="utf-8") as f:
                    _SCHEMES_CACHE = json.load(f)
            else:
                raise RuntimeError(f"Could not load schemes.json: {e}")
    return _SCHEMES_CACHE


def get_scheme_by_id(scheme_id: int) -> Optional[Dict[str, Any]]:
    """Retrieves a specific scheme by ID from the verified catalog."""
    schemes = load_schemes_data()
    for s in schemes:
        if s.get("id") == scheme_id:
            return s
    return None


def _normalize_profile(profile: Union[SchemeEvaluationProfile, Dict[str, Any]]) -> Dict[str, Any]:
    """Converts profile to a standard dictionary with normalized string values."""
    if isinstance(profile, SchemeEvaluationProfile):
        data = profile.model_dump()
    elif isinstance(profile, dict):
        data = dict(profile)
    else:
        data = {}

    # Normalize state, gender, occupation, socialCategory
    for key in ["state", "gender", "occupation", "socialCategory", "maritalStatus", "disability"]:
        val = data.get(key)
        if isinstance(val, str):
            data[key] = val.strip()

    return data


def evaluate_pm_kisan(scheme: Dict[str, Any], data: Dict[str, Any]) -> SchemeEvaluationResult:
    """
    Dedicated deterministic evaluator for Scheme 1: PM Kisan Samman Nidhi.
    Official requirements:
    - Farmer family owning cultivable land in their name.
    - Exclusions:
      1. Institutional landholders
      2. Constitutional post holders (former/present)
      3. Former/present Ministers, MPs, MLAs, MLCs, Mayors, District Panchayat Chairpersons
      4. Serving/retired Govt officers/employees (excluding Class IV/Group D)
      5. Pensioners with monthly pension >= 10,000
      6. Income tax payers in last assessment year
      7. Registered professionals (Doctors, Engineers, Lawyers, CA, Architects)
    """
    reasons: List[str] = []
    missing_fields: List[str] = []
    ineligible_reasons: List[str] = []

    # 1. Occupation check
    occupation = data.get("occupation")
    if occupation is None:
        missing_fields.append("occupation")
    elif occupation.lower() not in ["farmer", "kisan"]:
        ineligible_reasons.append(f"PM-Kisan is restricted to farmers (profile occupation: '{occupation}').")
    else:
        reasons.append("Occupation matches: Farmer.")

    # 2. Cultivable Land Ownership (MANDATORY)
    owns_land = data.get("ownsCultivableLand")
    if owns_land is None:
        missing_fields.append("ownsCultivableLand")
    elif owns_land is False or str(owns_land).lower() in ["false", "no", "0"]:
        ineligible_reasons.append("Applicant does not own cultivable land. PM-Kisan is restricted to landholder farmer families.")
    else:
        reasons.append("Cultivable land ownership verified.")

    # 3. Statutory Exclusion checks
    exclusions_map = [
        ("isInstitutionalLandholder", "Institutional landholder"),
        ("isConstitutionalPostHolder", "Constitutional post holder"),
        ("isGovernmentEmployee", "Serving/retired government officer or employee"),
        ("monthlyPensionGte10k", "Pensioner receiving monthly pension of ₹10,000 or more"),
        ("isIncomeTaxPayer", "Income tax payer in last assessment year"),
        ("isRegisteredProfessional", "Registered professional (Doctor, Engineer, Lawyer, CA, Architect)")
    ]

    for field, desc in exclusions_map:
        val = data.get(field)
        if val is True or str(val).lower() in ["true", "yes", "1"]:
            ineligible_reasons.append(f"Disqualified under statutory exclusion: {desc}.")

    # Status resolution
    if ineligible_reasons:
        status = "INELIGIBLE"
        final_reasons = ineligible_reasons
    elif missing_fields:
        status = "UNKNOWN"
        final_reasons = reasons + [f"Missing required information for evaluation: {', '.join(missing_fields)}."]
    else:
        status = "ELIGIBLE"
        reasons.append("All PM-Kisan statutory criteria and landholding requirements satisfied.")
        final_reasons = reasons

    return SchemeEvaluationResult(
        scheme_id=scheme["id"],
        scheme_name=scheme["name"],
        status=status,
        reasons=final_reasons,
        missing_fields=missing_fields,
        category=scheme.get("category"),
        benefit=scheme.get("benefit"),
        benefitHi=scheme.get("benefitHi"),
        applyLink=scheme.get("applyLink")
    )


def evaluate_scheme_eligibility(
    scheme: Dict[str, Any],
    profile: Union[SchemeEvaluationProfile, Dict[str, Any]]
) -> SchemeEvaluationResult:
    """
    Evaluates a single scheme against user profile using deterministic tri-state logic.
    """
    data = _normalize_profile(profile)

    # Special handling for PM-Kisan (Scheme 1)
    if scheme.get("id") == 1:
        return evaluate_pm_kisan(scheme, data)

    reasons: List[str] = []
    missing_fields: List[str] = []
    ineligible_reasons: List[str] = []

    # 1. State check
    scheme_state = scheme.get("state", "All")
    user_state = data.get("state")
    if scheme_state != "All":
        if not user_state:
            missing_fields.append("state")
        elif user_state.lower() != scheme_state.lower():
            ineligible_reasons.append(f"Scheme restricted to residents of {scheme_state} (profile state: '{user_state}').")
        else:
            reasons.append(f"State matches: {scheme_state}.")
    else:
        reasons.append("Open to residents across all Indian States & UTs.")

    # 2. Gender check
    scheme_gender = scheme.get("gender", "All")
    user_gender = data.get("gender")
    if scheme_gender != "All":
        if not user_gender:
            missing_fields.append("gender")
        elif user_gender.lower() != scheme_gender.lower():
            ineligible_reasons.append(f"Scheme restricted to {scheme_gender} applicants (profile gender: '{user_gender}').")
        else:
            reasons.append(f"Gender matches: {scheme_gender}.")

    # 3. Age check
    min_age = scheme.get("minAge", 0)
    max_age = scheme.get("maxAge", 120)
    is_age_universal = (min_age <= 0 and max_age >= 100)
    user_age = data.get("age")

    if user_age is not None:
        try:
            age_int = int(user_age)
            if age_int < min_age or age_int > max_age:
                ineligible_reasons.append(f"Age {age_int} is outside eligible range ({min_age}–{max_age} years).")
            else:
                reasons.append(f"Age {age_int} is within required range ({min_age}–{max_age} years).")
        except (ValueError, TypeError):
            missing_fields.append("age")
    else:
        if not is_age_universal:
            missing_fields.append("age")

    # 4. Income check
    max_income = scheme.get("maxIncome", 10000000)
    is_income_universal = (max_income >= 5000000)
    user_income = data.get("income")

    if user_income is not None:
        try:
            income_float = float(user_income)
            if income_float > max_income:
                ineligible_reasons.append(f"Income ₹{income_float:,.0f} exceeds maximum ceiling of ₹{max_income:,.0f}.")
            else:
                reasons.append(f"Income ₹{income_float:,.0f} is within ceiling of ₹{max_income:,.0f}.")
        except (ValueError, TypeError):
            missing_fields.append("income")
    else:
        if not is_income_universal:
            missing_fields.append("income")

    # 5. Occupation check
    scheme_occupations = scheme.get("occupation", ["All"])
    user_occ = data.get("occupation")
    if "All" not in scheme_occupations:
        if not user_occ:
            missing_fields.append("occupation")
        elif not any(user_occ.lower() == occ.lower() for occ in scheme_occupations):
            ineligible_reasons.append(f"Occupation '{user_occ}' not in eligible occupations: {', '.join(scheme_occupations)}.")
        else:
            reasons.append(f"Occupation matches: {user_occ}.")

    # 6. Social Category check
    scheme_cats = scheme.get("socialCategory", ["General", "OBC", "SC", "ST"])
    user_cat = data.get("socialCategory")
    if user_cat and scheme_cats and set(scheme_cats) != {"General", "OBC", "SC", "ST"}:
        if not any(user_cat.lower() == c.lower() for c in scheme_cats):
            ineligible_reasons.append(f"Social category '{user_cat}' not eligible. Required: {', '.join(scheme_cats)}.")
        else:
            reasons.append(f"Social category matches: {user_cat}.")

    # 7. Marital Status check (e.g. Widow Pension)
    scheme_marital = scheme.get("maritalStatus")
    user_marital = data.get("maritalStatus")
    if scheme_marital:
        if not user_marital:
            missing_fields.append("maritalStatus")
        elif user_marital.lower() not in [scheme_marital.lower(), "widowed"]:
            ineligible_reasons.append(f"Marital status must be '{scheme_marital}' (profile: '{user_marital}').")
        else:
            reasons.append(f"Marital status matches: {scheme_marital}.")

    # 8. Disability check (e.g. Disability Pension)
    scheme_disability = scheme.get("disability", "Any")
    user_disability = data.get("disability")
    if scheme_disability == "Yes":
        if not user_disability:
            missing_fields.append("disability")
        elif str(user_disability).lower() not in ["yes", "true", "1"]:
            ineligible_reasons.append("Scheme requires certified disability status.")
        else:
            reasons.append("Disability status confirmed.")

    # Status resolution
    if ineligible_reasons:
        status = "INELIGIBLE"
        final_reasons = ineligible_reasons
    elif missing_fields:
        status = "UNKNOWN"
        final_reasons = reasons + [f"Missing required information for evaluation: {', '.join(missing_fields)}."]
    else:
        status = "ELIGIBLE"
        final_reasons = reasons

    return SchemeEvaluationResult(
        scheme_id=scheme["id"],
        scheme_name=scheme["name"],
        status=status,
        reasons=final_reasons,
        missing_fields=missing_fields,
        category=scheme.get("category"),
        benefit=scheme.get("benefit"),
        benefitHi=scheme.get("benefitHi"),
        applyLink=scheme.get("applyLink")
    )


def evaluate_all_schemes(
    profile: Union[SchemeEvaluationProfile, Dict[str, Any]]
) -> SchemeEvaluationResponse:
    """
    Evaluates citizen profile against all 25 schemes in the verified catalog.
    """
    schemes = load_schemes_data()
    results: List[SchemeEvaluationResult] = []

    for scheme in schemes:
        result = evaluate_scheme_eligibility(scheme, profile)
        results.append(result)

    eligible_count = sum(1 for r in results if r.status == "ELIGIBLE")
    ineligible_count = sum(1 for r in results if r.status == "INELIGIBLE")
    unknown_count = sum(1 for r in results if r.status == "UNKNOWN")

    return SchemeEvaluationResponse(
        total_evaluated=len(results),
        eligible_count=eligible_count,
        ineligible_count=ineligible_count,
        unknown_count=unknown_count,
        results=results
    )
