import json
import logging
import os
import re
from typing import Any, Dict, List
import httpx
from .config import LLM_API_KEY, LLM_MODEL, LLM_BASE_URL
from .schemas import ChatRequest
from core.eligibility import evaluate_all_schemes
from core.ai_validator import validate_ai_response

logger = logging.getLogger("jansahayak.ai")

# Load schemes data once at module import; log failures with structured logger
SCHEMES_DATA = []
try:
    schemes_path = os.path.join(os.path.dirname(__file__), "..", "schemes.json")
    with open(schemes_path, "r", encoding="utf-8") as f:
        SCHEMES_DATA = json.load(f)
    logger.info("AI service: loaded %d schemes for LLM grounding", len(SCHEMES_DATA))
except Exception as e:
    logger.error("AI service: could not load schemes.json for LLM grounding: %s", type(e).__name__)


def mask_pii_text(text: str) -> str:
    """
    Masks sensitive identifiers like Aadhaar and PAN numbers in text.
    - Aadhaar: 12 digits (with optional spaces or dashes) -> XXXX-XXXX-1234
    - PAN: 5 uppercase letters, 4 digits, 1 uppercase letter -> XXXXX1234X
    Does not redact non-identifier numbers (e.g. age, income, pincodes).
    """
    if not text or not isinstance(text, str):
        return text

    # Aadhaar masking: match 12 digits formatted as 4-4-4 or 12 continuous digits
    text = re.sub(
        r'\b\d{4}[-\s]?\d{4}[-\s]?(\d{4})\b',
        r'XXXX-XXXX-\1',
        text
    )

    # PAN masking: 5 letters, 4 digits, 1 letter (e.g., ABCDE1234F -> XXXXX1234X)
    text = re.sub(
        r'\b[A-Za-z]{5}(\d{4})[A-Za-z]\b',
        r'XXXXX\1X',
        text
    )

    return text


def sanitize_context(context: Any) -> Any:
    """
    Sanitizes context dictionaries or lists before passing to LLM.
    - Masks Aadhaar and PAN values.
    - Removes unnecessary full street addresses while keeping high-level region if available.
    - Drops raw binary/image data or raw document text to prevent sensitive data leakage.
    - Preserves eligibility-relevant fields (age, income, occupation, category, state).
    """
    if isinstance(context, dict):
        sanitized = {}
        for k, v in context.items():
            k_str = str(k).lower()
            # Drop unnecessary raw images or raw extracted text
            if k_str in ("image", "document_image", "raw_image", "raw_text", "raw_extracted_text"):
                continue
            # Redact full street addresses
            if k_str in ("address", "full_address", "street_address", "residential_address", "permanent_address"):
                sanitized[k] = "[Address redacted for privacy]"
                continue
            # If the key itself is explicitly aadhaar or pan, ensure masked
            if "aadhaar" in k_str:
                sanitized[k] = mask_pii_text(str(v))
                continue
            if "pan" in k_str and ("number" in k_str or "card" in k_str or k_str == "pan"):
                sanitized[k] = mask_pii_text(str(v))
                continue
            sanitized[k] = sanitize_context(v)
        return sanitized
    elif isinstance(context, list):
        return [sanitize_context(item) for item in context]
    elif isinstance(context, str):
        return mask_pii_text(context)
    else:
        return context


