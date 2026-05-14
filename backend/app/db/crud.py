import json
from datetime import datetime
from sqlalchemy.orm import Session
from app.db.models import Issue, Case, Report, ExportedFile, ApiLog
from app.schemas.issue_schemas import IssueCreate, IssueAnalysisOutput
from app.schemas.case_schemas import CaseSelectionItem


def _now() -> str:
    return datetime.utcnow().isoformat()


# ---------- Issues ----------

def create_issue(db: Session, data: IssueCreate) -> Issue:
    now = _now()
    issue = Issue(
        title=data.title,
        raw_input=data.raw_input,
        status="created",
        created_at=now,
        updated_at=now,
    )
    db.add(issue)
    db.commit()
    db.refresh(issue)
    return issue


def get_issue(db: Session, issue_id: int) -> Issue | None:
    return db.get(Issue, issue_id)


def list_issues(db: Session) -> list[Issue]:
    return db.query(Issue).order_by(Issue.created_at.desc()).all()


def update_issue_status(db: Session, issue: Issue, status: str) -> Issue:
    issue.status = status
    issue.updated_at = _now()
    db.commit()
    db.refresh(issue)
    return issue


def update_issue_analysis(db: Session, issue: Issue, result: IssueAnalysisOutput) -> Issue:
    issue.tax_category = result.tax_category
    issue.issue_summary = result.issue_summary
    issue.extracted_keywords = json.dumps(result.extracted_keywords, ensure_ascii=False)
    issue.search_strategy = json.dumps(result.search_strategy.model_dump(), ensure_ascii=False)
    issue.status = "analyzed"
    issue.updated_at = _now()
    db.commit()
    db.refresh(issue)
    return issue


# ---------- Cases ----------

def save_cases(db: Session, issue_id: int, cases_data: list[dict]) -> list[Case]:
    now = _now()
    saved = []
    for d in cases_data:
        case = Case(
            issue_id=issue_id,
            external_case_id=d.get("external_case_id"),
            case_name=d.get("case_name"),
            case_number=d.get("case_number"),
            court_name=d.get("court_name"),
            decision_date=d.get("decision_date"),
            case_type=d.get("case_type"),
            source_url=d.get("source_url"),
            summary=d.get("summary"),
            holding=d.get("holding"),
            reasoning=d.get("reasoning"),
            full_text=d.get("full_text"),
            raw_metadata=json.dumps(d.get("raw_metadata", {}), ensure_ascii=False),
            raw_content=json.dumps(d.get("raw_content", {}), ensure_ascii=False),
            created_at=now,
            updated_at=now,
        )
        db.add(case)
        saved.append(case)
    db.commit()
    for c in saved:
        db.refresh(c)
    return saved


def get_cases_by_issue(db: Session, issue_id: int) -> list[Case]:
    return db.query(Case).filter(Case.issue_id == issue_id).all()


def get_selected_cases(db: Session, issue_id: int) -> list[Case]:
    return (
        db.query(Case)
        .filter(Case.issue_id == issue_id, Case.selected == 1)
        .order_by(Case.rank_order)
        .all()
    )


def update_case_selection(db: Session, selections: list[CaseSelectionItem]) -> None:
    now = _now()
    for item in selections:
        case = db.get(Case, item.case_id)
        if case:
            case.selected = 1
            case.relevance_score = item.relevance_score
            case.rank_order = item.rank_order
            case.selection_reason = item.selection_reason
            case.updated_at = now
    db.commit()


def get_case(db: Session, case_id: int) -> Case | None:
    return db.get(Case, case_id)


# ---------- Reports ----------

def upsert_report(db: Session, issue_id: int, data: dict) -> Report:
    now = _now()
    report = db.query(Report).filter(Report.issue_id == issue_id).first()
    if report is None:
        report = Report(issue_id=issue_id, created_at=now)
        db.add(report)
    report.title = data.get("title", report.title)
    report.executive_summary = data.get("executive_summary", report.executive_summary)
    report.issue_analysis = data.get("issue_analysis", report.issue_analysis)
    report.case_analysis = data.get("case_analysis", report.case_analysis)
    report.application_analysis = data.get("application_analysis", report.application_analysis)
    report.risk_analysis = data.get("risk_analysis", report.risk_analysis)
    report.practical_recommendation = data.get("practical_recommendation", report.practical_recommendation)
    report.conclusion = data.get("conclusion", report.conclusion)
    report.full_report_markdown = data.get("full_report_markdown", report.full_report_markdown)
    report.full_report_html = data.get("full_report_html", report.full_report_html)
    report.status = data.get("status", report.status or "draft")
    report.updated_at = now
    db.commit()
    db.refresh(report)
    return report


def get_report_by_issue(db: Session, issue_id: int) -> Report | None:
    return db.query(Report).filter(Report.issue_id == issue_id).first()


def finalize_report(db: Session, report: Report) -> Report:
    report.status = "finalized"
    report.finalized_at = _now()
    report.updated_at = _now()
    db.commit()
    db.refresh(report)
    return report


# ---------- Exported Files ----------

def save_exported_file(db: Session, report_id: int, file_type: str, file_path: str, file_name: str) -> ExportedFile:
    ef = ExportedFile(
        report_id=report_id,
        file_type=file_type,
        file_path=file_path,
        file_name=file_name,
        created_at=_now(),
    )
    db.add(ef)
    db.commit()
    db.refresh(ef)
    return ef


def get_exported_file(db: Session, file_id: int) -> ExportedFile | None:
    return db.get(ExportedFile, file_id)


# ---------- API Logs ----------

def create_api_log(
    db: Session,
    issue_id: int | None,
    provider: str,
    endpoint: str | None,
    request_payload: dict | None,
    response_payload: dict | None,
    status_code: int | None,
    error_message: str | None = None,
) -> ApiLog:
    log = ApiLog(
        issue_id=issue_id,
        provider=provider,
        endpoint=endpoint,
        request_payload=json.dumps(request_payload, ensure_ascii=False) if request_payload else None,
        response_payload=json.dumps(response_payload, ensure_ascii=False) if response_payload else None,
        status_code=status_code,
        error_message=error_message,
        created_at=_now(),
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def get_api_logs_by_issue(db: Session, issue_id: int) -> list[ApiLog]:
    return (
        db.query(ApiLog)
        .filter(ApiLog.issue_id == issue_id)
        .order_by(ApiLog.created_at.desc())
        .all()
    )
