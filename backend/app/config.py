from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    gemini_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None

    database_url: str = "postgresql+asyncpg://user:pass@localhost:5432/docextract"
    redis_url: str = "redis://localhost:6379/0"

    cloudflare_account_id: Optional[str] = None
    cloudflare_r2_bucket: Optional[str] = None
    cloudflare_r2_access_key: Optional[str] = None
    cloudflare_r2_secret_key: Optional[str] = None
    r2_public_url: str = ""

    google_client_id: str = ""
    google_client_secret: str = ""

    jwt_secret: str = "changeme"
    jwt_expire_hours: int = 24

    frontend_url: str = "http://localhost:5173"
    max_pdf_pages: int = 50
    batch_size: int = 15


settings = Settings()
