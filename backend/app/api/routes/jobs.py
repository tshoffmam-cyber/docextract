import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DB
from app.models.job import Job
from app.models.result import Result
from app.schemas.job import JobList, JobStatus
from app.schemas.result import ResultOut
from app.services.storage import delete_file

router = APIRouter(prefix="/jobs", tags=["jobs"])

_STATUS_MESSAGES = {
    "queued": "Na fila...",
    "processing": "Iniciando processamento...",
    "compressing": "Comprimindo páginas...",
    "extracting": "Extraindo dados com IA...",
    "done": "Concluído.",
    "error": "Erro no processamento.",
}


def _check_owner(job: Job, user_id: uuid.UUID):
    if job.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")


@router.get("", response_model=list[JobList])
async def list_jobs(current_user: CurrentUser, db: DB, page: int = 1, per_page: int = 20):
    offset = (page - 1) * per_page
    rows = (
        await db.execute(
            select(Job).where(Job.user_id == current_user.id).order_by(Job.created_at.desc()).offset(offset).limit(per_page)
        )
    ).scalars().all()
    return rows


@router.get("/{job_id}", response_model=JobStatus)
async def get_job(job_id: uuid.UUID, current_user: CurrentUser, db: DB):
    job = (await db.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job não encontrado")
    _check_owner(job, current_user.id)
    return {**job.__dict__, "message": _STATUS_MESSAGES.get(job.status, job.status)}


@router.get("/{job_id}/result", response_model=ResultOut)
async def get_result(job_id: uuid.UUID, current_user: CurrentUser, db: DB):
    job = (await db.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job não encontrado")
    _check_owner(job, current_user.id)
    if job.status != "done":
        raise HTTPException(status_code=status.HTTP_425_TOO_EARLY, detail=f"Job ainda em processamento: {job.status}")
    result = (await db.execute(select(Result).where(Result.job_id == job_id))).scalar_one_or_none()
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resultado não encontrado")
    return result


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(job_id: uuid.UUID, current_user: CurrentUser, db: DB):
    job = (await db.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job não encontrado")
    _check_owner(job, current_user.id)
    delete_file(job.pdf_key)
    await db.delete(job)
