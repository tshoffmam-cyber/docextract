import logging
import re
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.models.user import User
from app.services import storage as storage_svc

logger = logging.getLogger(__name__)
router = APIRouter()

ENV_FILE = Path("/opt/docextract/backend/.env")

# Keys the UI is allowed to read/write
ALLOWED_KEYS = {
    "GEMINI_API_KEY",
    "ANTHROPIC_API_KEY",
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "R2_PUBLIC_URL",
}


def _read_env() -> dict:
    result = {}
    if not ENV_FILE.exists():
        return result
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        result[k.strip()] = v.strip()
    return result


def _write_env(data: dict) -> None:
    lines = []
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                lines.append(line)
                continue
            k = stripped.split("=", 1)[0].strip()
            if k not in data:
                lines.append(line)
    for k, v in data.items():
        lines.append(f"{k}={v}")
    ENV_FILE.write_text("\n".join(lines) + "\n")


class SettingsRead(BaseModel):
    gemini_api_key: str = ""
    anthropic_api_key: str = ""
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = ""
    r2_public_url: str = ""
    storage_mode: str = "local"


class SettingsWrite(BaseModel):
    gemini_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    r2_account_id: Optional[str] = None
    r2_access_key_id: Optional[str] = None
    r2_secret_access_key: Optional[str] = None
    r2_bucket_name: Optional[str] = None
    r2_public_url: Optional[str] = None


def _mask(val: str) -> str:
    if not val or len(val) <= 8:
        return "****" if val else ""
    return val[:4] + "****" + val[-4:]


@router.get("/settings", response_model=SettingsRead)
async def get_settings(current_user: User = Depends(get_current_user)):
    env = _read_env()
    return SettingsRead(
        gemini_api_key=_mask(env.get("GEMINI_API_KEY", "")),
        anthropic_api_key=_mask(env.get("ANTHROPIC_API_KEY", "")),
        r2_account_id=_mask(env.get("R2_ACCOUNT_ID", "")),
        r2_access_key_id=_mask(env.get("R2_ACCESS_KEY_ID", "")),
        r2_secret_access_key=_mask(env.get("R2_SECRET_ACCESS_KEY", "")),
        r2_bucket_name=env.get("R2_BUCKET_NAME", ""),
        r2_public_url=env.get("R2_PUBLIC_URL", ""),
        storage_mode=storage_svc.storage_mode(),
    )


@router.put("/settings")
async def update_settings(
    body: SettingsWrite,
    current_user: User = Depends(get_current_user),
):
    updates = {}
    mapping = {
        "gemini_api_key": "GEMINI_API_KEY",
        "anthropic_api_key": "ANTHROPIC_API_KEY",
        "r2_account_id": "R2_ACCOUNT_ID",
        "r2_access_key_id": "R2_ACCESS_KEY_ID",
        "r2_secret_access_key": "R2_SECRET_ACCESS_KEY",
        "r2_bucket_name": "R2_BUCKET_NAME",
        "r2_public_url": "R2_PUBLIC_URL",
    }
    for field, env_key in mapping.items():
        val = getattr(body, field)
        if val is not None and val.strip() and "****" not in val:
            updates[env_key] = val.strip()

    if not updates:
        raise HTTPException(status_code=400, detail="Nenhum valor valido enviado")

    _write_env(updates)

    # Reload settings in memory
    from app.config import settings as cfg
    for env_key, val in updates.items():
        attr = env_key.lower()
        if hasattr(cfg, attr):
            object.__setattr__(cfg, attr, val)

    logger.info("Settings updated: %s", list(updates.keys()))
    return {"status": "ok", "updated": list(updates.keys())}
