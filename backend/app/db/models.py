from datetime import datetime
from sqlalchemy import Integer, Text, Float, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


def _now() -> str:
    return datetime.utcnow().isoformat()


class Issue(Base):
    __tablename__ = "TB_ISSUES"

    issue_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str | None] = mapped_column(Text)
    raw_input: Mapped[str] = mapped_column(Text, nullable=False)
    tax_category: Mapped[str | None] = mapped_column(Text)
    issue_summary: Mapped[str | None] = mapped_column(Text)
    extracted_keywords: Mapped[str | None] = mapped_column(Text)  # JSON string
    search_strategy: Mapped[str | None] = mapped_column(Text)     # JSON string
    status: Mapped[str] = mapped_column(Text, nullable=False, default="created")
    created_at: Mapped[str] = mapped_column(Text, nullable=False, default=_now)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False, default=_now)

    cases: Mapped[list["Case"]] = relationship("Case", back_populates="issue")
    report: Mapped["Report | None"] = relationship("Report", back_populates="issue", uselist=False)
    api_logs: Mapped[list["ApiLog"]] = relationship("ApiLog", back_populates="issue")


class Case(Base):
    __tablename__ = "TB_CASES"

    case_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    issue_id: Mapped[int] = mapped_column(Integer, ForeignKey("TB_ISSUES.issue_id"), nullable=False)
    external_case_id: Mapped[str | None] = mapped_column(Text)
    case_name: Mapped[str | None] = mapped_column(Text)
    case_number: Mapped[str | None] = mapped_column(Text)
    court_name: Mapped[str | None] = mapped_column(Text)
    decision_date: Mapped[str | None] = mapped_column(Text)
    case_type: Mapped[str | None] = mapped_column(Text)
    source_url: Mapped[str | None] = mapped_column(Text)
    summary: Mapped[str | None] = mapped_column(Text)
    holding: Mapped[str | None] = mapped_column(Text)
    reasoning: Mapped[str | None] = mapped_column(Text)
    full_text: Mapped[str | None] = mapped_column(Text)
    relevance_score: Mapped[float | None] = mapped_column(Float)
    rank_order: Mapped[int | None] = mapped_column(Integer)
    selected: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    selection_reason: Mapped[str | None] = mapped_column(Text)
    raw_metadata: Mapped[str | None] = mapped_column(Text)  # JSON string
    raw_content: Mapped[str | None] = mapped_column(Text)   # JSON string
    created_at: Mapped[str] = mapped_column(Text, nullable=False, default=_now)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False, default=_now)

    issue: Mapped["Issue"] = relationship("Issue", back_populates="cases")


class Report(Base):
    __tablename__ = "TB_REPORTS"
    __table_args__ = (UniqueConstraint("issue_id", name="uq_report_issue"),)

    report_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    issue_id: Mapped[int] = mapped_column(Integer, ForeignKey("TB_ISSUES.issue_id"), nullable=False)
    title: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="draft")
    executive_summary: Mapped[str | None] = mapped_column(Text)
    issue_analysis: Mapped[str | None] = mapped_column(Text)
    case_analysis: Mapped[str | None] = mapped_column(Text)
    application_analysis: Mapped[str | None] = mapped_column(Text)
    risk_analysis: Mapped[str | None] = mapped_column(Text)
    practical_recommendation: Mapped[str | None] = mapped_column(Text)
    conclusion: Mapped[str | None] = mapped_column(Text)
    full_report_markdown: Mapped[str | None] = mapped_column(Text)
    full_report_html: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(Text, nullable=False, default=_now)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False, default=_now)
    finalized_at: Mapped[str | None] = mapped_column(Text)

    issue: Mapped["Issue"] = relationship("Issue", back_populates="report")
    exported_files: Mapped[list["ExportedFile"]] = relationship("ExportedFile", back_populates="report")


class ExportedFile(Base):
    __tablename__ = "TB_EXPORTED_FILES"

    file_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    report_id: Mapped[int] = mapped_column(Integer, ForeignKey("TB_REPORTS.report_id"), nullable=False)
    file_type: Mapped[str] = mapped_column(Text, nullable=False)  # docx / pdf
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    file_name: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str] = mapped_column(Text, nullable=False, default=_now)

    report: Mapped["Report"] = relationship("Report", back_populates="exported_files")


class ApiLog(Base):
    __tablename__ = "TB_API_LOGS"

    api_log_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    issue_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("TB_ISSUES.issue_id"))
    provider: Mapped[str] = mapped_column(Text, nullable=False)  # law_api / anthropic
    endpoint: Mapped[str | None] = mapped_column(Text)
    request_payload: Mapped[str | None] = mapped_column(Text)   # JSON string
    response_payload: Mapped[str | None] = mapped_column(Text)  # JSON string
    status_code: Mapped[int | None] = mapped_column(Integer)
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(Text, nullable=False, default=_now)

    issue: Mapped["Issue | None"] = relationship("Issue", back_populates="api_logs")
