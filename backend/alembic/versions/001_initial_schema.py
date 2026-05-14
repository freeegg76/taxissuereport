"""Initial schema

Revision ID: 001
Revises:
Create Date: 2026-05-14
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "TB_ISSUES",
        sa.Column("issue_id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("title", sa.Text),
        sa.Column("raw_input", sa.Text, nullable=False),
        sa.Column("tax_category", sa.Text),
        sa.Column("issue_summary", sa.Text),
        sa.Column("extracted_keywords", sa.Text),
        sa.Column("search_strategy", sa.Text),
        sa.Column("status", sa.Text, nullable=False, server_default="created"),
        sa.Column("created_at", sa.Text, nullable=False),
        sa.Column("updated_at", sa.Text, nullable=False),
    )

    op.create_table(
        "TB_CASES",
        sa.Column("case_id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("issue_id", sa.Integer, sa.ForeignKey("TB_ISSUES.issue_id"), nullable=False),
        sa.Column("external_case_id", sa.Text),
        sa.Column("case_name", sa.Text),
        sa.Column("case_number", sa.Text),
        sa.Column("court_name", sa.Text),
        sa.Column("decision_date", sa.Text),
        sa.Column("case_type", sa.Text),
        sa.Column("source_url", sa.Text),
        sa.Column("summary", sa.Text),
        sa.Column("holding", sa.Text),
        sa.Column("reasoning", sa.Text),
        sa.Column("full_text", sa.Text),
        sa.Column("relevance_score", sa.Float),
        sa.Column("rank_order", sa.Integer),
        sa.Column("selected", sa.Integer, nullable=False, server_default="0"),
        sa.Column("selection_reason", sa.Text),
        sa.Column("raw_metadata", sa.Text),
        sa.Column("raw_content", sa.Text),
        sa.Column("created_at", sa.Text, nullable=False),
        sa.Column("updated_at", sa.Text, nullable=False),
    )

    op.create_table(
        "TB_REPORTS",
        sa.Column("report_id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("issue_id", sa.Integer, sa.ForeignKey("TB_ISSUES.issue_id"), nullable=False),
        sa.Column("title", sa.Text),
        sa.Column("status", sa.Text, nullable=False, server_default="draft"),
        sa.Column("executive_summary", sa.Text),
        sa.Column("issue_analysis", sa.Text),
        sa.Column("case_analysis", sa.Text),
        sa.Column("application_analysis", sa.Text),
        sa.Column("risk_analysis", sa.Text),
        sa.Column("practical_recommendation", sa.Text),
        sa.Column("conclusion", sa.Text),
        sa.Column("full_report_markdown", sa.Text),
        sa.Column("full_report_html", sa.Text),
        sa.Column("created_at", sa.Text, nullable=False),
        sa.Column("updated_at", sa.Text, nullable=False),
        sa.Column("finalized_at", sa.Text),
        sa.UniqueConstraint("issue_id", name="uq_report_issue"),
    )

    op.create_table(
        "TB_EXPORTED_FILES",
        sa.Column("file_id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("report_id", sa.Integer, sa.ForeignKey("TB_REPORTS.report_id"), nullable=False),
        sa.Column("file_type", sa.Text, nullable=False),
        sa.Column("file_path", sa.Text, nullable=False),
        sa.Column("file_name", sa.Text, nullable=False),
        sa.Column("created_at", sa.Text, nullable=False),
    )

    op.create_table(
        "TB_API_LOGS",
        sa.Column("api_log_id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("issue_id", sa.Integer, sa.ForeignKey("TB_ISSUES.issue_id")),
        sa.Column("provider", sa.Text, nullable=False),
        sa.Column("endpoint", sa.Text),
        sa.Column("request_payload", sa.Text),
        sa.Column("response_payload", sa.Text),
        sa.Column("status_code", sa.Integer),
        sa.Column("error_message", sa.Text),
        sa.Column("created_at", sa.Text, nullable=False),
    )


def downgrade() -> None:
    op.drop_table("TB_API_LOGS")
    op.drop_table("TB_EXPORTED_FILES")
    op.drop_table("TB_REPORTS")
    op.drop_table("TB_CASES")
    op.drop_table("TB_ISSUES")
