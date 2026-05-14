import asyncio, time, json, sys
sys.path.insert(0, ".")

async def test():
    from google import genai
    from google.genai import types
    from app.core.config import settings
    from app.core.database import SessionLocal
    from app.db import crud
    from app.services.case_selector_service import _build_message
    from app.services.llm_client import load_skill_prompt, load_reference_doc, strip_json_fences

    db = SessionLocal()
    issue = crud.get_issue(db, 9)
    cases = crud.get_cases_by_issue(db, 9)[:20]
    system = load_skill_prompt("case-selector")
    ref = load_reference_doc("case-selector", "selection_criteria.md")
    if ref: system = system + "\n\n---\n\n" + ref
    message = _build_message(issue, cases)

    client = genai.Client(api_key=settings.google_api_key)

    for budget, max_tok in [(0, 4096), (0, 8192), (None, 16384)]:
        cfg = {"max_output_tokens": max_tok}
        if budget is not None:
            cfg["thinking_config"] = types.ThinkingConfig(thinking_budget=budget)

        t0 = time.time()
        response = await client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=message,
            config=types.GenerateContentConfig(system_instruction=system, **cfg),
        )
        elapsed = time.time() - t0
        text = response.text or ""
        finish = response.candidates[0].finish_reason
        try:
            data = json.loads(strip_json_fences(text))
            n = len(data.get("selected_cases", []))
        except:
            n = "PARSE_ERROR"
        print(f"budget={budget} max_tok={max_tok}: {elapsed:.1f}s finish={finish} len={len(text)} selected={n}")

    db.close()

asyncio.run(test())
