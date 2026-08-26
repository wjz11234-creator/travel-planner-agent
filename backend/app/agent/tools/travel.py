"""旅行工具注册表：P0 只冻结函数签名，P2 用真实 HTTP 替换实现。"""

from __future__ import annotations


def search_poi(city: str, tags: list[str] | None = None, limit: int = 8) -> list[dict]:
    """按城市与标签检索 POI。

    @param city: 城市名（str）
    @param tags: 兴趣标签（list[str] | None）
    @param limit: 返回条数上限（int）
    @returns list[dict] P0 固定空列表
    """
    return []


def get_weather(city: str, dates: list[str] | None = None) -> dict:
    """查询日期范围内天气摘要。

    @param city: 城市名（str）
    @param dates: ISO 日期列表（list[str] | None）
    @returns dict 含 city/dates/summary
    """
    return {"city": city, "dates": dates or [], "summary": "P0 未接入天气"}


def estimate_cost(city: str, days: int, style: str = "standard") -> dict:
    """按城市档位粗估总花费。

    @param city: 城市名（str）
    @param days: 行程天数（int）
    @param style: 消费档位（str）
    @returns dict 含 total，P0 为 0
    """
    return {"city": city, "days": days, "style": style, "total": 0}


# TODO(zwj 2026-08-26): P2 接入 Open-Meteo 与 POI API，保持上述签名不变
