import asyncio
import sys, json
sys.path.insert(0, ".")

async def test():
    from app.core.database import SessionLocal
    from app.db import crud
    from app.services.case_selector_service import _build_message
    from app.services.llm_client import call_llm_with_skill, strip_json_fences

    db = SessionLocal()
    issue = crud.get_issue(db, 9)
    all_cases = crud.get_cases_by_issue(db, 9)
    cases = all_cases[:20]
    print(f"Using {len(cases)} cases")

    message = _build_message(issue, cases)
    print(f"Message length: {len(message)} chars")
    print("=== First case in message ===")
    # Show first case block
    lines = message.split('\n')
    for i, line in enumerate(lines):
        if '[CASE_ID:' in line:
            print('\n'.join(lines[i:i+6]))
            break

    raw = await call_llm_with_skill(
        skill_name="case-selector",
        user_message=message,
        max_tokens=4096,
        issue_id=9,
        db=db,
    )
    print(f"\n=== RAW RESPONSE ({len(raw)} chars) ===")
    print(raw[:2000])

    try:
        data = json.loads(strip_json_fences(raw))
        selected = data.get("selected_cases", [])
        print(f"\n=== PARSED: {len(selected)} cases selected ===")
        for c in selected:
            print(f"  case_id={c['case_id']} score={c['relevance_score']}")
    except Exception as e:
        print(f"Parse error: {e}")

    db.close()

asyncio.run(test())