def _find_mentioned_schemes(text: str):
    """
    Identifies schemes from schemes.json mentioned in text/query
    using names, Hindi names, and common aliases.
    """
    if not text or not SCHEMES_DATA:
        return []

    q = text.lower()
    matched = []

    for s in SCHEMES_DATA:
        name_en = s.get("name", "").lower()
        name_hi = s.get("nameHi", "").lower()

        # Build alias list for robust matching
        aliases = [name_en, name_hi]
        if "pm kisan" in name_en or "kisan" in name_en:
            aliases.extend(["pm kisan", "pm-kisan", "pmkisan", "kisan samman nidhi", "पीएम किसान", "किसान सम्मान निधि"])
        if "ayushman" in name_en:
            aliases.extend(["ayushman", "ayushman bharat", "pmjay", "pm-jay", "आयुष्मान", "आयुष्मान भारत"])
        if "scholarship" in name_en:
            aliases.extend(["scholarship", "nsp", "national scholarship", "छात्रवृत्ति"])
        if "widow" in name_en:
            aliases.extend(["widow pension", "विधवा पेंशन"])
        if "old age" in name_en:
            aliases.extend(["old age pension", "वृद्धावस्था पेंशन"])
        if "awas" in name_en or "pmay" in name_en:
            aliases.extend(["pm awas", "pmay", "awas yojana", "आवास योजना"])
        if "ujjwala" in name_en:
            aliases.extend(["ujjwala", "उज्ज्वला", "gas cylinder"])
        if "mudra" in name_en:
            aliases.extend(["mudra", "मुद्रा योजना", "mudra loan"])
        if "atal pension" in name_en or "apy" in name_en:
            aliases.extend(["atal pension", "apy", "अटल पेंशन"])
        if "sukanya" in name_en:
            aliases.extend(["sukanya", "sukanya samriddhi", "सुकन्या समृद्धि"])
        if "vishwakarma" in name_en:
            aliases.extend(["vishwakarma", "विश्वकर्मा"])
        if "svanidhi" in name_en:
            aliases.extend(["svanidhi", "pm svanidhi", "street vendor", "स्वनिधि"])
        if "matru vandana" in name_en or "pmmvy" in name_en:
            aliases.extend(["matru vandana", "pmmvy", "मातृ वंदना"])
        if "stand-up" in name_en or "stand up" in name_en:
            aliases.extend(["stand up india", "stand-up india", "स्टैंड-अप इंडिया"])
        if "fasal bima" in name_en:
            aliases.extend(["fasal bima", "crop insurance", "फसल बीमा"])
        if "kisan credit" in name_en or "kcc" in name_en:
            aliases.extend(["kisan credit card", "kcc", "किसान क्रेडिट कार्ड"])
        if "shram yogi" in name_en or "pmsym" in name_en:
            aliases.extend(["shram yogi", "pmsym", "श्रम योगी"])
        if "beti bachao" in name_en:
            aliases.extend(["beti bachao", "bbbp", "बेटी बचाओ"])
        if "kaushal vikas" in name_en or "pmkvy" in name_en:
            aliases.extend(["pmkvy", "kaushal vikas", "skill india", "कौशल विकास"])
        if "nsap" in name_en:
            aliases.extend(["nsap", "national social assistance"])
        if "ddu-gky" in name_en:
            aliases.extend(["ddu-gky", "deendayal upadhyaya grameen kaushalya"])
        if "pmegp" in name_en:
            aliases.extend(["pmegp", "prime minister employment generation"])
        if "health mission" in name_en or "nhm" in name_en:
            aliases.extend(["nhm", "national health mission"])
        if "nrega" in name_en:
            aliases.extend(["mgnrega", "nrega", "मनरेगा"])
        if "mid-day" in name_en or "poshan" in name_en:
            aliases.extend(["mid-day meal", "pm poshan", "मिड-डे मील"])

        # Check match with boundary or substring
        for alias in aliases:
            if alias and (alias in q or re.search(r'\b' + re.escape(alias) + r'\b', q)):
                matched.append(s)
                break

    return matched


def _format_scheme_summary(scheme: dict) -> dict:
    """Formats full verified details of a single scheme for LLM context."""
    official_age = scheme.get("officialAge", "Not specified in official source")
    official_income = scheme.get("officialIncome", "Not specified in official source")
    official_disability = scheme.get("officialDisability", "Not specified in official source")
    official_criteria = scheme.get("officialEligibility") or scheme.get("description")

    return {
        "id": scheme.get("id"),
        "name": scheme.get("name"),
        "name_hi": scheme.get("nameHi"),
        "category": scheme.get("category"),
        "state": scheme.get("state"),
        "description": scheme.get("description"),
        "description_hi": scheme.get("descriptionHi"),
        "benefit": scheme.get("benefit"),
        "benefit_hi": scheme.get("benefitHi"),
        "eligibility": {
            "official_criteria": official_criteria,
            "target_occupations": scheme.get("occupation", []),
            "age_limit": official_age,
            "income_limit": official_income,
            "social_categories": scheme.get("socialCategory", []),
            "gender": scheme.get("gender", "All"),
            "disability_criteria": official_disability,
            "exclusions": scheme.get("exclusions", [])
        },
        "required_documents": scheme.get("documents", []),
        "official_apply_link": scheme.get("applyLink", ""),
        "official_source": scheme.get("officialSource", scheme.get("applyLink", ""))
    }


def _format_compact_scheme(scheme: dict) -> str:
    """Formats a concise one-line summary of a scheme for the general catalog."""
    occupations = ", ".join(scheme.get("occupation", []))
    age_info = scheme.get("officialAge", "Not specified")
    income_info = scheme.get("officialIncome", "Not specified")
    docs = ", ".join(scheme.get("documents", []))
    return (
        f"- ID {scheme.get('id')}: {scheme.get('name')} / {scheme.get('nameHi')} | "
        f"Category: {scheme.get('category')} | Target: {occupations} | "
        f"Age: {age_info} | Income: {income_info} | "
        f"Benefit: {scheme.get('benefit')} ({scheme.get('benefitHi', '')}) | "
        f"Docs: {docs} | Portal: {scheme.get('applyLink')}"
    )



