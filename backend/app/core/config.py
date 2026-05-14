from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # LLM 프로바이더 선택: "anthropic" | "gemini"
    llm_provider: Literal["anthropic", "gemini"] = "anthropic"

    # Anthropic
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"

    # Google Gemini
    google_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"

    law_api_key: str = ""
    database_url: str = "sqlite:///./tax_agent.db"
    law_api_base_url: str = "http://www.law.go.kr/DRF"
    max_search_results: int = 20
    max_selected_cases: int = 5
    llm_retry_max: int = 2

    @property
    def llm_model(self) -> str:
        return self.anthropic_model if self.llm_provider == "anthropic" else self.gemini_model


settings = Settings()
