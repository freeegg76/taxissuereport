import asyncio
import sys
sys.path.insert(0, ".")

async def test():
    from google import genai
    from google.genai import types
    from app.core.config import settings

    client = genai.Client(api_key=settings.google_api_key)

    # Simple test with explicit max tokens
    response = await client.aio.models.generate_content(
        model=settings.gemini_model,
        contents="판례 목록에서 관련 판례를 선별하세요. CASE_ID 1, 2, 3 중에서 부당행위계산부인 관련 판례를 골라주세요.\n\n[CASE_ID: 1]\n사건명: 법인 부당행위계산부인 적용\n[CASE_ID: 2]\n사건명: 소득세 신고\n[CASE_ID: 3]\n사건명: 특수관계인 부당행위계산부인\n\n{\"selected_cases\": [{\"case_id\": X, \"relevance_score\": 0.9, \"rank_order\": 1, \"selection_reason\": \"이유\"}]} 형식으로만 답하세요.",
        config=types.GenerateContentConfig(
            max_output_tokens=4096,
        ),
    )

    print(f"finish_reason: {response.candidates[0].finish_reason}")
    print(f"text length: {len(response.text or '')}")
    print(f"text: {response.text}")

asyncio.run(test())
