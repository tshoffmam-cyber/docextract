import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.config import settings
from app.database import engine
from app.api.routes import auth, jobs, upload
from app.api.routes import extract
from app.api.routes import settings as settings_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "DocExtract starting — PORT=%s DATABASE=%s",
        os.environ.get("PORT", "8000"),
        settings.database_url.split("@")[-1] if "@" in settings.database_url else "default",
    )
    try:
        async with engine.connect() as conn:
            await conn.execute(__import__("sqlalchemy").text("SELECT 1"))
            logger.info("Database: connection OK")
    except Exception as e:
        logger.error("Database: connection failed — %s", e)

    # Ensure uploads directory exists
    uploads_dir = Path("/opt/docextract/uploads/pdfs")
    uploads_dir.mkdir(parents=True, exist_ok=True)
    logger.info("Uploads dir ready: %s", uploads_dir)

    yield


app = FastAPI(
    title="DocExtract API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "https://docextract.com.br", "http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = "/api/v1"

app.include_router(auth.router, prefix=PREFIX + "/auth", tags=["auth"])
app.include_router(jobs.router, prefix=PREFIX, tags=["jobs"])
app.include_router(upload.router, prefix=PREFIX, tags=["upload"])
app.include_router(extract.router, prefix=PREFIX, tags=["extract"])
app.include_router(settings_router.router, prefix=PREFIX, tags=["settings"])


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/")
async def root():
    return {"message": "DocExtract API", "docs": "/docs"}
