import logging

import fitz  # PyMuPDF

logger = logging.getLogger(__name__)

# Minimum characters per page to consider it has native text
_MIN_TEXT_CHARS = 50


def get_pdf_page_count(pdf_bytes: bytes) -> int:
    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        return len(doc)


def extract_text_from_pdf(pdf_bytes: bytes, max_pages: int = 100) -> list[dict]:
    """
    Extract text from each PDF page.
    - Native text (digital PDF): extracted directly (free, fast, ~10x fewer tokens).
    - Scanned/image-only page: OCR with Tesseract locally (free, no API cost).

    Returns list of dicts: [{page, text, method}]
    """
    pages = []

    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        total = min(len(doc), max_pages)
        for page_num in range(total):
            page = doc[page_num]

            # 1. Try native text extraction (instant, zero cost)
            text = page.get_text("text").strip()

            if len(text) >= _MIN_TEXT_CHARS:
                pages.append({"page": page_num + 1, "text": text, "method": "native"})
                logger.debug("Page %d: native text (%d chars)", page_num + 1, len(text))
            else:
                # 2. Fallback: local Tesseract OCR (free, runs on VPS)
                ocr_text = _ocr_page(page)
                if ocr_text:
                    pages.append({"page": page_num + 1, "text": ocr_text, "method": "ocr"})
                    logger.debug("Page %d: OCR (%d chars)", page_num + 1, len(ocr_text))
                else:
                    pages.append({"page": page_num + 1, "text": "", "method": "empty"})
                    logger.warning("Page %d: no text found", page_num + 1)

    return pages


def _ocr_page(page) -> str:
    """Run Tesseract OCR on a single page. Returns extracted text or empty string."""
    try:
        import pytesseract
        from PIL import Image
        from io import BytesIO

        matrix = fitz.Matrix(200 / 72, 200 / 72)
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples).convert("L")
        text = pytesseract.image_to_string(img, lang="por+eng", config="--psm 6")
        return text.strip()

    except ImportError:
        logger.warning("pytesseract not installed. Run: pip install pytesseract")
        return ""
    except Exception as e:
        logger.error("OCR error: %s", e)
        return ""


def pages_to_text_block(pages: list[dict]) -> str:
    """Join all page texts into one clean block for the AI prompt."""
    parts = []
    for p in pages:
        if p["text"]:
            parts.append(f"=== PAGINA {p['page']} ===\n{p['text']}")
    return "\n\n".join(parts)


# Backward-compat alias used in tasks.py (returns text pages, not images)
def compress_and_prepare_pdf(pdf_bytes: bytes) -> list[dict]:
    from app.config import settings
    return extract_text_from_pdf(pdf_bytes, max_pages=settings.max_pdf_pages)
