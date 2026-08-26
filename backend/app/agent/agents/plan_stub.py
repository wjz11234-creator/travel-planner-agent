"""Planner 占位节点：P0 只确认规划意图，不产出 itinerary JSON。"""

from __future__ import annotations

from langchain_core.messages import HumanMessage

from app.agent.prompts import PLAN_STUB_PROMPT
from app.agent.state import TravelState
from app.llm import get_llm, llm_configured


def plan_stub_node(state: TravelState) -> TravelState:
    """规划/修订类请求的 P0 回复；itinerary 强制为 None 以免前端误渲染。

    @param state: 含 intent/profile 的状态（TravelState）
    @returns TravelState
    @throws 已配置 LLM 时可能抛出厂商 API 异常
    """
    profile = state.get("profile") or {}
    destination = profile.get("destination") or "（尚未识别）"
    intent = state.get("intent") or "plan"
    if intent == "revise":
        text = (
            "目前还没有可修改的行程。P1 会先由专家队生成结构化日程，"
            "P2 再支持「只改第 N 天」。你也可以先问攻略，或告诉我目的地、天数和预算。"
        )
        if destination and destination != "（尚未识别）":
            text = f"已记下目的地「{destination}」。" + text
    elif llm_configured():
        prompt = PLAN_STUB_PROMPT.format(
            destination=destination,
            task=state.get("task") or "",
        )
        msg = get_llm(temperature=0.4).invoke([HumanMessage(content=prompt)])
        text = (getattr(msg, "content", None) or "").strip()
    else:
        text = (
            f"已识别为行程规划（目的地：{destination}）。"
            "完整多日方案将在 P1 由 Preference / Research / Planner / Budget / Critic 接力完成。"
            "现在可以继续问攻略，或补充天数、预算和旅行节奏。"
        )
    return {
        **state,
        "current_agent": "planner",
        "final_reply": text,
        "itinerary": None,
    }


# TODO(zwj 2026-08-26): P1 用 Preference→Research→Planner→Budget→Critic 替换本占位节点
