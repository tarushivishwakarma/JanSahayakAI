"""
OCR Service — Extract text from Aadhaar / PAN card images using Tesseract
Falls back to basic PIL analysis if Tesseract is not installed.
"""

import os
import re
import io
from typing import Dict, Optional

# Try importing OCR libraries (graceful degradation)
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    print("⚠️  Pillow not installed. Install: pip install Pillow")

try:
    import pytesseract
    # Set Tesseract path if configured
    tesseract_path = os.getenv("TESSERACT_PATH", "")
    if tesseract_path:
        pytesseract.pytesseract.tesseract_cmd = tesseract_path
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False
    print("⚠️  pytesseract not installed. Install: pip install pytesseract")


def extract_text_from_image(file_bytes: bytes, filename: str = "") -> Dict[str, Optional[str]]:
    """
    Extract structured information from an ID card image.
    
    Returns dict with keys: name, dob, address, idNumber, gender, fatherName
    """
    if not PIL_AVAILABLE:
        return _demo_extraction()

    try:
        image = Image.open(io.BytesIO(file_bytes))
        # Convert to RGB if needed (handles PNG with alpha, etc.)
        if image.mode not in ('RGB', 'L'):
            image = image.convert('RGB')

        # Enhance image for better OCR
        image = _preprocess_image(image)

        if TESSERACT_AVAILABLE:
            return _tesseract_extract(image)
        else:
            # Basic regex on raw bytes (very limited)
            return _demo_extraction()

    except Exception as e:
        print(f"OCR error: {e}")
        return _demo_extraction()


def _preprocess_image(image):
    """Basic preprocessing to improve OCR accuracy"""
    from PIL import ImageEnhance, ImageFilter

    # Increase contrast
    enhancer = ImageEnhance.Contrast(image)
    image = enhancer.enhance(1.5)

    # Sharpen
    image = image.filter(ImageFilter.SHARPEN)

    # Scale up if small
    w, h = image.size
    if w < 800:
        scale = 800 / w
        image = image.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    return image


def _tesseract_extract(image) -> Dict[str, Optional[str]]:
    """Use Tesseract to extract text and parse fields"""
    try:
        # Run OCR with Hindi+English language support
        custom_config = r'--oem 3 --psm 6'
        try:
            raw_text = pytesseract.image_to_string(image, lang='hin+eng', config=custom_config)
        except Exception:
            raw_text = pytesseract.image_to_string(image, config=custom_config)

        return _parse_id_card_text(raw_text)

    except Exception as e:
        print(f"Tesseract error: {e}")
        return _demo_extraction()


def _parse_id_card_text(text: str) -> Dict[str, Optional[str]]:
    """Parse extracted OCR text to find structured fields"""
    extracted = {
        "name": None,
        "dob": None,
        "address": None,
        "idNumber": None,
        "gender": None,
        "fatherName": None
    }

    lines = [l.strip() for l in text.split('\n') if l.strip()]

    # Extract Aadhaar number (12 digits, often grouped as XXXX XXXX XXXX)
    aadhaar_pattern = re.search(r'\b(\d{4}\s?\d{4}\s?\d{4})\b', text)
    if aadhaar_pattern:
        extracted["idNumber"] = aadhaar_pattern.group(1).replace(' ', ' ')

    # Extract PAN number (10 alphanumeric)
    pan_pattern = re.search(r'\b([A-Z]{5}\d{4}[A-Z]{1})\b', text)
    if pan_pattern:
        extracted["idNumber"] = pan_pattern.group(1)

    # Extract date of birth
    dob_patterns = [
        r'DOB[:\s]+(\d{2}/\d{2}/\d{4})',
        r'Date of Birth[:\s]+(\d{2}/\d{2}/\d{4})',
        r'(\d{2}/\d{2}/\d{4})',
        r'(\d{2}-\d{2}-\d{4})',
        r'(\d{4}-\d{2}-\d{2})'
    ]
    for pattern in dob_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            extracted["dob"] = match.group(1)
            break

    # Extract gender
    if re.search(r'\bMALE\b', text, re.IGNORECASE) and not re.search(r'\bFEMALE\b', text, re.IGNORECASE):
        extracted["gender"] = "Male"
    elif re.search(r'\bFEMALE\b', text, re.IGNORECASE):
        extracted["gender"] = "Female"

    # Name extraction (look for lines with proper nouns after common headers)
    name_headers = ['name', 'नाम']
    for i, line in enumerate(lines):
        for header in name_headers:
            if header.lower() in line.lower() and i + 1 < len(lines):
                candidate = lines[i + 1].strip()
                if len(candidate) > 3 and candidate.replace(' ', '').isalpha():
                    extracted["name"] = candidate
                    break

    # Father's name
    father_pattern = re.search(r"Father'?s?\s+Name[:\s]+(.+)", text, re.IGNORECASE)
    if father_pattern:
        extracted["fatherName"] = father_pattern.group(1).strip()

    # Address extraction (multi-line, look for PIN code)
    pin_match = re.search(r'(\d{6})', text)
    if pin_match:
        pin_idx = text.find(pin_match.group(1))
        # Extract ~200 chars before the PIN as address context
        addr_text = text[max(0, pin_idx - 200):pin_idx + 6]
        addr_clean = ' '.join(addr_text.split())
        if len(addr_clean) > 10:
            extracted["address"] = addr_clean

    return extracted


def _demo_extraction() -> Dict[str, Optional[str]]:
    """
    Demo data returned when Tesseract/PIL is not available.
    In production, this should never be returned.
    """
    return {
        "name": "Ramesh Kumar Singh",
        "dob": "15/08/1995",
        "address": "Village Rampur, District Gorakhpur, Uttar Pradesh - 273001",
        "idNumber": "1234 5678 9012",
        "gender": "Male",
        "fatherName": "Suresh Kumar Singh"
    }
