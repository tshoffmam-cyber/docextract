import uuid

from fastapi import APIRouter, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, DB
from app.models.job import Job
from app.services.storage import upload_file
from app.workers.tasks import process_document

router = APIRouter(tags=["upload"])


@router.post("/upload", status_code=status.HTTP_202_ACCEPTED)
async def upload_pdf(
    file: UploadFile,
    current_user: CurrentUser,
    db: DB,
    fields: str = "{}",
    contrato: str = "{}",
):
    import json

    if file.content_type not in ("application/pdf", "application/octet-stream") and not (
        file.filename or ""
    ).lower().endswith(".pdf"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Apenas PDFs são aceitos")

    try:
        fields_dict = json.loads(fields)
        contrato_dict = json.loads(contrato)
    except json.JSONDecodeError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="fields e contrato devem ser JSON válido")

    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Arquivo vazio")

    job_id = uuid.uuid4()
    pdf_key = f"pdfs/{job_id}/{file.filename}"
    upload_file(pdf_key, pdf_bytes, "application/pdf")

    job = Job(
        id=job_id,
        user_id=current_user.id,
        pdf_key=pdf_key,
        original_filename=file.filename or "documento.pdf",
        fields=fields_dict,
        contrato=contrato_dict,
    )
    db.add(job)
    await db.flush()

    process_document.delay(str(job_id))

    return {"job_id": str(job_id), "message": "Processando..."}
