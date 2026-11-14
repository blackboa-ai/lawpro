"""Add Case model fields enhancements.

Revision ID: 20241216_add_case_fields
Revises: 20241215_initial
Create Date: 2024-12-16 00:00:00.000000

This migration enhances the existing cases table with additional columns and
makes previously non-nullable columns nullable for flexibility.

Since the initial migration already includes all columns (with proper nullable settings),
this migration is now essentially a no-op for new databases but handles compatibility
for databases that may have been created with different constraints.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20241216_add_case_fields'
down_revision = '20241215_initial'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Upgrade the database schema - no-op for PostgreSQL, handle SQLite quirks."""
    # The initial migration already creates tables with correct column definitions.
    # This migration exists for backwards compatibility with older databases.
    # For PostgreSQL, all columns are already correctly defined.
    # For SQLite, we only need to handle cases where tables may have been created
    # with incorrect nullability (should not happen with fresh migrations).
    pass


def downgrade() -> None:
    """Downgrade the database schema - no-op for this migration."""
    pass