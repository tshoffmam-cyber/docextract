import asyncio
import json
import logging
import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, status
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import CurrentUser, DB
from app.config import settings
from app.database import AsyncSessionLocal
from app.models.job import Job
from app.models.result import Result

router = APIRouter(tags=["extract"])
logger = logging.getLogger(__name__)


class ExtractTextRequest(BaseModel):
    text: str
    prompt: str = ""
    empresa: str = ""
    medicao: str = ""
    periodo: str = ""


@router.post("/extract-text", status_code=status.HTTP_202_ACCEPTED)
async def extract_text(
    body: ExtractTextRequest,
    current_user: CurrentUser,
    db: DB,
    background_tasks: BackgroundTasks,
):
    job_id = uuid.uuid4()
    job = Job(
        id=job_id,
        user_id=current_user.id,
        pdf_key=f"text/{job_id}",
        original_filename="documento.pdf",
        fields={},
        contrato={"empresa": body.empresa, "medicao": body.medicao, "periodo": body.periodo},
    )
    db.add(job)
    await db.commit()

    background_tasks.add_task(
        _process_text_job,
        str(job_id),
        body.text,
        body.prompt,
        body.empresa,
        body.medicao,
        body.periodo,
    )

    return {"job_id": str(job_id)}


def _build_prompt(text: str, instruction: str, empresa: str, medicao: str, periodo: str) -> str:
    ctx = []
    if empresa:
        ctx.append(f"Empresa/Contratada: {empresa}")
    if medicao:
        ctx.append(f"Medição: {medicao}")
    if periodo:
        ctx.append(f"Período: {periodo}")

    ctx_str = "\n".join(ctx)
    user_instr = instruction.strip() or "Extraia todos os dados relevantes do documento."

    return f"""Você é um especialista em análise de documentos trabalhistas brasileiros.

{ctx_str}

Instrução: {user_instr}

Analise o texto abaixo e retorne SOMENTE JSON válido neste formato:
{{
  "tipo_documento": "holerite|fgts|vt|ponto|aso|outro",
  "competencia": "MM/AAAA",
  "empresa": "nome da empresa",
  "total_funcionarios": 0,
  "funcionarios": [
    {{
      "nome": "NOME COMPLETO",
      "campos": {{
        "campo_nome": {{"valor": "...", "status": "Apresentado|Não apresentado|Inconsistente|Não consta"}}
      }}
    }}
  ],
  "inconsistencias": [
    {{"funcionario": "nome", "campo": "campo", "descricao": "descrição do problema"}}
  ],
  "resumo": "resumo da análise"
}}

TEXTO DO DOCUMENTO:
{text[:60000]}"""


def _call_ai_sync(prompt: str) -> dict:
    last_exc: Exception | None = None

    if settings.gemini_api_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.gemini_api_key)
            model = genai.GenerativeModel("gemini-2.0-flash")
            response = model.generate_content(prompt)
            raw = response.text
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            result = json.loads(match.group() if match else raw)
            logger.info("Gemini text extraction OK")
            return result
        except Exception as e:
            last_exc = e
            logger.warning("Gemini falhou: %s", e)

    if settings.anthropic_api_key:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = response.content[0].text
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            result = json.loads(match.group() if match else raw)
            logger.info("Anthropic text extraction OK")
            return result
        except Exception as e:
            last_exc = e
            logger.warning("Anthropic falhou: %s", e)

    raise RuntimeError(f"Nenhuma IA disponível. Último erro: {last_exc}")


async def _process_text_job(
    job_id: str,
    text: str,
    prompt: str,
    empresa: str,
    medicao: str,
    periodo: str,
) -> None:
    async with AsyncSessionLocal() as session:
        job = (
            await session.execute(select(Job).where(Job.id == uuid.UUID(job_id)))
        ).scalar_one_or_none()
        if not job:
            logger.error("Job %s não encontrado", job_id)
            return

        try:
            job.status = "processing"
            job.progress = 10
            await session.commit()

            full_prompt = _build_prompt(text, prompt, empresa, medicao, periodo)
            parsed = await asyncio.to_thread(_call_ai_sync, full_prompt)

            job.progress = 90
            await session.commit()

            from app.workers.report_generator import generate_fato_report
            contrato = {"name": empresa, "client": "", "edital": ""}
            report_text = generate_fato_report(parsed, contrato, [])

            funcionarios = parsed.get("funcionarios", [])
            result_row = Result(
                job_id=job.id,
                funcionarios=funcionarios,
                inconsistencias=parsed.get("inconsistencias", []),
                report_text=report_text,
                tipo_documento=parsed.get("tipo_documento", ""),
                empresa=parsed.get("empresa", empresa),
                competencia=parsed.get("competencia", periodo),
                total_funcionarios=parsed.get("total_funcionarios", len(funcionarios)),
            )
            session.add(result_row)

            job.status = "done"
            job.progress = 100
            job.completed_at = datetime.now(timezone.utc)
            await session.commit()
            logger.info("Job %s concluído", job_id)

        except Exception as exc:
            logger.error("Job %s falhou: %s", job_id, exc, exc_info=True)
            try:
                await session.rollback()
            except Exception:
                pass
            async with AsyncSessionLocal() as err_session:
                err_job = (
                    await err_session.execute(select(Job).where(Job.id == uuid.UUID(job_id)))
                ).scalar_one_or_none()
                if err_job:
                    err_job.status = "error"
                    err_job.error_message = str(exc)
                    await err_session.commit()
