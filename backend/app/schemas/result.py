import uuid
from datetime import datetime

from pydantic import BaseModel


class ResultOut(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    funcionarios: list
    inconsistencias: list
    report_text: str
    tipo_documento: str
    empresa: str
    competencia: str
    total_funcionarios: int
    created_at: datetime

    model_config = {"from_attributes": True}
