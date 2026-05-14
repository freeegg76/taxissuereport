from functools import lru_cache
from pathlib import Path
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import crud

_PROJECT_ROOT = Path(__file__).parents[3]
_SKILL_DIR = _PROJECT_ROOT / ".claude" / "skills"
_AGENT_DIR = _PROJECT_ROOT / ".claude" / "agents"


@lru_cache(maxsize=None)
def load_skill_prompt(skill_name: str) -> str:
    path = _SKILL_DIR / skill_name / "SKILL.md"
    if not path.exists():
        raise FileNotFoundError(f"SKILL.md not found: {path}")
    return path.read_text(encoding="utf-8")


@lru_cache(maxsize=None)
def load_agent_prompt(agent_name: str) -> str:
    path = _AGENT_DIR / agent_name / "AGENT.md"
    if not path.exists():
        raise FileNotFoundError(f"AGENT.md not found: {path}")
    return path.read_text(encoding="utf-8")


@lru_cache(maxsize=None)
def load_reference_doc(skill_name: str, filename: str) -> str:
    path = _SKILL_DIR / skill_name / "references" / filename
    return path.read_text(encoding="utf-8") if path.exists() else ""


async def _call_anthropic(system: str, user_message: str, max_tokens: int) -> str:
    import anthropic
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    msg = await client.messages.create(
        model=settings.anthropic_model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user_message}],
    )
    return msg.content[0].text


async def _call_gemini(system: str, user_message: str, max_tokens: int) -> str:
    import asyncio
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=settings.google_api_key)
    # gemini-2.5-flash counts thinking tokens against max_output_tokens.
    # Use a capped thinking budget + generous output limit to balance speed vs completeness.
    effective_max = max(max_tokens, 8192)

    for attempt in range(3):
        try:
            response = await client.aio.models.generate_content(
                model=settings.gemini_model,
                contents=user_message,
                config=types.GenerateContentConfig(
                    system_instruction=system,
                    max_output_tokens=effective_max,
                    thinking_config=types.ThinkingConfig(thinking_budget=512),
                ),
            )
        except Exception as e:
            msg = str(e)
            # 503 overload: retry with backoff
            if "503" in msg or "UNAVAILABLE" in msg:
                if attempt < 2:
                    await asyncio.sleep(10 * (attempt + 1))
                    continue
            raise

        if response.text is not None:
            return response.text
        try:
            return response.candidates[0].content.parts[0].text or ""
        except (IndexError, AttributeError):
            raise RuntimeError(
                f"Gemini 응답에서 텍스트를 추출할 수 없습니다. finish_reason: "
                f"{response.candidates[0].finish_reason if response.candidates else 'unknown'}"
            )

    raise RuntimeError("Gemini API 과부하 (503). 잠시 후 다시 시도해 주세요.")


async def _call_llm(system: str, user_message: str, max_tokens: int) -> str:
    if settings.llm_provider == "gemini":
        return await _call_gemini(system, user_message, max_tokens)
    return await _call_anthropic(system, user_message, max_tokens)


async def call_llm_with_skill(
    skill_name: str,
    user_message: str,
    max_tokens: int = 4096,
    extra_context: str | None = None,
    issue_id: int | None = None,
    db: Session | None = None,
) -> str:
    system = load_skill_prompt(skill_name)
    if extra_context:
        system = system + "\n\n---\n\n" + extra_context

    req_payload = {"model": settings.llm_model, "provider": settings.llm_provider, "skill": skill_name}
    error_msg = None
    status_code = None

    try:
        result = await _call_llm(system, user_message, max_tokens)
        status_code = 200
        return result
    except Exception as e:
        error_msg = str(e)
        status_code = 500
        raise
    finally:
        if db is not None:
            crud.create_api_log(
                db=db,
                issue_id=issue_id,
                provider=settings.llm_provider,
                endpoint=f"skill:{skill_name}",
                request_payload=req_payload,
                response_payload=None,
                status_code=status_code,
                error_message=error_msg,
            )


async def call_llm_with_agent(
    agent_name: str,
    user_message: str,
    max_tokens: int = 2048,
    issue_id: int | None = None,
    db: Session | None = None,
) -> str:
    system = load_agent_prompt(agent_name)
    req_payload = {"model": settings.llm_model, "provider": settings.llm_provider, "agent": agent_name}
    error_msg = None
    status_code = None

    try:
        result = await _call_llm(system, user_message, max_tokens)
        status_code = 200
        return result
    except Exception as e:
        error_msg = str(e)
        status_code = 500
        raise
    finally:
        if db is not None:
            crud.create_api_log(
                db=db,
                issue_id=issue_id,
                provider=settings.llm_provider,
                endpoint=f"agent:{agent_name}",
                request_payload=req_payload,
                response_payload=None,
                status_code=status_code,
                error_message=error_msg,
            )


def strip_json_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()
