import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine
from app.api.routes import auth, jobs, upload

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("DocExtract iniciando — PORT=%s DATABASE=%s",
                os.environ.get("PORT", "8000"),
                settings.database_url.split("@")[-1] if "@" in settings.database_url else "default")
    try:
        async with engine.connect() as conn:
            await conn.execute(__import__("sqlalchemy").text("SELECT 1"))
            logger.info("Banco de dados: conexão OK")
    except Exception as e:
        logger.error("Banco de dados: falha na conexão — %s", e)
    yield
    await engine.dispose()


app = FastAPI(
    title="DocExtract API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS: allow Vercel frontend and all origins for MVP
_allowed_origins = [
    settings.frontend_url,
    "https://dodextract-nine.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(upload.router, prefix="/api/v1")
app.include_router(jobs.router, prefix="/api/v1")


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}
