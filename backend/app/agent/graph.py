"""组装 P0 协作图：Supervisor 后按意图走向 Guide 或 Planner 占位。"""

from __future__ import annotations

from app.agent.agents.guide import guide_node
from app.agent.agents.plan_stub import plan_stub_node
from app.agent.state import TravelState
from app.agent.supervisor import supervisor_node


def route_after_supervisor(state: TravelState) -> str:
    """条件边：qa 走知识问答，其余规划类走占位专家。

    @param state: 已含 intent 的状态（TravelState）
    @returns str 下一节点名 guide | plan_stub
    """
    intent = (state.get("intent") or "qa").lower()
    if intent == "qa":
        return "guide"
    return "plan_stub"


def run_once(state: TravelState) -> TravelState:
    """无 LangGraph 时的同步编排，边顺序必须与 compile 后的图一致。

    @param state: 初始 TravelState
    @returns TravelState 终态
    """
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
        """兼容 LangGraph CompiledGraph.invoke 签名。

        @param state: TravelState
        @returns TravelState
        """
        return run_once(state)


try:
    travel_graph = _build_langgraph()
    GRAPH_BACKEND = "langgraph"
except ImportError:
    # Python 3.8 无 langgraph 发行包，用同序函数跑通 P0
    travel_graph = _FallbackGraph()
    GRAPH_BACKEND = "fallback"
