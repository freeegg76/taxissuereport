import asyncio
import sys
sys.path.insert(0, ".")

async def test():
    from app.core.database import SessionLocal
    from app.db import crud
    from app.services.case_selector_service import _build_message
    from app.services.llm_client import call_llm_with_skill, strip_json_fences
    import json

    db = SessionLocal()
    issue = crud.get_issue(db, 9)
    cases = crud.get_cases_by_issue(db, 9)
    print(f"Issue: {issue.tax_category}, Cases: {len(cases)}")

    message = _build_message(issue, cases[:3])  # just first 3
    print("=== MESSAGE (first 500 chars) ===")
    print(message[:500])
    print("...")

    raw = await call_llm_with_skill(
        skill_name="case-selector",
        user_message=message,
        max_tokens=2048,
        issue_id=9,
        db=db,
    )
    print("=== RAW RESPONSE ===")
    print(raw[:1000])

    data = json.loads(strip_json_fences(raw))
    print("=== PARSED ===")
    print(json.dumps(data, ensure_ascii=False, indent=2))
    db.close()

asyncio.run(test())
