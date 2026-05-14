import re
from datetime import date
from sqlalchemy.orm import Session

from app.db import crud
from app.db.models import Issue
from app.schemas.report_schemas import LLMReportOutput, ReportSectionValidated, ReportSectionsSchema
from app.services.llm_client import call_llm_with_skill, load_reference_doc, strip_json_fences
from app.services.validate_report import validate_report_markdown
from app.core.config import settings

try:
    import markdown as md_lib
    _HAS_MARKDOWN = True
except ImportError:
    _HAS_MARKDOWN = False


async def generate_report(issue: Issue, db: Session) -> dict:
    selected_cases = crud.get_selected_cases(db, issue.issue_id)
    if not selected_cases:
        raise ValueError("선별된 판례가 없습니다. 판례 선별을 먼저 실행하세요.")

    template_ref = load_reference_doc("report-generator", "report_template.md")
    base_message = _build_message(issue, selected_cases)

    crud.update_issue_status(db, issue, "report_generating")

    for attempt in range(settings.llm_retry_max + 1):
        message = base_message
        if attempt > 0:
            message += f"\n\n[이전 보고서 검증 실패. 오류: {last_error}. 위 오류를 수정하여 재작성하세요.]"

        raw_markdown = await call_llm_with_skill(
            skill_name="report-generator",
            user_message=message,
            max_tokens=16384,
            extra_context=template_ref,
            issue_id=issue.issue_id,
            db=db,
        )

        # Layer 3 validation
        val = validate_report_markdown(raw_markdown)
        if not val.passed:
            last_error = " / ".join(val.errors)
            if attempt == settings.llm_retry_max:
                raise RuntimeError(f"보고서 검증 실패 ({settings.llm_retry_max + 1}회 시도): {last_error}")
            continue

        # Layer 2 Pydantic validation (structural)
        try:
            _validate_pydantic(raw_markdown)
        except Exception as e:
            last_error = str(e)
            if attempt == settings.llm_retry_max:
                raise RuntimeError(f"보고서 스키마 검증 실패: {last_error}")
            continue

        html = _to_html(raw_markdown)
        report_data = {
            "title": f"{issue.tax_category} 이슈 분석 보고서 — {issue.title or issue.issue_id}",
            "full_report_markdown": raw_markdown,
            "full_report_html": html,
            "status": "draft",
            "issue_analysis": _extract_section(raw_markdown, "## 1. 이슈 요약", "## 2. 판례 분석"),
            "case_analysis": _extract_section(raw_markdown, "## 2. 판례 분석", "## 3. 사안 적용"),
            "application_analysis": _extract_section(raw_markdown, "## 3. 사안 적용", "## 4. 리스크 분석"),
            "risk_analysis": _extract_section(raw_markdown, "## 4. 리스크 분석", "## 5. 실무 대응안"),
            "practical_recommendation": _extract_section(raw_markdown, "## 5. 실무 대응안", "## 6. 결론"),
            "conclusion": _extract_section(raw_markdown, "## 6. 결론", "## 참조 판례"),
        }
        report = crud.upsert_report(db, issue.issue_id, report_data)
        crud.update_issue_status(db, issue, "report_ready")
        return {"report_id": report.report_id, "status": report.status}


def _validate_pydantic(markdown: str) -> None:
    # Extract placeholder sections for Pydantic validation
    sections = ReportSectionsSchema(
        issue_summary=ReportSectionValidated(content=_extract_section(markdown, "## 1.", "## 2.")),
        case_analysis=ReportSectionValidated(content=_extract_section(markdown, "## 2.", "## 3.")),
        application_analysis=ReportSectionValidated(content=_extract_section(markdown, "## 3.", "## 4.")),
        risk_analysis=ReportSectionValidated(content=_extract_section(markdown, "## 4.", "## 5.")),
        practical_recommendation=ReportSectionValidated(content=_extract_section(markdown, "## 5.", "## 6.")),
        conclusion=ReportSectionValidated(content=_extract_section(markdown, "## 6.", "## 참조")),
        citations_table=_extract_section(markdown, "## 참조 판례 출처", "---"),
        disclaimer="본 보고서는 참고용이며 전문가 검토가 필요합니다",
    )
    LLMReportOutput(
        title="validation",
        sections=sections,
        full_report_markdown=markdown,
    )


def _extract_section(markdown: str, start_header: str, end_header: str) -> str:
    start = markdown.find(start_header)
    end = markdown.find(end_header, start + 1) if start != -1 else -1
    if start == -1:
        return ""
    if end == -1:
        return markdown[start:].strip()
    return markdown[start:end].strip()


def _to_html(markdown_text: str) -> str:
    if _HAS_MARKDOWN:
        return md_lib.markdown(markdown_text, extensions=["tables", "fenced_code"])
    return f"<pre>{markdown_text}</pre>"


def _build_message(issue: Issue, selected_cases) -> str:
    today = date.today().isoformat()
    cases_detail = "\n\n".join([
        f"### 판례 {i + 1}: {c.case_name} [{c.case_number}]\n"
        f"- CASE_ID: {c.case_id}\n"
        f"- 법원: {c.court_name} | 선고일: {c.decision_date}\n"
        f"- 판시사항: {(c.holding or '')[:800]}\n"
        f"- 판결요지: {(c.summary or '')[:800]}\n"
        f"- 전문 (일부): {(c.full_text or '')[:1000]}\n"
        f"- 선별 사유: {c.selection_reason}"
        for i, c in enumerate(selected_cases)
    ])

    return f"""다음 세무 이슈와 선별된 판례를 기반으로 보고서를 작성하세요.

## 세무 이슈 정보
- 세목: {issue.tax_category}
- 이슈 원문: {issue.raw_input}
- 이슈 요약: {issue.issue_summary}
- 작성일: {today}

## 선별된 판례 ({len(selected_cases)}건)
{cases_detail}

## 지시사항
위 판례와 이슈를 기반으로 6개 섹션 보고서를 Markdown으로 작성하세요.
반드시 SKILL.md의 인용 규칙(각주, ※ 검토 의견: 블록, 법령명+조항번호)을 준수하세요.
기술 용어 첫 등장 시 괄호 주석을 추가하세요.
보고서 전문(Markdown)만 출력하세요. JSON이나 다른 형식 불필요."""
