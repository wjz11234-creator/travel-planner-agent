from __future__ import annotations

from app.agent.agents.guide import guide_node
from app.agent.agents.plan_stub import plan_stub_node
from app.agent.state import TravelState
from app.agent.supervisor import supervisor_node


def route_after_supervisor(state: TravelState) -> str:
    intent = (state.get("intent") or "qa").lower()
    if intent == "qa":
        return "guide"
    return "plan_stub"


def run_once(state: TravelState) -> TravelState:
    """与 LangGraph 边顺序一致，便于在无 langgraph 时跑通 P0。"""
    state = supervisor_node(state)
    nxt = route_after_supervisor(state)
    if nxt == "guide":
        return guide_node(state)
    return plan_stub_node(state)


def _build_langgraph():
    from langgraph.graph import END, StateGraph

    workflow = StateGraph(TravelState)
    workflow.add_node("supervisor", supervisor_node)
    workflow.add_node("guide", guide_node)
    workflow.add_node("plan_stub", plan_stub_node)
    workflow.set_entry_point("supervisor")
    workflow.add_conditional_edges(
        "supervisor",
        route_after_supervisor,
        {
            "guide": "guide",
            "plan_stub": "plan_stub",
        },
    )
    workflow.add_edge("guide", END)
    workflow.add_edge("plan_stub", END)
    return workflow.compile()


class _FallbackGraph:
    def invoke(self, state: TravelState) -> TravelState:
        return run_once(state)


try:
    travel_graph = _build_langgraph()
    GRAPH_BACKEND = "langgraph"
except ImportError:
    travel_graph = _FallbackGraph()
    GRAPH_BACKEND = "fallback"
