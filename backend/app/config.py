"""从 backend/.env 读取 LLM 与路径配置，供 Agent 与检索共用。"""

from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """进程级配置；字段名对应环境变量（大小写不敏感）。"""

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
    auth_secret: str = "dev-only-change-me"

    @property
    def knowledge_dir(self) -> Path:
        """攻略 Markdown 目录。

        @returns Path
        """
        return BACKEND_DIR / "knowledge"

    @property
    def data_dir(self) -> Path:
        """SQLite 等运行时数据目录。

        @returns Path
        """
        return BACKEND_DIR / "data"

    @property
    def sqlite_path(self) -> Path:
        """会话库文件路径。

        @returns Path
        """
        return self.data_dir / "app.db"

    def llm_api_key(self) -> str:
        """按当前提供商返回 API Key。

        @returns str 已 strip 的密钥，未配置时可能为空
        """
        if self.default_llm_provider.lower() == "openai":
            return self.openai_api_key.strip()
        return self.deepseek_api_key.strip()

    def llm_base_url(self) -> str:
        """按当前提供商返回兼容 OpenAI 的 base_url。

        @returns str
        """
        if self.default_llm_provider.lower() == "openai":
            return self.openai_base_url
        return self.deepseek_base_url

    def llm_model(self) -> str:
        """按当前提供商返回模型名。

        @returns str
        """
        if self.default_llm_provider.lower() == "openai":
            return self.openai_model
        return self.deepseek_model


settings = Settings()
