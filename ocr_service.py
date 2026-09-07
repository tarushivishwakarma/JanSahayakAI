"""
OCR Service — Extract text from Aadhaar / PAN card images using Tesseract.
No synthetic demo identity data is returned upon failure.
"""

import os
import re
import io
import logging
from typing import Dict, Optional, Any

logger = logging.getLogger("jansahayak.ocr")

# Try importing OCR libraries (graceful degradation)
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    logger.warning("Pillow not installed. Install: pip install Pillow")

try:
    import pytesseract
    # Set Tesseract path if configured
    tesseract_path = os.getenv("TESSERACT_PATH", "")
    if tesseract_path:
        pytesseract.pytesseract.tesseract_cmd = tesseract_path
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False
    logger.warning("pytesseract not installed. Install: pip install pytesseract")


def _empty_extraction() -> Dict[str, Optional[str]]:
    """Returns an empty extraction dictionary without fabricating values."""
    return {
        "name": None,
        "dob": None,
        "address": None,
        "idNumber": None,
        "gender": None,
        "fatherName": None
    }


def extract_text_from_image(file_bytes: bytes, filename: str = "") -> Dict[str, Optional[str]]:
    """
    Extract structured information from an ID card image.
    Returns dict with keys: name, dob, address, idNumber, gender, fatherName.
    Returns empty values if processing fails or OCR is unavailable.
    """
    if not PIL_AVAILABLE:
        logger.warning("OCR skipped: Pillow is not available.")
        return _empty_extraction()

    try:
        image = Image.open(io.BytesIO(file_bytes))
        # Convert to RGB if needed (handles PNG with alpha, grayscale, etc.)
        if image.mode not in ('RGB', 'L'):
            image = image.convert('RGB')

        # Enhance image for better OCR
        image = _preprocess_image(image)

        if TESSERACT_AVAILABLE:
            return _tesseract_extract(image)
        else:
            logger.warning("OCR skipped: Tesseract is not available in the current environment.")
            return _empty_extraction()

    except Exception as e:
        logger.error("OCR image processing error: %s", type(e).__name__)
        return _empty_extraction()


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
    if w < 800 and w > 0:
        scale = 800 / w
        image = image.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    return image


def _tesseract_extract(image) -> Dict[str, Any]:
    """Use Tesseract to extract text, compute authentic confidence, and parse fields"""
    try:
        custom_config = r'--oem 3 --psm 6'
        try:
            data = pytesseract.image_to_data(image, lang='hin+eng', config=custom_config, output_type=pytesseract.Output.DICT)
        except Exception:
            data = pytesseract.image_to_data(image, config=custom_config, output_type=pytesseract.Output.DICT)

        valid_confs = []
        words = []
        for i in range(len(data.get('text', []))):
            w = str(data['text'][i]).strip()
            c = data['conf'][i]
            try:
                conf_val = float(c)
                if w and conf_val > 0:
                    valid_confs.append(conf_val)
                    words.append(w)
            except (ValueError, TypeError):
                continue

        raw_text = " ".join(words)
        avg_conf = round(sum(valid_confs) / len(valid_confs) / 100.0, 2) if valid_confs else None

        extracted = _parse_id_card_text(raw_text)
        extracted["_confidence"] = avg_conf
        extracted["_raw_text"] = raw_text
        return extracted

    except Exception as e:
        logger.error("Tesseract execution error: %s", type(e).__name__)
        return _empty_extraction()


def _parse_id_card_text(text: str) -> Dict[str, Optional[str]]:
    """Parse extracted OCR text to find structured fields"""
    extracted = _empty_extraction()
    if not text:
        return extracted

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
