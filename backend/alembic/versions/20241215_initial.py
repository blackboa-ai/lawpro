"""Initial database schema.

Revision ID: 20241215_initial
Revises: 
Create Date: 2024-12-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20241215_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Upgrade the database schema."""
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(255), nullable=True),
        sa.Column('role', sa.String(20), server_default='advocate', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text("'1970-01-01 00:00:00'"), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text("'1970-01-01 00:00:00'"), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
    )
    
    # Create users table indexes
    op.create_index('idx_users_email', 'users', ['email'], unique=True)
    
    # Create cases table - using snake_case column names to match API schema
    op.create_table(
        'cases',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('case_title', sa.String(255), nullable=False),
        sa.Column('case_number', sa.String(100), nullable=True),
        sa.Column('court_name', sa.String(150), nullable=True),
        sa.Column('next_hearing_date', sa.Date(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(20), server_default='pending', nullable=False),
        sa.Column('client_name', sa.String(255), nullable=True),
        sa.Column('case_type', sa.String(100), nullable=True),
        sa.Column('filing_date', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text("'1970-01-01 00:00:00'"), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text("'1970-01-01 00:00:00'"), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    
    # Create cases table indexes
    op.create_index('idx_cases_user_id', 'cases', ['user_id'])
    op.create_index('idx_cases_next_hearing_date', 'cases', ['next_hearing_date'])
    op.create_index('idx_cases_status', 'cases', ['status'])


def downgrade() -> None:
    """Downgrade the database schema."""
    op.drop_table('cases')
    op.drop_table('users')