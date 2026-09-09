"""
AI Response Hallucination Shield for JanSahayakAI.
Performs deterministic post-generation validation on AI responses:
1. Detects contradiction of deterministic eligibility rules (e.g. PM-Kisan without landholding).
2. Flags unsupported scheme fee or payment demands.
3. Detects unsafe, non-official or malicious URLs.
4. Provides sanitization and grounded disclaimers.
"""

import re
from typing import Dict, Any, List, Optional
from core.eligibility import evaluate_all_schemes, load_schemes_data

# Known official government domains in verified catalog
OFFICIAL_DOMAINS = [
    "pmkisan.gov.in",
    "pmjay.gov.in",
    "scholarships.gov.in",
    "nsap.nic.in",
    "mahadbt.maharashtra.gov.in",
    "ahd.kar.nic.in",
    "standupmitra.in",
    "pmmvy.wcd.gov.in",
    "npscra.nsdl.co.in",
    "pmvishwakarma.gov.in",
    "nfsa.gov.in",
    "yet.nta.ac.in",
    "indiapost.gov.in",
    "wcd.nic.in",
    "pmjdy.gov.in",
    "pmfby.gov.in",
    "soilhealth.dac.gov.in",
    "tamilnadu.gov.in",
    "jansahayak.in",
    "gov.in",
    "nic.in"
]


def extract_urls(text: str) -> List[str]:
    """Extracts all URLs found in the text, trimming trailing punctuation."""
    if not text:
        return []
    url_pattern = r'https?://[^\s<>"\')]+|javascript:[^\s<>"\')]+|data:[^\s<>"\')]+'
    raw_urls = re.findall(url_pattern, text, re.IGNORECASE)
    cleaned = []
    for u in raw_urls:
        c = u.rstrip('.,;:!?')
        if c:
            cleaned.append(c)
    return cleaned


def validate_ai_response(
    response_text: str,
    user_profile: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Validates generated AI text against deterministic scheme eligibility ground truth.
    Returns validation result with flags, warnings, and sanitized/corrected text.
    """
    if not response_text or not isinstance(response_text, str):
        return {
            "is_valid": True,
            "has_contradiction": False,
            "warnings": [],
            "sanitized_text": response_text or ""
        }

    warnings: List[str] = []
    has_contradiction = False
    sanitized_text = response_text

    # 1. URL Safety Check
    urls = extract_urls(response_text)
    for url in urls:
        url_lower = url.lower()
        if url_lower.startswith("javascript:") or url_lower.startswith("data:") or url_lower.startswith("vbscript:"):
            warnings.append(f"Disallowed script URL detected: {url}")
            sanitized_text = sanitized_text.replace(url, "#")
            has_contradiction = True
        elif url_lower.startswith("http://") or url_lower.startswith("https://"):
            # Check domain against official domains or generic edu/gov
            domain_match = re.search(r'https?://([^/:\s]+)', url_lower)
            if domain_match:
                domain = domain_match.group(1).rstrip('.,;:!?')
                is_safe_domain = any(domain.endswith(d) for d in OFFICIAL_DOMAINS) or domain.endswith(".gov.in") or domain.endswith(".nic.in")
                if not is_safe_domain:
                    warnings.append(f"Non-official external domain in link: {domain}")

    # 2. Fake Fee / Payment Demands Check
    fee_patterns = [
        r'(?:application|registration|processing|portal)\s+fee\s*(?:of|is|:)?\s*₹?\s*(\d+)',
        r'pay\s+₹?\s*(\d+)\s+(?:as|for)\s+(?:registration|application|processing)',
        r'शुल्क\s*(?:₹|रुपये)?\s*(\d+)'
    ]
    for pattern in fee_patterns:
        match = re.search(pattern, response_text, re.IGNORECASE)
        if match:
            warnings.append(f"Unsupported scheme fee mention detected: '{match.group(0)}'. JanSahayak schemes are free government programs.")
            # Append clarifying note
            disclaimer = "\n\n*(Note: Official Indian welfare scheme applications through government portals have zero application fee. Please do not pay any third-party fee.)*"
            if disclaimer not in sanitized_text:
                sanitized_text += disclaimer

    # 3. Deterministic Eligibility Contradiction Check (if profile provided)
    if user_profile:
        eval_response = evaluate_all_schemes(user_profile)
        ineligible_map = {
            r.scheme_id: r for r in eval_response.results if r.status == "INELIGIBLE"
        }

        # Check PM-Kisan (ID 1)
        if 1 in ineligible_map:
            pm_result = ineligible_map[1]
            # If AI asserts user IS eligible for PM-Kisan
            positive_claims = [
                r'you are eligible for pm[ -]?kisan',
                r'you qualify for pm[ -]?kisan',
                r'you can get pm[ -]?kisan',
                r'आप पीएम किसान के लिए पात्र हैं',
                r'आप किसान सम्मान निधि के पात्र हैं'
            ]
            for claim in positive_claims:
                if re.search(claim, response_text, re.IGNORECASE):
                    has_contradiction = True
                    reason_str = "; ".join(pm_result.reasons)
                    warnings.append(f"Contradiction: AI stated eligibility for PM-Kisan, but citizen is ineligible: {reason_str}")
                    correction_notice = f"\n\n*(Official Eligibility Advisory: Based on verified statutory criteria, PM-Kisan requires cultivable landholding in the applicant's name with no disqualifications. Status: INELIGIBLE — {reason_str})*"
                    sanitized_text += correction_notice
                    break

        # Check other schemes if explicitly claimed
        for scheme_id, r in ineligible_map.items():
            scheme_name_lower = r.scheme_name.lower()
            pattern = rf'you are eligible for {re.escape(scheme_name_lower)}'
            if re.search(pattern, response_text, re.IGNORECASE):
                has_contradiction = True
                reason_str = "; ".join(r.reasons)
                warnings.append(f"Contradiction: AI stated eligibility for {r.scheme_name}, but citizen is ineligible: {reason_str}")

    return {
        "is_valid": not has_contradiction and len(warnings) == 0,
        "has_contradiction": has_contradiction,
        "warnings": warnings,
        "sanitized_text": sanitized_text
    }
