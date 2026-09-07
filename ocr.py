"""OCR router — Accept image uploads, return extracted document fields"""

import io
import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from schemas import OcrResponse
from ocr_service import extract_text_from_image

router = APIRouter()
logger = logging.getLogger("jansahayak.ocr")

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


def validate_image_bytes(file_bytes: bytes) -> str:
    """
    Validates file magic bytes and verifies image structure.
    Rejects mismatched or malformed file uploads.
    """
    if len(file_bytes) < 12:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too small to be a valid image."
        )

    # Magic byte inspection
    if file_bytes.startswith(b"\xff\xd8\xff"):
        detected_format = "image/jpeg"
    elif file_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        detected_format = "image/png"
    elif file_bytes.startswith(b"RIFF") and len(file_bytes) >= 12 and file_bytes[8:12] == b"WEBP":
        detected_format = "image/webp"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image signature. Only genuine JPEG, PNG, and WebP images are supported."
        )

    # Image decoding integrity check using Pillow
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(file_bytes))
        img.verify()
    except Exception as e:
        logger.warning("Image verification failed for uploaded file: %s", type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Corrupted or malformed image file."
        )

    return detected_format


@router.post("/ocr/extract", response_model=OcrResponse, summary="Extract info from ID card image")
async def extract_ocr(file: UploadFile = File(...)):
    """
    Upload an Aadhaar or PAN card image.
    Returns extracted: name, dob, address, idNumber, gender, fatherName.

    Supported formats: JPG, PNG, WebP (Images only)
    Maximum size: 5MB
    """
    # 1. Validate declared client MIME type
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported content type: {file.content_type}. Allowed formats: {', '.join(sorted(ALLOWED_CONTENT_TYPES))}"
        )

    # 2. Read file bytes
    file_bytes = await file.read()

    # 3. Validate file size
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB"
        )

    # 4. Server-side magic byte and integrity validation
    validate_image_bytes(file_bytes)

    # 5. Run OCR extraction
    extracted = extract_text_from_image(file_bytes, file.filename or "")
    confidence = None
    raw_text = None
    if isinstance(extracted, dict):
        confidence = extracted.pop("_confidence", None)
        raw_text = extracted.pop("_raw_text", None)

    # 6. Honest verification: check if any meaningful field was extracted
    has_data = any(v for v in extracted.values() if v)

    message = (
        "Document fields extracted successfully."
        if has_data
        else "Could not extract fields from this document. Please enter your details manually."
    )

    return OcrResponse(
        success=has_data,
        extracted=extracted if has_data else None,
        confidence=confidence if has_data else None,
        raw_text=raw_text if has_data else None,
        message=message
    )
