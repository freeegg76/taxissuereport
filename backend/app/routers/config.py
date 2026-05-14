import asyncio
import os
import re
from pathlib import Path
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/config", tags=["config"])

_ENV_PATH = Path(__file__).parents[2] / ".env"
_PLACEHOLDER = {"your_anthropic_api_key_here", "your_google_api_key_here", "your_law_api_key_here", ""}


# ── helpers ──────────────────────────────────────────────────────────────────

def _read_env() -> dict[str, str]:
    if not _ENV_PATH.exists():
        return {}
    out: dict[str, str] = {}
    for line in _ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, val = line.partition("=")
            out[key.strip()] = val.strip()
    return out


def _write_env(updates: dict[str, str]) -> None:
    content = _ENV_PATH.read_text(encoding="utf-8") if _ENV_PATH.exists() else ""
    for key, value in updates.items():
        pattern = rf"^{re.escape(key)}\s*=.*$"
        replacement = f"{key}={value}"
        if re.search(pattern, content, re.MULTILINE):
            content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
        else:
            content = content.rstrip("\n") + f"\n{key}={value}\n"
    _ENV_PATH.write_text(content, encoding="utf-8")


def _mask(val: str) -> str:
    if not val or val in _PLACEHOLDER:
        return ""
    if len(val) <= 8:
        return "****"
    return "****" + val[-4:]


def _is_set(val: str) -> bool:
    return bool(val) and val not in _PLACEHOLDER


# ── schemas ──────────────────────────────────────────────────────────────────

class ConfigUpdate(BaseModel):
    llm_provider: str | None = None
    anthropic_api_key: str | None = None
    anthropic_model: str | None = None
    google_api_key: str | None = None
    gemini_model: str | None = None
    law_api_key: str | None = None


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
def get_config():
    env = _read_env()
    return {
        "llm_provider": env.get("LLM_PROVIDER", "gemini"),
        "anthropic_model": env.get("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
        "gemini_model": env.get("GEMINI_MODEL", "gemini-2.5-flash"),
        "anthropic_key_masked": _mask(env.get("ANTHROPIC_API_KEY", "")),
        "google_key_masked": _mask(env.get("GOOGLE_API_KEY", "")),
        "law_key_masked": _mask(env.get("LAW_API_KEY", "")),
        "anthropic_key_set": _is_set(env.get("ANTHROPIC_API_KEY", "")),
        "google_key_set": _is_set(env.get("GOOGLE_API_KEY", "")),
        "law_key_set": _is_set(env.get("LAW_API_KEY", "")),
        "setup_complete": (
            _is_set(env.get("LAW_API_KEY", "")) and
            (
                (env.get("LLM_PROVIDER") == "anthropic" and _is_set(env.get("ANTHROPIC_API_KEY", ""))) or
                (env.get("LLM_PROVIDER") == "gemini" and _is_set(env.get("GOOGLE_API_KEY", "")))
            )
        ),
    }


@router.post("")
def save_config(cfg: ConfigUpdate):
    updates: dict[str, str] = {}
    if cfg.llm_provider:
        updates["LLM_PROVIDER"] = cfg.llm_provider
    if cfg.anthropic_api_key:
        updates["ANTHROPIC_API_KEY"] = cfg.anthropic_api_key
    if cfg.anthropic_model:
        updates["ANTHROPIC_MODEL"] = cfg.anthropic_model
    if cfg.google_api_key:
        updates["GOOGLE_API_KEY"] = cfg.google_api_key
    if cfg.gemini_model:
        updates["GEMINI_MODEL"] = cfg.gemini_model
    if cfg.law_api_key:
        updates["LAW_API_KEY"] = cfg.law_api_key
    _write_env(updates)
    return {"ok": True, "needs_restart": True}


@router.post("/restart")
async def restart_server():
    """Gracefully exits the process with code 3 (restart signal for start.bat loop)."""
    async def _do():
        await asyncio.sleep(0.6)
        os._exit(3)  # exit code 3 = restart signal consumed by start.bat loop
    asyncio.create_task(_do())
    return {"ok": True}
