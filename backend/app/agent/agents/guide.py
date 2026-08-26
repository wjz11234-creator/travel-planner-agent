from __future__ import annotations

from langchain_core.messages import HumanMessage

from app.agent.prompts import GUIDE_PROMPT
from app.agent.state import TravelState
from app.llm import get_llm
from app.rag.retriever import format_context, retrieve_guides


def _history_text(history: list | None) -> str:
    rows = history or []
    if not rows:
        return "（无）"
    return "\n".join(
        f"{'用户' if x.get('role') == 'user' else '助手'}：{x.get('content', '')}"
        for x in rows[-8:]
    )


def _guide_prompt(state: TravelState, context: str) -> str:
    return GUIDE_PROMPT.format(
        context=context,
        history=_history_text(state.get("history")),
        task=state.get("task") or "",
    )


def guide_node(state: TravelState) -> TravelState:
    chunks = retrieve_guides(state.get("task") or "")
    context = format_context(chunks)
    msg = get_llm(temperature=0.3).invoke(
        [HumanMessage(content=_guide_prompt(state, context))]
    )
    text = (getattr(msg, "content", None) or "").strip()
    return {
        **state,
        "current_agent": "guide",
        "retrieved_docs": context,
        "final_reply": text,
    }


def guide_stream(state: TravelState):
    chunks = retrieve_guides(state.get("task") or "")
    context = format_context(chunks)
    prompt = _guide_prompt(state, context)
    acc = []
    for piece in get_llm(temperature=0.3, streaming=True).stream(
        [HumanMessage(content=prompt)]
    ):
        delta = getattr(piece, "content", None) or ""
        if delta:
            acc.append(delta)
            yield delta
    yield {
        "current_agent": "guide",
        "retrieved_docs": context,
        "final_reply": "".join(acc).strip(),
    }
