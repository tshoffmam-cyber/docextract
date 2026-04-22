import io
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app


def _make_token(user_id: str) -> str:
    from app.config import settings
    from jose import jwt
    from datetime import datetime, timedelta, timezone
    exp = datetime.now(timezone.utc) + timedelta(hours=1)
    return jwt.encode({"sub": user_id, "exp": exp}, settings.jwt_secret, algorithm="HS256")


FAKE_USER_ID = str(uuid.uuid4())


@pytest.fixture
def auth_headers():
    return {"Authorization": f"Bearer {_make_token(FAKE_USER_ID)}"}


@pytest.fixture
def fake_user():
    from app.models.user import User
    u = MagicMock(spec=User)
    u.id = uuid.UUID(FAKE_USER_ID)
    u.email = "test@docextract.com"
    u.name = "Test User"
    u.plan = "starter"
    return u


@patch("app.api.routes.upload.process_document")
@patch("app.api.routes.upload.upload_file")
@patch("app.api.deps.get_current_user")
@patch("app.api.deps.get_db")
def test_upload_creates_job(mock_db, mock_auth, mock_storage, mock_task, fake_user, auth_headers):
    session = AsyncMock(spec=AsyncSession)
    session.flush = AsyncMock()
    mock_db.return_value.__aenter__ = AsyncMock(return_value=session)
    mock_db.return_value.__aexit__ = AsyncMock(return_value=False)

    async def _get_db():
        yield session

    async def _get_user(*args, **kwargs):
        return fake_user

    mock_db.side_effect = None
    mock_auth.return_value = fake_user
    mock_storage.return_value = "https://r2.example.com/pdfs/test.pdf"
    mock_task.delay = MagicMock()

    app.dependency_overrides = {}

    from app.api.deps import get_current_user, get_db
    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_current_user] = lambda: fake_user

    client = TestClient(app)
    pdf_content = b"%PDF-1.4 fake pdf content"
    response = client.post(
        "/api/v1/upload",
        files={"file": ("holerite.pdf", io.BytesIO(pdf_content), "application/pdf")},
        data={"fields": '{"Holerite": ""}', "contrato": '{"name": "CESAN"}'},
        headers=auth_headers,
    )

    app.dependency_overrides = {}

    assert response.status_code == 202
    data = response.json()
    assert "job_id" in data
    assert data["message"] == "Processando..."
    mock_storage.assert_called_once()
    mock_task.delay.assert_called_once()


@patch("app.api.deps.get_current_user")
@patch("app.api.deps.get_db")
def test_upload_rejects_non_pdf(mock_db, mock_auth, fake_user, auth_headers):
    session = AsyncMock(spec=AsyncSession)

    async def _get_db():
        yield session

    from app.api.deps import get_current_user, get_db
    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_current_user] = lambda: fake_user

    client = TestClient(app)
    response = client.post(
        "/api/v1/upload",
        files={"file": ("doc.txt", io.BytesIO(b"not a pdf"), "text/plain")},
        data={"fields": "{}", "contrato": "{}"},
        headers=auth_headers,
    )

    app.dependency_overrides = {}
    assert response.status_code == 422


@patch("app.api.deps.get_current_user")
@patch("app.api.deps.get_db")
def test_upload_requires_auth(mock_db, mock_auth):
    client = TestClient(app)
    response = client.post(
        "/api/v1/upload",
        files={"file": ("test.pdf", io.BytesIO(b"%PDF"), "application/pdf")},
    )
    assert response.status_code == 403
