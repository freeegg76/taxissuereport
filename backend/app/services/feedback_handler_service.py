import json
from sqlalchemy.orm import Session

from app.db import crud
from app.db.models import Issue, Report
from app.schemas.feedback_schemas import FeedbackAnalysis
from app.services.llm_client import call_llm_with_agent, strip_json_fences
from app.services.law_api_service import search_and_save_cases
from app.services.case_selector_service import select_cases
from app.services.report_generator_service import generate_report


async def handle_feedback(
    issue: Issue,
    report: Report,
    feedback_text: str,
    db: Session,
) -> Report:
    selected_cases = crud.get_selected_cases(db, issue.issue_id)
    cases_summary = "\n".join([
        f"- [{c.case_number}] {c.case_name} ({c.court_name}, {c.decision_date})"
        for c in selected_cases
    ])

    # Phase 1: Classify feedback
    classification_message = f"""## 현재 이슈
세목: {issue.tax_category}
이슈 원문: {issue.raw_input}

## 현재 사용된 판례 목록
{cases_summary}

## 보고서 일부 (처음 500자)
{(report.full_report_markdown or '')[:500]}

## 사용자 피드백
{feedback_text}

위 피드백을 분석하여 아래 JSON만 출력하세요 (다른 텍스트 없음):
{{
  "needs_new_search": true 또는 false,
  "reason": "판단 근거",
  "new_search_queries": ["새 검색어1"],
  "modification_scope": "full_regenerate 또는 section_update",
  "target_sections": ["섹션명"],
  "modification_instructions": "구체적인 수정 지시사항"
}}"""

    raw = await call_llm_with_agent(
        agent_name="feedback-handler",
        user_message=classification_message,
        max_tokens=1024,
        issue_id=issue.issue_id,
        db=db,
    )

    classification = FeedbackAnalysis(**json.loads(strip_json_fences(raw)))

    # Phase 2: Execute
    if classification.needs_new_search:
        if classification.new_search_queries:
            override_strategy = {
                "primary_query": classification.new_search_queries[0],
                "secondary_queries": classification.new_search_queries[1:],
            }
            await search_and_save_cases(issue, db, override_strategy=override_strategy)
            await select_cases(issue, db)
        await generate_report(issue, db)
    else:
        await _update_report_sections(issue, report, classification, db)

    return crud.get_report_by_issue(db, issue.issue_id)


async def _update_report_sections(
    issue: Issue,
    report: Report,
    classification: FeedbackAnalysis,
    db: Session,
) -> None:
    selected_cases = crud.get_selected_cases(db, issue.issue_id)
    cases_detail = "\n\n".join([
        f"[{c.case_number}] {c.case_name}\n판시사항: {(c.holding or '')[:500]}"
        for c in selected_cases
    ])

    update_message = f"""## 원래 보고서
{report.full_report_markdown}

## 사용 가능한 판례
{cases_detail}

## 수정 지시사항
{classification.modification_instructions}

## 수정 대상 섹션
{', '.join(classification.target_sections) if classification.target_sections else '전체'}

위 지시사항에 따라 지정된 섹션을 수정한 완전한 보고서를 Markdown으로 출력하세요.
인용 규칙([판례번호] 각주, ※ 검토 의견: 블록)을 반드시 유지하세요.
보고서 전문만 출력하세요."""

    new_markdown = await call_llm_with_agent(
        agent_name="feedback-handler",
        user_message=update_message,
        max_tokens=8192,
        issue_id=issue.issue_id,
        db=db,
    )

    from app.services.report_generator_service import _to_html, _extract_section
    crud.upsert_report(db, issue.issue_id, {
        "full_report_markdown": new_markdown,
        "full_report_html": _to_html(new_markdown),
        "application_analysis": _extract_section(new_markdown, "## 3.", "## 4."),
        "risk_analysis": _extract_section(new_markdown, "## 4.", "## 5."),
        "practical_recommendation": _extract_section(new_markdown, "## 5.", "## 6."),
        "conclusion": _extract_section(new_markdown, "## 6.", "## 참조"),
    })
