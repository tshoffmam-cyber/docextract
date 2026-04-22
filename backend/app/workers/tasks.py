import logging
import uuid
from datetime import datetime, timezone

from celery import shared_task
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.job import Job
from app.models.result import Result
from app.services.storage import download_file
from app.workers.celery_app import celery_app
from app.workers.claude_extractor import extract_from_pages
from app.workers.pdf_processor import compress_and_prepare_pdf, get_pdf_page_count
from app.workers.report_generator import generate_fato_report

logger = logging.getLogger(__name__)


async def _update_job(session, job: Job, **kwargs):
    for k, v in kwargs.items():
        setattr(job, k, v)
    await session.commit()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30, name="tasks.process_document")
def process_document(self, job_id: str):
    import asyncio
    asyncio.run(_process(self, job_id))


async def _process(task, job_id: str):
    async with AsyncSessionLocal() as session:
        job = (await session.execute(select(Job).where(Job.id == uuid.UUID(job_id)))).scalar_one_or_none()
        if not job:
            logger.error("Job %s not found", job_id)
            return

        try:
            # Step 1 — start
            await _update_job(session, job, status="processing", progress=5)

            # Step 2 — download PDF
            pdf_bytes = download_file(job.pdf_key)
            total_pages = get_pdf_page_count(pdf_bytes)
            await _update_job(session, job, total_pages=total_pages, status="compressing", progress=10)

            # Step 3 — compress pages
            pages_b64 = compress_and_prepare_pdf(pdf_bytes)
            await _update_job(session, job, progress=50)

            # Step 4 — extract with Claude
            await _update_job(session, job, status="extracting", progress=55)
            fields = list((job.fields or {}).keys())
            contrato = job.contrato or {}
            parsed = extract_from_pages(pages_b64, fields, contrato)
            await _update_job(session, job, progress=90)

            # Step 5 — generate report
            report_text = generate_fato_report(parsed, contrato, [])
            await _update_job(session, job, progress=95)

            # Step 6 — save result
            result = Result(
                job_id=job.id,
                funcionarios=parsed.get("funcionarios", []),
                inconsistencias=parsed.get("inconsistencias", []),
                report_text=report_text,
                tipo_documento=parsed.get("tipo_documento", ""),
                empresa=parsed.get("empresa", ""),
                competencia=parsed.get("competencia", ""),
                total_funcionarios=parsed.get("total_funcionarios", 0),
            )
            session.add(result)
            await _update_job(
                session, job,
                status="done",
                progress=100,
                completed_at=datetime.now(timezone.utc),
            )

        except Exception as exc:
            logger.error("Job %s failed: %s", job_id, exc, exc_info=True)
            await _update_job(session, job, status="error", error_message=str(exc))
            try:
                raise task.retry(exc=exc)
            except task.MaxRetriesExceededError:
                pass
