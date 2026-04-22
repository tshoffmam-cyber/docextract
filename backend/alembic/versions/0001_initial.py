"""initial

Revision ID: 0001
Revises:
Create Date: 2026-04-22 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("plan", sa.String(50), nullable=False, server_default="starter"),
        sa.Column("google_refresh_token", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "contracts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("client", sa.String(255), nullable=False),
        sa.Column("edital", sa.String(255), nullable=False),
        sa.Column("fields_template", JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_contracts_user_id", "contracts", ["user_id"])

    op.create_table(
        "jobs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="queued"),
        sa.Column("progress", sa.Integer, nullable=False, server_default="0"),
        sa.Column("pdf_key", sa.String(512), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("total_pages", sa.Integer, nullable=False, server_default="0"),
        sa.Column("fields", JSONB, nullable=True),
        sa.Column("contrato", JSONB, nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_jobs_user_id", "jobs", ["user_id"])
    op.create_index("ix_jobs_status", "jobs", ["status"])

    op.create_table(
        "results",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("funcionarios", JSONB, nullable=False, server_default="[]"),
        sa.Column("inconsistencias", JSONB, nullable=False, server_default="[]"),
        sa.Column("report_text", sa.Text, nullable=False),
        sa.Column("tipo_documento", sa.String(100), nullable=False),
        sa.Column("empresa", sa.String(255), nullable=False),
        sa.Column("competencia", sa.String(50), nullable=False),
        sa.Column("total_funcionarios", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("results")
    op.drop_index("ix_jobs_status", "jobs")
    op.drop_index("ix_jobs_user_id", "jobs")
    op.drop_table("jobs")
    op.drop_index("ix_contracts_user_id", "contracts")
    op.drop_table("contracts")
    op.drop_table("users")
