"""OCR router — Accept image uploads, return extracted document fields"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from models.schemas import OcrResponse
from services.ocr_service import extract_text_from_image

router = APIRouter()

ALLOWED_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


@router.post("/ocr/extract", response_model=OcrResponse, summary="Extract info from ID card image")
async def extract_ocr(file: UploadFile = File(...)):
    """
    Upload an Aadhaar or PAN card image.
    Returns extracted: name, dob, address, idNumber, gender, fatherName.
    
    Supported formats: JPG, PNG, WebP, PDF (first page)
    Maximum size: 5MB
    """
    # Validate file type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Allowed: {', '.join(ALLOWED_TYPES)}"
        )

    # Read file bytes
    file_bytes = await file.read()

    # Validate file size
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB"
        )

    # Run OCR
    extracted = extract_text_from_image(file_bytes, file.filename or "")

    # Check if anything useful was extracted
    has_data = any(v for v in extracted.values() if v)

    return OcrResponse(
        success=has_data,
        extracted=extracted,
        confidence=0.85 if has_data else 0.0
    )
