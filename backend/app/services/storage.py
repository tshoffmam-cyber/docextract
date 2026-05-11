import logging
import uuid
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)

UPLOAD_DIR = Path("/opt/docextract/uploads")


def _use_r2() -> bool:
    return bool(
        settings.cloudflare_account_id
        and settings.cloudflare_r2_access_key
        and settings.cloudflare_r2_secret_key
        and settings.cloudflare_r2_bucket
    )


def _ensure_local_dir():
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


_r2_client = None


def _get_r2_client():
    global _r2_client
    if _r2_client is None:
        import boto3
        _r2_client = boto3.client(
            "s3",
            endpoint_url=f"https://{settings.cloudflare_account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.cloudflare_r2_access_key,
            aws_secret_access_key=settings.cloudflare_r2_secret_key,
            region_name="auto",
        )
    return _r2_client


def upload_file(key: str, data: bytes, content_type: str) -> str:
    if _use_r2():
        try:
            _get_r2_client().put_object(
                Bucket=settings.cloudflare_r2_bucket,
                Key=key,
                Body=data,
                ContentType=content_type,
            )
            pub = settings.r2_public_url.rstrip("/")
            logger.info("Uploaded to R2: %s", key)
            return f"{pub}/{key}"
        except Exception as exc:
            logger.warning("R2 upload failed (%s) - falling back to local", exc)
    _ensure_local_dir()
    dest = UPLOAD_DIR / key
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    logger.info("Saved locally: %s", dest)
    return f"/uploads/{key}"


def download_file(key: str) -> bytes:
    if _use_r2():
        try:
            resp = _get_r2_client().get_object(
                Bucket=settings.cloudflare_r2_bucket, Key=key
            )
            return resp["Body"].read()
        except Exception as exc:
            logger.warning("R2 download failed (%s) - trying local", exc)
    local = UPLOAD_DIR / key
    if local.exists():
        return local.read_bytes()
    raise FileNotFoundError(f"File not found: {key}")


def delete_file(key: str) -> None:
    if _use_r2():
        try:
            _get_r2_client().delete_object(
                Bucket=settings.cloudflare_r2_bucket, Key=key
            )
        except Exception as exc:
            logger.warning("R2 delete failed: %s", exc)
    local = UPLOAD_DIR / key
    if local.exists():
        local.unlink()


def generate_key(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    return f"pdfs/{uuid.uuid4().hex}{ext}"


def storage_mode() -> str:
    return "r2" if _use_r2() else "local"
