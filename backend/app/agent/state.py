from __future__ import annotations

from typing import Any, Optional, TypedDict

from app.schemas.itinerary import TravelProfile


class HistoryItem(TypedDict):
    role: str
    content: str
    agent: str


class TravelState(TypedDict, total=False):
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
    return TravelProfile().model_dump()
