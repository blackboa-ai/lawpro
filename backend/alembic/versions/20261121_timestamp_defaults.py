"""Use live timestamps on new account and case records.

Revision ID: 20261121_timestamp_defaults
Revises: 20261115_hearing_history

Existing 1970 placeholder timestamps are deliberately left unchanged. Without
reliable source dates, backfilling those records would invent legal audit data.
"""
from alembic import op
import sqlalchemy as sa

revision = "20261121_timestamp_defaults"
down_revision = "20261115_hearing_history"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table in ("users", "cases"):
        op.alter_column(
            table,
            "created_at",
            existing_type=sa.DateTime(),
            existing_nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        )
        op.alter_column(
            table,
            "updated_at",
            existing_type=sa.DateTime(),
            existing_nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        )


def downgrade() -> None:
    for table in ("users", "cases"):
        op.alter_column(
            table,
            "created_at",
            existing_type=sa.DateTime(),
            existing_nullable=False,
            server_default=sa.text("'1970-01-01 00:00:00'"),
        )
        op.alter_column(
            table,
            "updated_at",
            existing_type=sa.DateTime(),
            existing_nullable=False,
            server_default=sa.text("'1970-01-01 00:00:00'"),
        )
