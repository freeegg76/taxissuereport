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

    print(f"System len: {len(system)}, Message len: {len(message)}")

    client = genai.Client(api_key=settings.google_api_key)
    response = await client.aio.models.generate_content(
        model=settings.gemini_model,
        contents=message,
        config=types.GenerateContentConfig(
            system_instruction=system,
            max_output_tokens=4096,
        ),
    )

    candidate = response.candidates[0]
    print(f"finish_reason: {candidate.finish_reason}")
    text = response.text or ""
    print(f"text length: {len(text)}")
    print(f"text preview: {text[:500]}")

    db.close()

asyncio.run(test())
