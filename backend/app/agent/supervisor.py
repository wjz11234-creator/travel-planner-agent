from __future__ import annotations

import json
import re

from langchain_core.messages import HumanMessage

from app.agent.prompts import SUPERVISOR_PROMPT
from app.agent.state import TravelState, empty_profile
from app.llm import get_llm, llm_configured
from app.schemas.itinerary import SupervisorDecision, TravelProfile

PLAN_HINTS = (
    "规划",
    "行程",
    "几日",
    "几天",
    "方案",
    "安排",
    "怎么玩",
    "帮我做",
    "设计一下",
    "日程",
)
REVISE_HINTS = ("改成", "改第", "不要", "换成", "删掉", "替换")
CITY_HINTS = ("东京", "京都", "大阪", "成都", "清迈", "杭州", "上海", "北京", "奈良")


def _history_text(history: list | None, limit: int = 8) -> str:
    rows = history or []
    if not rows:
        return "（无）"
    parts = []
    for item in rows[-limit:]:
        role = "用户" if item.get("role") == "user" else "助手"
        parts.append(f"{role}：{item.get('content', '')}")
    return "\n".join(parts)


def rule_intent(task: str) -> str:
    t = task or ""
    if any(k in t for k in REVISE_HINTS) and any(k in t for k in ("第", "天", "改")):
        return "revise"
    if any(k in t for k in PLAN_HINTS):
        return "plan"
    return "qa"


def extract_city(task: str) -> str | None:
    for city in CITY_HINTS:
        if city in (task or ""):
            return city
    return None


def _parse_decision(text: str) -> SupervisorDecision | None:
    raw = (text or "").strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?", "", raw)
        raw = re.sub(r"```$", "", raw).strip()
    try:
        data = json.loads(raw)
        return SupervisorDecision.model_validate(data)
    except Exception:
        m = re.search(r"\{[\s\S]*\}", raw)
        if not m:
            return None
        try:
            return SupervisorDecision.model_validate_json(m.group(0))
        except Exception:
            return None


def supervisor_node(state: TravelState) -> TravelState:
    task = state.get("task") or ""
    hinted = rule_intent(task)
    city = extract_city(task)
    decision = SupervisorDecision(intent=hinted, destination=city, reason="规则初判")

    if llm_configured():
        prompt = SUPERVISOR_PROMPT.format(
            history=_history_text(state.get("history")),
            task=task,
        )
        try:
            msg = get_llm(temperature=0).invoke([HumanMessage(content=prompt)])
            parsed = _parse_decision(getattr(msg, "content", "") or "")
            if parsed:
                decision = parsed
                if not decision.destination:
                    decision.destination = city
        except Exception:
            pass

    profile = TravelProfile.model_validate(state.get("profile") or empty_profile())
    if decision.destination:
        profile.destination = decision.destination

    return {
        **state,
        "intent": decision.intent,
        "current_agent": "supervisor",
        "profile": profile.model_dump(),
        "supervisor_reason": decision.reason,
        "missing_slots": [],
        "warnings": list(state.get("warnings") or []),
    }
