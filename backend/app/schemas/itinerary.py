from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class TravelProfile(BaseModel):
    destination: Optional[str] = None
    days: Optional[int] = Field(default=None, ge=1, le=30)
    budget: Optional[float] = Field(default=None, ge=0)
    companions: Optional[str] = None
    pace: Optional[str] = None
    interests: List[str] = Field(default_factory=list)
    constraints: Optional[str] = None


class ItineraryItem(BaseModel):
    time: str = ""
    place: str
    category: str = "sight"
    duration_min: int = 90
    tips: str = ""
    est_cost: float = 0
    transport_between: str = ""
    meal_suggestion: str = ""


class ItineraryDay(BaseModel):
    day_index: int
    date: str = ""
    theme: str = ""
    area: str = ""
    items: List[ItineraryItem] = Field(default_factory=list)


class Itinerary(BaseModel):
    title: str = ""
    days: List[ItineraryDay] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


class BudgetBreakdown(BaseModel):
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
    role: Literal["user", "agent"]
    content: str
    agent: Optional[str] = None


class SupervisorDecision(BaseModel):
    intent: Literal["qa", "plan", "revise"]
    destination: Optional[str] = None
    reason: str = ""
