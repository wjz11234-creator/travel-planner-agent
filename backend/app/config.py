from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    default_llm_provider: str = "deepseek"
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"
    host: str = "0.0.0.0"
    port: int = 8000

    @property
    def knowledge_dir(self) -> Path:
        return BACKEND_DIR / "knowledge"

    @property
    def data_dir(self) -> Path:
        return BACKEND_DIR / "data"

    @property
    def sqlite_path(self) -> Path:
        return self.data_dir / "app.db"

    def llm_api_key(self) -> str:
        if self.default_llm_provider.lower() == "openai":
            return self.openai_api_key.strip()
        return self.deepseek_api_key.strip()

    def llm_base_url(self) -> str:
        if self.default_llm_provider.lower() == "openai":
            return self.openai_base_url
        return self.deepseek_base_url

    def llm_model(self) -> str:
        if self.default_llm_provider.lower() == "openai":
            return self.openai_model
        return self.deepseek_model


settings = Settings()