async def generate_chat_response(request: ChatRequest) -> str:
    """
    Generates an accurate, grounded AI response for citizen queries using verified
    government scheme data and citizen-focused instructions with automated retries.
    """
    if not LLM_API_KEY:
        raise ValueError("LLM_API_KEY is not configured.")

    # Combine recent conversation for scheme identification
    conversation_text = " ".join([m.content for m in request.messages[-3:] if m.content])
    detected_schemes = _find_mentioned_schemes(conversation_text)

    # Build system instructions
    lang = request.language or "en"
    lang_instruction = (
        "Respond in clear, natural Hindi using Devanagari script."
        if lang == "hi"
        else "Respond in clear, simple English."
    )

    system_prompt = (
        "You are JanSahayakAI — a helpful, polite, and accurate citizen-focused assistant "
        "for Indian government schemes and citizen services.\n\n"
        "CORE DIRECTIVES:\n"
        "1. ACCURACY & ZERO HALLUCINATION:\n"
        "   - Use the verified schemes catalog provided below as your primary source of truth.\n"
        "   - NEVER invent fake government schemes, fake eligibility rules, fake monetary amounts, fake fees, or fake portal links.\n"
        "   - If a specific piece of information is genuinely not present in the verified dataset, clearly state that it is not in JanSahayak's verified database and recommend checking the official government portal.\n"
        "2. ELIGIBILITY CRITERIA & STRICT FACTUAL GROUNDING:\n"
        "   - The AI must NEVER convert an unknown or unspecified dataset field into a factual eligibility claim.\n"
        "   - If an age limit is 'Not specified in official source', state clearly that the official information available does not specify a general age limit for this scheme, rather than inventing an age range (do NOT claim an 18–120 age range).\n"
        "   - If an income limit is 'Not specified in official source', state clearly that there is no general income ceiling specified by the official source, rather than inferring one (do NOT claim a ≤ ₹5,00,000/year limit for PM Kisan).\n"
        "   - If disability is 'Not specified in official source', do NOT present it as an eligibility requirement (do NOT claim 'Disability: Any disability status').\n"
        "   - For PM Kisan Samman Nidhi, ground eligibility strictly on landholder farmer families who own cultivable land in their names, subject to statutory exclusion categories (institutional landholders, constitutional post holders, government employees, pensioners with monthly pension ≥ ₹10,000, income-tax payers, and registered professionals).\n"
        "   - Clearly separate verified eligibility criteria from scheme benefits and general descriptions.\n"
        "   - Distinguish mandatory required documents from optional ones based on the verified data.\n"
        "   - When recommending schemes (e.g. for farmers or students), list relevant verified schemes with their benefits, verified eligibility summary, and official apply links.\n"
        "3. PROFESSIONAL CITIZEN-HELP BEHAVIOR:\n"
        "   - Explain concepts in simple, citizen-friendly language. Avoid overly dense bureaucratic jargon.\n"
        "   - Never claim that an application was submitted unless it was processed through the official system.\n"
        "   - Never pretend to be a government officer or official authority.\n"
        "   - Recommend visiting the official government portal (provided in the verified data) for official application submission and final confirmation.\n"
        f"4. LANGUAGE:\n"
        f"   - {lang_instruction}\n\n"
    )


    # 1. Specific scheme context (explicitly passed or detected from query)
    if request.scheme_context:
        safe_scheme_ctx = sanitize_context(request.scheme_context)
        system_prompt += f"PRIMARY SCHEME CONTEXT (User is actively viewing/inquiring about this scheme):\n{json.dumps(safe_scheme_ctx, ensure_ascii=False)}\n\n"
    elif detected_schemes:
        focused_schemes = [_format_scheme_summary(s) for s in detected_schemes]
        system_prompt += f"MATCHED SCHEME DETAILS (User inquired about these specific verified schemes):\n{json.dumps(focused_schemes, ensure_ascii=False)}\n\n"

    # 2. Document context (OCR or user document fields) - PII sanitized
    if request.document_context:
        safe_doc_ctx = sanitize_context(request.document_context)
        system_prompt += f"DOCUMENT CONTEXT (Extracted fields from user document):\n{json.dumps(safe_doc_ctx, ensure_ascii=False)}\n\n"

    # 3. User profile context (if available) - PII sanitized & Deterministically Evaluated
    if request.user_context:
        safe_user_ctx = sanitize_context(request.user_context)
        system_prompt += f"USER PROFILE CONTEXT:\n{json.dumps(safe_user_ctx, ensure_ascii=False)}\n\n"
        try:
            eval_res = evaluate_all_schemes(request.user_context)
            eligible_lines = [f"- {r.scheme_name}: {'; '.join(r.reasons[:2])}" for r in eval_res.results if r.status == "ELIGIBLE"]
            ineligible_lines = [f"- {r.scheme_name} (INELIGIBLE): {'; '.join(r.reasons[:2])}" for r in eval_res.results if r.status == "INELIGIBLE"]
            unknown_lines = [f"- {r.scheme_name} (UNKNOWN: Missing {', '.join(r.missing_fields)})" for r in eval_res.results if r.status == "UNKNOWN"]
            system_prompt += (
                "VERIFIED DETERMINISTIC ELIGIBILITY RESULTS (GROUND TRUTH):\n"
                f"Eligible Schemes ({len(eligible_lines)}):\n" + ("\n".join(eligible_lines) if eligible_lines else "None") + "\n\n"
                f"Ineligible Schemes ({len(ineligible_lines)}):\n" + ("\n".join(ineligible_lines) if ineligible_lines else "None") + "\n\n"
                f"Unknown Status ({len(unknown_lines)}):\n" + ("\n".join(unknown_lines[:5]) if unknown_lines else "None") + "\n\n"
                "STRICT GROUNDING DIRECTIVE: Never state or imply that the user qualifies for any scheme listed as INELIGIBLE. "
                "For schemes with UNKNOWN status (such as PM-Kisan without verified landholding), clearly explain the requirement "
                "and ask for the missing criteria before stating eligibility.\n\n"
            )
        except Exception as e:
            logger.warning("AI: could not pre-evaluate scheme eligibility for prompt grounding: %s", type(e).__name__)

    # 4. Compact Verified Schemes Catalog
    catalog_lines = "\n".join([_format_compact_scheme(s) for s in SCHEMES_DATA])
    system_prompt += f"COMPLETE VERIFIED SCHEMES CATALOG (25 Central & State Schemes):\n{catalog_lines}\n\n"

    api_messages = [{"role": "system", "content": system_prompt}]
    for msg in request.messages:
        api_messages.append({"role": msg.role, "content": mask_pii_text(msg.content)})

    headers = {
        "Authorization": f"Bearer {LLM_API_KEY}",
        "Content-Type": "application/json"
    }

    base_url = LLM_BASE_URL.rstrip("/")
    endpoint = f"{base_url}/chat/completions"

    # Candidate models to try in order of preference if primary experiences quota/availability issues
    models_to_try = [LLM_MODEL]
    for fallback in ["gemini-flash-lite-latest", "gemini-flash-latest"]:
        if fallback not in models_to_try:
            models_to_try.append(fallback)

    last_error = None
    for model_name in models_to_try:
        payload = {
            "model": model_name,
            "messages": api_messages,
            "temperature": 0.2
        }

        for attempt in range(2):
            async with httpx.AsyncClient(timeout=35.0) as client:
                try:
                    response = await client.post(endpoint, json=payload, headers=headers)
                    response.raise_for_status()
                    data = response.json()

                    # Robust response extraction
                    raw_content = ""
                    if "choices" in data and len(data["choices"]) > 0:
                        choice = data["choices"][0]
                        message = choice.get("message", {})
                        raw_content = message.get("content", "")
                    elif "candidates" in data and len(data["candidates"]) > 0:
                        candidate = data["candidates"][0]
                        parts = candidate.get("content", {}).get("parts", [])
                        text_parts = [p.get("text", "") for p in parts if p.get("text")]
                        if text_parts:
                            raw_content = "".join(text_parts)

                    if raw_content and raw_content.strip():
                        # Run through hallucination and ground truth validator
                        validated = validate_ai_response(raw_content.strip(), request.user_context)
                        return validated["sanitized_text"]

                    raise ValueError("Empty or unexpected response structure from AI provider.")
                except (httpx.RemoteProtocolError, httpx.ConnectError, httpx.TimeoutException) as e:
                    logger.warning("AI: transient connection error (%s attempt %d): %s", model_name, attempt + 1, type(e).__name__)
                    last_error = e
                    import asyncio
                    await asyncio.sleep(0.8)
                    continue
                except httpx.HTTPStatusError as e:
                    if e.response.status_code in (404, 429, 503):
                        logger.warning("AI: model %s returned HTTP %d, trying fallback model", model_name, e.response.status_code)
                        last_error = e
                        break  # Fall back to next model candidate
                    logger.error("AI: LLM API HTTP error (%s): %d", model_name, e.response.status_code)
                    last_error = e
                    break
                except Exception as e:
                    logger.error("AI: LLM API general error (%s): %s", model_name, type(e).__name__)
                    last_error = e
                    break

    raise Exception(f"Failed to get response from AI service: {last_error}")
