"""P0 工具接口占位，P1/P2 替换实现时保持函数签名。"""

from __future__ import annotations


def search_poi(city: str, tags: list[str] | None = None, limit: int = 8) -> list[dict]:
    return []


def get_weather(city: str, dates: list[str] | None = None) -> dict:
    return {"city": city, "dates": dates or [], "summary": "P0 未接入天气"}


def estimate_cost(city: str, days: int, style: str = "standard") -> dict:
    return {"city": city, "days": days, "style": style, "total": 0}
