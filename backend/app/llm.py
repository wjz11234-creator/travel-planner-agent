from __future__ import annotations

from langchain_openai import ChatOpenAI

from app.config import settings


def get_llm(*, temperature: float = 0.2, streaming: bool = False) -> ChatOpenAI:
    key = settings.llm_api_key()
    if not key or key.startswith("your_"):
        raise RuntimeError(
            "未配置 LLM API Key。请复制 backend/.env.example 为 backend/.env 并填写 DEEPSEEK_API_KEY。"
        )
    return ChatOpenAI(
        api_key=key,
        base_url=settings.llm_base_url(),
        model=settings.llm_model(),
        temperature=temperature,
        streaming=streaming,
    )


def llm_configured() -> bool:
    key = settings.llm_api_key()
    return bool(key) and not key.startswith("your_")


def format_llm_error(exc: BaseException) -> str:
    text = str(exc)
    low = text.lower()
    if "insufficient balance" in low or "402" in text:
        return "DeepSeek 账户余额不足，请到平台充值后再试。"
    if "401" in text or "invalid api key" in low or "authentication" in low:
        return "DeepSeek API Key 无效，请检查 backend/.env 中的 DEEPSEEK_API_KEY。"
    if "429" in text or "rate limit" in low:
        return "请求过于频繁，请稍后再试。"
    return f"调用大模型失败：{text[:240]}"
