import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine
from app.api.routes import auth, jobs, upload
from app.api.routes import extract

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _check_ai_keys() -> None:
    has_gemini = bool(settings.gemini_api_key)
    has_anthropic = bool(settings.anthropic_api_key)
    if not has_gemini and not has_anthropic:
        logger.error(
            "ATENCAO: Nenhuma chave de IA configurada! "
            "Defina GEMINI_API_KEY e/ou ANTHROPIC_API_KEY nas variaveis de ambiente. "
            "O sistema nao conseguira processar PDFs sem pelo menos uma delas."
        )
    elif not has_gemini:
        logger.warning(
            "GEMINI_API_KEY nao configurada. "
            "Usando apenas Anthropic Claude como provedor de IA."
        )
    elif not has_anthropic:
        logger.info(
            "ANTHROPIC_API_KEY nao configurada. "
            "Usando apenas Google Gemini como provedor de IA."
        )
    else:
        logger.info("Ambas as chaves de IA configuradas: Gemini + Anthropic.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _check_ai_keys()
    from app.database import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Banco de dados inicializado.")
    yield
    await engine.dispose()
    logger.info("Aplicacao encerrada.")


app = FastAPI(
    title="DocExtract API",
    description="API para extracao de dados de documentos PDF",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(jobs.router, prefix="/api/v1/jobs", tags=["jobs"])
app.include_router(upload.router, prefix="/api/v1/upload", tags=["upload"])
app.include_router(extract.router, prefix="/api/v1/extract", tags=["extract"])


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/api/v1/config-check")
async def config_check():
    has_gemini = bool(settings.gemini_api_key)
    has_anthropic = bool(settings.anthropic_api_key)
    if has_gemini and has_anthropic:
        ai_status = "ok_dual"
    elif has_gemini:
        ai_status = "ok_gemini_only"
    elif has_anthropic:
        ai_status = "ok_anthropic_only"
    else:
        ai_status = "no_ai_keys"
    return {
        "gemini_key": has_gemini,
        "anthropic_key": has_anthropic,
        "frontend_url": settings.frontend_url,
        "gemini_prefix": settings.gemini_api_key[:8] if settings.gemini_api_key else None,
        "anthropic_prefix": settings.anthropic_api_key[:10] if settings.anthropic_api_key else None,
        "ai_status": ai_status,
    }
