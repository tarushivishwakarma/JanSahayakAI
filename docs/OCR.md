# Optical Character Recognition (OCR) Service

The OCR service (`ocr.py`) enables citizens to upload identity documents (Aadhaar or PAN cards) to auto-fill application forms quickly and accurately.

---

## 1. Security & Upload Pipeline

To prevent Denial of Service (DoS) and memory exhaustion attacks from malicious or oversized image uploads:

1. **Client Content-Type Validation:**
   - Evaluated upfront before reading file payload into memory.
   - Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`.
2. **Bounded Byte Stream Read:**
   - Instead of unbounded `await file.read()`, the service reads at most `MAX_FILE_SIZE + 1` (5 MB + 1 byte).
   - If the byte length exceeds 5,242,880 bytes, the upload is aborted immediately with `HTTP 413 Payload Too Large` without allocating memory for image decoding.
3. **Magic-Byte & Image Integrity Verification:**
   - Bytes are inspected for valid format signatures (e.g., `\xFF\xD8\xFF` for JPEG, `\x89PNG\r\n\x1a\n` for PNG, `RIFF....WEBP` for WebP).
   - PIL `Image.open` decodes the image and calls `image.verify()` to guarantee file integrity before OCR processing.

---

## 2. Text Extraction & Regular Expressions

Document text is extracted via `pytesseract` and processed using strict regex patterns:

- **Aadhaar Format:** `\b\d{4}\s?\d{4}\s?\d{4}\b` (12 digits)
- **PAN Format:** `\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b`
- **Date of Birth:** `\b(0[1-9]|[12][0-9]|3[01])[-/.](0[1-9]|1[012])[-/.](19|20)\d\d\b`
- **Gender Detection:** Keyword extraction for `Male`, `Female`, `Transgender`, `पुरुष`, `महिला`.

---

## 3. Honest Extraction & No False Claims

Prior versions returned fake mock data when OCR failed to read poor-quality photos.
In JanSahayakAI:
- **No Mock Fallback:** If OCR fails to parse meaningful fields, `success` is explicitly set to `false`.
- **Honest Feedback:** The response instructs the citizen: *"Could not extract fields from this document. Please enter your details manually."*
- Raw internal processing errors and stack traces are suppressed from the client.
