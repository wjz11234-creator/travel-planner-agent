"""Pydantic 协议：旅行偏好、行程 JSON、Supervisor 路由结果，前后端共用形状。"""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class TravelProfile(BaseModel):
    """用户旅行槽位；缺字段表示尚未收集，P1 Preference 会追问。"""

    destination: Optional[str] = None
    days: Optional[int] = Field(default=None, ge=1, le=30)
    budget: Optional[float] = Field(default=None, ge=0)
    companions: Optional[str] = None
    pace: Optional[str] = None
    interests: List[str] = Field(default_factory=list)
    constraints: Optional[str] = None


class ItineraryItem(BaseModel):
    """一天内的单个停留点，供行程卡片渲染。"""

    time: str = ""
    place: str
    category: str = "sight"
    duration_min: int = 90
    tips: str = ""
    est_cost: float = 0
    transport_between: str = ""
    meal_suggestion: str = ""


class ItineraryDay(BaseModel):
    """单日行程容器。"""

    day_index: int
    date: str = ""
    theme: str = ""
    area: str = ""
    items: List[ItineraryItem] = Field(default_factory=list)


class Itinerary(BaseModel):
    """完整多日方案；前端只渲染该结构，不解析散文。"""

    title: str = ""
    days: List[ItineraryDay] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


class BudgetBreakdown(BaseModel):
    """预算拆分；over_budget 用于卡片标红。"""

    currency: str = "CNY"
    total: float = 0
    lodging: float = 0
    food: float = 0
    transport: float = 0
    tickets: float = 0
    other: float = 0
    over_budget: bool = False
    note: str = ""


class ChatMessage(BaseModel):
    """落库/回放的一条对话。"""

    role: Literal["user", "agent"]
    content: str
    agent: Optional[str] = None


class SupervisorDecision(BaseModel):
    """Supervisor 结构化输出，避免自由文本路由。"""

    intent: Literal["qa", "plan", "revise"]
    destination: Optional[str] = None
    reason: str = ""
