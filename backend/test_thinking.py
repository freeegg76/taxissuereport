import asyncio, sys, time
sys.path.insert(0, ".")

async def test():
    from google import genai
    from google.genai import types
    from app.core.config import settings

    client = genai.Client(api_key=settings.google_api_key)
    prompt = "다음 JSON만 출력하세요: {\"result\": \"ok\", \"message\": \"테스트 성공\"}"

    for budget in [None, 0]:
        config_kwargs = {"max_output_tokens": 8192}
        if budget is not None:
            config_kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=budget)

        t0 = time.time()
        response = await client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(**config_kwargs),
        )
        elapsed = time.time() - t0
        print(f"thinking_budget={budget}: {elapsed:.1f}s finish={response.candidates[0].finish_reason} len={len(response.text or '')}")

asyncio.run(test())
