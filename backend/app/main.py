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
            """Log clear warnings if AI API keys are missing at startup."""
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
                                    "GEMINI_API_KEY nao configurada - usando apenas Anthropic Claude como IA. "
                                    "Para usar Gemini como primario, defina GEMINI_API_KEY."
                )
elif not has_anthropic:
                logger.warning(
                                    "ANTHROPIC_API_KEY nao configurada - sem fallback para Claude. "
                                    "Se a cota do Gemini esgotar, o sistema ficara indisponivel."
                )
else:
                logger.info(
                                    "Chaves de IA: Gemini OK (prefixo: %s) | Anthropic OK (prefixo: %s)",
                                    settings.gemini_api_key[:6],
                                    settings.anthropic_api_key[:8],
                )


@asynccontextmanager
async def lifespan(app: FastAPI):
            logger.info(
                            "DocExtract iniciando - PORT=%s DATABASE=%s",
                            os.environ.get("PORT", "8000"),
                            settings.database_url.split("@")[-1] if "@" in settings.database_url else "default",
            )
            _check_ai_keys()
            try:
                            async with engine.connect() as conn:
                                                await conn.execute(__import__("sqlalchemy").text("SELECT 1"))
                                                logger.info("Banco de dados: conexao OK")
            except Exception as e:
                            logger.error("Banco de dados: falha na conexao - %s", e)
                        yield
    await engine.dispose()


app = FastAPI(
            title="DocExtract API",
            version="1.0.0",
            docs_url="/docs",
            redoc_url="/redoc",
            lifespan=lifespan,
)

app.add_middleware(
            CORSMiddleware,
            allow_origins=[
                            settings.frontend_url,
                            "https://docextract-nine.vercel.app",
                            "http://localhost:5173",
                            "http://localhost:3000",
            ],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(upload.router, prefix="/api/v1")
app.include_router(jobs.router, prefix="/api/v1")
app.include_router(extract.router, prefix="/api/v1")


@app.get("/health", tags=["health"])
async def health():
            return {"status": "ok"}


@app.get("/api/v1/config-check", tags=["health"])
async def config_check():
            """Endpoint de diagnostico - mostra quais chaves estao configuradas."""
    return {
                    "gemini_key": bool(settings.gemini_api_key),
                    "anthropic_key": bool(settings.anthropic_api_key),
                    "frontend_url": settings.frontend_url,
                    "gemini_prefix": settings.gemini_api_key[:8] if settings.gemini_api_key else None,
                    "anthropic_prefix": settings.anthropic_api_key[:10] if settings.anthropic_api_key else None,
                    "ai_status": (
                                        "ok_dual"
                                        if settings.gemini_api_key and settings.anthropic_api_key
                                        else "ok_gemini_only"
                                        if settings.gemini_api_key
                                        else "ok_anthropic_only"
                                        if settings.anthropic_api_key
                                        else "no_ai_keys"
                    ),
    }
