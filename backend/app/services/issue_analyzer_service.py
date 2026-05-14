import json
from sqlalchemy.orm import Session
from app.db import crud
from app.db.models import Issue
from app.schemas.issue_schemas import IssueAnalysisOutput
from app.services.llm_client import call_llm_with_skill, load_reference_doc, strip_json_fences
from app.core.config import settings


async def analyze_issue(issue: Issue, db: Session) -> IssueAnalysisOutput:
    tax_ref = load_reference_doc("issue-analyzer", "tax_categories.md")
    base_message = _build_message(issue.raw_input)

    for attempt in range(settings.llm_retry_max + 1):
        message = base_message
        if attempt > 0:
            message += f"\n\n[이전 응답 오류. 반드시 올바른 JSON만 출력하세요. 오류: {last_error}]"

        raw = await call_llm_with_skill(
            skill_name="issue-analyzer",
            user_message=message,
            max_tokens=2048,
            extra_context=tax_ref,
            issue_id=issue.issue_id,
            db=db,
        )

        try:
            data = json.loads(strip_json_fences(raw))
            result = IssueAnalysisOutput(**data)
            crud.update_issue_analysis(db, issue, result)
            crud.update_issue_status(db, issue, "analyzed")
            return result
        except Exception as e:
            last_error = str(e)
            if attempt == settings.llm_retry_max:
                raise RuntimeError(f"이슈 분석 실패 ({settings.llm_retry_max + 1}회 시도): {last_error}")


def _build_message(raw_input: str) -> str:
    return f"""다음 세무 이슈를 분석하여 JSON으로 응답하세요.

## 세무 이슈 원문
{raw_input}

## 응답 형식 (이 JSON 구조만 출력, 다른 텍스트 없음)
{{
  "tax_category": "세목명 (예: 소득세, 법인세, 부가가치세)",
  "issue_summary": "이슈의 핵심 쟁점을 2-3문장으로 요약",
  "extracted_keywords": ["키워드1", "키워드2", "키워드3"],
  "search_strategy": {{
    "primary_query": "핵심 법률 용어 1-2개만. 예: '부당행위계산부인' 또는 '실질과세원칙'. 절대 2단어 초과 금지.",
    "secondary_queries": ["핵심 용어 1-2개", "핵심 용어 1-2개"],
    "filters": {{
      "case_type": "세금부과처분취소",
      "court_level": "전체",
      "date_range_years": 10
    }}
  }}
}}"""
