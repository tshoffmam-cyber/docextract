import base64
import logging
from io import BytesIO

import fitz  # PyMuPDF
from PIL import Image, ImageEnhance, ImageFilter

from app.config import settings

logger = logging.getLogger(__name__)


def get_pdf_page_count(pdf_bytes: bytes) -> int:
    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        return len(doc)


def compress_and_prepare_pdf(pdf_bytes: bytes) -> list[str]:
    pages_b64: list[str] = []
    matrix = fitz.Matrix(200 / 72, 200 / 72)

    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        total = min(len(doc), settings.max_pdf_pages)
        for page_num in range(total):
            try:
                page = doc[page_num]
                pix = page.get_pixmap(matrix=matrix, alpha=False)

                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                gray = img.convert("L")

                # Deskew if needed
                try:
                    from deskew import determine_skew
                    import numpy as np

                    gray_arr = np.array(gray)
                    angle = determine_skew(gray_arr)
                    if angle is not None and abs(angle) > 0.5:
                        gray = gray.rotate(angle, expand=True, fillcolor=255)
                except Exception as e:
                    logger.debug("Deskew skipped for page %d: %s", page_num, e)

                gray = ImageEnhance.Contrast(gray).enhance(1.8)
                gray = ImageEnhance.Sharpness(gray).enhance(2.0)
                gray = gray.filter(ImageFilter.SHARPEN)

                rgb = gray.convert("RGB")
                buf = BytesIO()
                rgb.save(buf, format="JPEG", quality=85, optimize=True)
                pages_b64.append(base64.b64encode(buf.getvalue()).decode())

            except Exception as e:
                logger.error("Failed to process page %d: %s", page_num, e)
                continue

    return pages_b64
