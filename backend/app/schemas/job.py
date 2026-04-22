import uuid
from datetime import datetime

from pydantic import BaseModel


class JobCreate(BaseModel):
    fields: dict
    contrato: dict


class JobStatus(BaseModel):
    id: uuid.UUID
    status: str
    progress: int
    message: str
    original_filename: str
    total_pages: int
    created_at: datetime
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}


class JobList(BaseModel):
    id: uuid.UUID
    status: str
    progress: int
    original_filename: str
    created_at: datetime
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}
