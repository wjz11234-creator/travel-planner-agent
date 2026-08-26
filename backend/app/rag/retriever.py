"""本地攻略关键词检索：按 ## 切块，城市名加权，避免 P0 依赖向量模型下载。"""

from __future__ import annotations

import re
from pathlib import Path

from app.config import settings

_CITY_ALIASES = {
    "tokyo": "东京",
    "kyoto": "京都",
    "chengdu": "成都",
    "tokyo.md": "东京",
    "kyoto.md": "京都",
    "chengdu.md": "成都",
}


def _split_chunks(path: Path) -> list[dict[str, str]]:
    text = path.read_text(encoding="utf-8")
    city = _CITY_ALIASES.get(path.stem.lower(), path.stem)
    parts = re.split(r"\n(?=## )", text)
    chunks: list[dict[str, str]] = []
    for part in parts:
        body = part.strip()
        # 过短块通常只是标题，送进 Prompt 会稀释有效攻略
        if len(body) < 20:
            continue
        title = body.split("\n", 1)[0].lstrip("# ").strip()
        chunks.append(
            {
                "source": path.name,
                "city": city,
                "title": title,
                "text": body,
            }
        )
    return chunks


def load_chunks() -> list[dict[str, str]]:
    """加载 knowledge 目录下全部 Markdown 块。

    @returns list[dict[str, str]] 含 source/city/title/text
    """
    folder = settings.knowledge_dir
    if not folder.is_dir():
        return []
    chunks: list[dict[str, str]] = []
    for path in sorted(folder.glob("*.md")):
        chunks.extend(_split_chunks(path))
    return chunks


def _tokens(query: str) -> list[str]:
    q = (query or "").strip()
    tokens = set()
    for city in ("东京", "京都", "大阪", "成都", "清迈"):
        if city in q:
            tokens.add(city)
    for word in re.findall(r"[A-Za-z0-9]+|[\u4e00-\u9fff]{2,}", q):
        tokens.add(word)
    if len(q) >= 2:
        tokens.add(q[:8])
    return [t for t in tokens if t]


def retrieve_guides(query: str, *, top_k: int = 4) -> list[dict[str, str]]:
    """按词频+城市加权取 TopK 攻略块。

    @param query: 用户问句（str）
    @param top_k: 返回块数（int）
    @returns list[dict[str, str]] 按相关度降序
    """
    chunks = load_chunks()
    toks = _tokens(query)
    scored: list[tuple[int, dict[str, str]]] = []
    for ch in chunks:
        blob = ch["city"] + ch["title"] + ch["text"]
        score = 0
        for t in toks:
            if t in blob:
                # 城市名额外加权，避免「四月穿什么」命中错误城市的同主题段落
                score += blob.count(t) + (4 if t == ch["city"] else 0)
        if score > 0:
            scored.append((score, ch))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [c for _, c in scored[:top_k]]


def format_context(chunks: list[dict[str, str]]) -> str:
    """把检索块拼成 Guide Prompt 可用的上下文。

    @param chunks: retrieve_guides 的返回值（list[dict]）
    @returns str 空结果时给出明确占位，促使模型拒绝编造
    """
    if not chunks:
        return "（未检索到相关攻略）"
    blocks = []
    for i, ch in enumerate(chunks, 1):
        blocks.append(f"[{i}] {ch['city']} / {ch['title']}\n{ch['text']}")
    return "\n\n".join(blocks)
