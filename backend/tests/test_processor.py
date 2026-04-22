import base64
import io

import fitz
import pytest

from app.config import settings
from app.workers.pdf_processor import compress_and_prepare_pdf, get_pdf_page_count


def _make_pdf(pages: int = 1) -> bytes:
    doc = fitz.open()
    for i in range(pages):
        page = doc.new_page()
        page.insert_text((72, 72), f"Página {i + 1} — teste DocExtract")
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def test_page_count_single():
    assert get_pdf_page_count(_make_pdf(1)) == 1


def test_page_count_multiple():
    assert get_pdf_page_count(_make_pdf(5)) == 5


def test_compress_returns_list():
    result = compress_and_prepare_pdf(_make_pdf(1))
    assert isinstance(result, list)
    assert len(result) == 1


def test_compress_valid_base64():
    result = compress_and_prepare_pdf(_make_pdf(2))
    for b64 in result:
        decoded = base64.b64decode(b64)
        assert decoded[:2] == b"\xff\xd8"  # JPEG magic bytes


def test_compress_respects_max_pages(monkeypatch):
    monkeypatch.setattr(settings, "max_pdf_pages", 2)
    result = compress_and_prepare_pdf(_make_pdf(10))
    assert len(result) == 2


def test_compress_single_page_no_crash():
    result = compress_and_prepare_pdf(_make_pdf(1))
    assert len(result) == 1
