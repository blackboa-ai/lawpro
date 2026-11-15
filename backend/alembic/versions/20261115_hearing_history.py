"""Store hearing date changes.

Revision ID: 20261115_hearing_history
Revises: 20241216_add_case_fields
"""
from alembic import op
import sqlalchemy as sa

revision = "20261115_hearing_history"
down_revision = "20241216_add_case_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "hearing_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("case_id", sa.Integer(), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("hearing_date", sa.Date(), nullable=False),
        sa.Column("next_hearing_date", sa.Date()),
        sa.Column("notes", sa.Text()),
        sa.Column("recorded_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )
    op.create_index("ix_hearing_history_case_id", "hearing_history", ["case_id"])


def downgrade() -> None:
    op.drop_table("hearing_history")
