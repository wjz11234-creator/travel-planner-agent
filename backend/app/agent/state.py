"""LangGraph 共享状态：各专家只写自己负责的字段，禁止口头约定。"""

from __future__ import annotations

from typing import Any, Optional, TypedDict

from app.schemas.itinerary import TravelProfile


class HistoryItem(TypedDict):
    """送入图的一条历史消息。"""

    role: str
    content: str
    agent: str


class TravelState(TypedDict, total=False):
    """一轮请求的协作黑板；total=False 以便节点按需增量写入。"""

    task: str
    history: list[HistoryItem]
    intent: str
    current_agent: str
    profile: dict[str, Any]
    missing_slots: list[str]
    research_brief: str
    itinerary: Optional[dict[str, Any]]
    budget_breakdown: Optional[dict[str, Any]]
    critique: str
    warnings: list[str]
    retrieved_docs: str
    final_reply: str
    supervisor_reason: str


def empty_profile() -> dict[str, Any]:
    """生成空偏好字典，避免节点里手写漏字段。

    @returns dict[str, Any] TravelProfile 的 dump 结果
    """
    return TravelProfile().model_dump()
