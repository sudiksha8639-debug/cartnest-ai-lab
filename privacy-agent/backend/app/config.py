from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    llm_mode: str
    llm_api_key: str | None
    llm_base_url: str
    llm_model: str
    llm_timeout_seconds: float
    allowed_origins: tuple[str, ...]

    @property
    def effective_mode(self) -> str:
        return "llm" if self.llm_mode == "openai" and self.llm_api_key else "mock"


def load_settings() -> Settings:
    mode = os.environ.get("LLM_MODE", "mock").strip().lower()
    api_key = os.environ.get("LLM_API_KEY", "").strip() or None
    return Settings(
        llm_mode=mode,
        llm_api_key=api_key,
        llm_base_url=os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/"),
        llm_model=os.environ.get("LLM_MODEL", "gpt-4o-mini"),
        llm_timeout_seconds=float(os.environ.get("LLM_TIMEOUT_SECONDS", "25")),
        allowed_origins=tuple(
            origin.strip()
            for origin in os.environ.get(
                "ALLOWED_EXTENSION_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173",
            ).split(",")
            if origin.strip()
        ),
    )


settings = load_settings()
