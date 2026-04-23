from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    gemini_api_key: str = ""
    anthropic_api_key: str = ""
    redis_url: str = "redis://localhost:6379/0"
    database_url: str = "postgresql+asyncpg://user:pass@localhost:5432/docextract"

    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = "docextract-pdfs"
    r2_public_url: str = ""

    google_client_id: str = ""
    google_client_secret: str = ""

    jwt_secret: str = "changeme"
    jwt_expire_hours: int = 24

    frontend_url: str = "http://localhost:5173"
    max_pdf_pages: int = 50
    batch_size: int = 15


settings = Settings()
