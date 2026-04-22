import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Result(Base):
    __tablename__ = "results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("jobs.id"), unique=True, nullable=False)
    funcionarios: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    inconsistencias: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    report_text: Mapped[str] = mapped_column(Text, nullable=False)
    tipo_documento: Mapped[str] = mapped_column(String(100), nullable=False)
    empresa: Mapped[str] = mapped_column(String(255), nullable=False)
    competencia: Mapped[str] = mapped_column(String(50), nullable=False)
    total_funcionarios: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
