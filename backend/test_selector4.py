import asyncio
import sys, json
sys.path.insert(0, ".")

async def test():
    from google import genai
    from google.genai import types
    from app.core.config import settings
    from app.core.database import SessionLocal
    from app.db import crud
    from app.services.case_selector_service import _build_message
    from app.services.llm_client import load_skill_prompt, load_reference_doc

    db = SessionLocal()
    issue = crud.get_issue(db, 9)
    cases = crud.get_cases_by_issue(db, 9)[:20]

    system = load_skill_prompt("case-selector")
    ref = load_reference_doc("case-selector", "selection_criteria.md")
    if ref:
        system = system + "\n\n---\n\n" + ref
    message = _build_message(issue, cases)

    client = genai.Client(api_key=settings.google_api_key)

    # Test with 16384 tokens
    response = await client.aio.models.generate_content(
        model=settings.gemini_model,
        contents=message,
        config=types.GenerateContentConfig(
            system_instruction=system,
            max_output_tokens=16384,
        ),
    )

    candidate = response.candidates[0]
    print(f"finish_reason: {candidate.finish_reason}")
    text = response.text or ""
    print(f"text length: {len(text)}")

    try:
        clean = text.strip()
        if clean.startswith("```json"):
            clean = clean[7:]
        elif clean.startswith("```"):
            clean = clean[3:]
        if clean.endswith("```"):
            clean = clean[:-3]
        data = json.loads(clean.strip())
        selected = data.get("selected_cases", [])
        print(f"Selected {len(selected)} cases:")
        for c in selected:
            print(f"  case_id={c['case_id']} score={c['relevance_score']} rank={c['rank_order']}")
    except Exception as e:
        print(f"Parse error: {e}")
        print(f"Text: {text[:500]}")

    db.close()

asyncio.run(test())
