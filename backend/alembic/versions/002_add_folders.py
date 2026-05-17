"""Add folders table and folder_id to issues

Revision ID: 002
Revises: 001
Create Date: 2026-05-17
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "TB_FOLDERS",
        sa.Column("folder_id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("created_at", sa.Text, nullable=False),
    )
    with op.batch_alter_table("TB_ISSUES") as batch_op:
        batch_op.add_column(sa.Column("folder_id", sa.Integer, nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("TB_ISSUES") as batch_op:
        batch_op.drop_column("folder_id")
    op.drop_table("TB_FOLDERS")
