import json
from sqlalchemy.orm import Session

from app.db import crud
from app.db.models import Issue
from app.schemas.case_schemas import CaseSelectionOutput
from app.services.llm_client import call_llm_with_skill, load_reference_doc, strip_json_fences
from app.core.config import settings


async def select_cases(issue: Issue, db: Session) -> CaseSelectionOutput:
    cases = crud.get_cases_by_issue(db, issue.issue_id)
    if not cases:
        raise ValueError("선별할 판례가 없습니다. 판례 검색을 먼저 실행하세요.")

    # Limit to most recent 20 to keep prompt size manageable
    cases = cases[:20]

    selection_ref = load_reference_doc("case-selector", "selection_criteria.md")
    base_message = _build_message(issue, cases)

    for attempt in range(settings.llm_retry_max + 1):
        message = base_message
        if attempt > 0:
            message += f"\n\n[이전 응답 오류: {last_error}. 반드시 올바른 JSON만 출력하세요.]"

        raw = await call_llm_with_skill(
            skill_name="case-selector",
            user_message=message,
            max_tokens=4096,
            extra_context=selection_ref,
            issue_id=issue.issue_id,
            db=db,
        )

        try:
            data = json.loads(strip_json_fences(raw))
            result = CaseSelectionOutput(**data)

            # 선별 결과가 0건이면 기준 완화 후 재시도
            if not result.selected_cases and attempt < settings.llm_retry_max:
                last_error = "선별 결과가 0건입니다. 기준을 완화하여 최소 1건 이상 선별하세요."
                continue

            crud.update_case_selection(db, result.selected_cases)
            crud.update_issue_status(db, issue, "searched")
            return result
        except Exception as e:
            last_error = str(e)
            if attempt == settings.llm_retry_max:
                raise RuntimeError(f"판례 선별 실패 ({settings.llm_retry_max + 1}회 시도): {last_error}")


def _build_message(issue: Issue, cases) -> str:
    def _case_block(c) -> str:
        lines = [
            f"[CASE_ID: {c.case_id}]",
            f"사건명: {c.case_name or ''}",
            f"사건번호: {c.case_number or ''}",
        ]
        if c.court_name:
            lines.append(f"법원: {c.court_name}")
        if c.decision_date:
            lines.append(f"선고일: {c.decision_date}")
        if c.holding:
            lines.append(f"판시사항: {c.holding[:500]}")
        if c.summary:
            lines.append(f"판결요지: {c.summary[:500]}")
        if c.full_text:
            lines.append(f"판례내용(요약): {c.full_text[:800]}")
        return "\n".join(lines)

    cases_text = "\n\n".join([_case_block(c) for c in cases])

    return f"""다음 세무 이슈에 대해 검색된 판례 후보에서 보고서에 사용할 판례를 선별하세요.

## 세무 이슈
세목: {issue.tax_category}
요약: {issue.issue_summary}
키워드: {issue.extracted_keywords}

## 판례 후보 목록
판례 내용이 없는 경우 사건명만으로 이슈와의 관련성을 판단하세요.

{cases_text}

## 응답 형식 (이 JSON 구조만 출력)
{{
  "selected_cases": [
    {{
      "case_id": 판례의_CASE_ID_숫자,
      "relevance_score": 0.0에서_1.0_사이_실수,
      "rank_order": 1부터_시작하는_순위,
      "selection_reason": "선별 사유 (50자 이상, 이슈와의 연관성 및 판결의 시사점 포함)"
    }}
  ]
}}

최대 {settings.max_selected_cases}건을 선별하세요. 반드시 최소 1건 이상 선별해야 합니다."""
