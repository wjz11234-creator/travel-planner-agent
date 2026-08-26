"""封装 ChatOpenAI 工厂与错误文案；DeepSeek 走 OpenAI 兼容协议。"""

from __future__ import annotations

from langchain_openai import ChatOpenAI

from app.config import settings


def get_llm(*, temperature: float = 0.2, streaming: bool = False) -> ChatOpenAI:
    """构造当前配置下的聊天模型。

    @param temperature: 采样温度（float）
    @param streaming: 是否开启 token 流（bool），SSE 路径需要 True
    @returns ChatOpenAI
    @throws RuntimeError: .env 未填真实 API Key
    """
    key = settings.llm_api_key()
    # 模板值 your_ 表示用户只复制了 example、尚未换成真实密钥
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
    """判断是否已配置可用 API Key，供接口在调模型前短路。

    @returns bool
    """
    key = settings.llm_api_key()
    return bool(key) and not key.startswith("your_")


def format_llm_error(exc: BaseException) -> str:
    """把厂商错误转成可展示文案，避免把原始 JSON 打到前端。

    @param exc: 捕获到的异常（BaseException）
    @returns str 面向用户的短句
    """
    text = str(exc)
    low = text.lower()
    # DeepSeek 余额不足返回 402 + Insufficient Balance，不是标准的 401
    if "insufficient balance" in low or "402" in text:
        return "DeepSeek 账户余额不足，请到平台充值后再试。"
    if "401" in text or "invalid api key" in low or "authentication" in low:
        return "DeepSeek API Key 无效，请检查 backend/.env 中的 DEEPSEEK_API_KEY。"
    if "429" in text or "rate limit" in low:
        return "请求过于频繁，请稍后再试。"
    return f"调用大模型失败：{text[:240]}"
