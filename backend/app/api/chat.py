from __future__ import annotations

import json
from typing import Any, Iterator, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.agent.agents.guide import guide_stream
from app.agent.agents.plan_stub import plan_stub_node
from app.agent.graph import GRAPH_BACKEND, route_after_supervisor, travel_graph
from app.agent.state import empty_profile
from app.agent.supervisor import supervisor_node
from app.db import session_store
from app.llm import format_llm_error, llm_configured

router = APIRouter()


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    session_id: Optional[str] = None


def _sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _history_for_graph(rows: list[dict]) -> list[dict]:
    return [
        {
            "role": r["role"],
            "content": r["content"],
            "agent": r.get("agent") or "",
        }
        for r in rows
    ]


def _initial_state(message: str, history: list[dict]) -> dict:
    return {
        "task": message,
        "history": history,
        "intent": "",
        "current_agent": "supervisor",
        "profile": empty_profile(),
        "missing_slots": [],
        "research_brief": "",
        "itinerary": None,
        "budget_breakdown": None,
        "critique": "",
        "warnings": [],
        "retrieved_docs": "",
        "final_reply": "",
        "supervisor_reason": "",
    }


@router.get("/health")
def health():
    return {
        "ok": True,
        "llm_configured": llm_configured(),
        "phase": "P0",
        "graph": GRAPH_BACKEND,
    }


@router.get("/sessions")
def sessions(limit: int = Query(40, ge=1, le=100)):
    return {"data": session_store.list_sessions(limit=limit)}


@router.get("/chat/history")
def history(session_id: str = Query(..., min_length=1)):
    return {"data": session_store.list_history(session_id)}


@router.post("/chat")
def chat(body: ChatRequest):
    if not llm_configured():
        raise HTTPException(status_code=400, detail="未配置 LLM API Key，请编辑 backend/.env")
    sid = session_store.ensure_session(body.session_id)
    hist = session_store.list_history(sid)
    session_store.add_message(sid, "user", body.message)
    try:
        state = travel_graph.invoke(_initial_state(body.message, _history_for_graph(hist)))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=format_llm_error(exc)) from exc
    reply = state.get("final_reply") or ""
    agent = state.get("current_agent") or "guide"
    session_store.add_message(sid, "agent", reply, agent=agent)
    return {
        "session_id": sid,
        "intent": state.get("intent"),
        "agent": agent,
        "reply": reply,
        "profile": state.get("profile"),
        "reason": state.get("supervisor_reason"),
    }


@router.post("/chat/stream")
def chat_stream(body: ChatRequest):
    if not llm_configured():
        raise HTTPException(status_code=400, detail="未配置 LLM API Key，请编辑 backend/.env")

    def gen() -> Iterator[str]:
        sid = session_store.ensure_session(body.session_id)
        hist = session_store.list_history(sid)
        session_store.add_message(sid, "user", body.message)
        state = _initial_state(body.message, _history_for_graph(hist))

        yield _sse("agent", {"agent": "supervisor", "session_id": sid})
        state = supervisor_node(state)
        yield _sse(
            "intent",
            {
                "intent": state.get("intent"),
                "reason": state.get("supervisor_reason"),
                "profile": state.get("profile"),
                "agent": "supervisor",
            },
        )

        nxt = route_after_supervisor(state)
        if nxt == "guide":
            yield _sse("agent", {"agent": "guide"})
            final_state = None
            try:
                for item in guide_stream(state):
                    if isinstance(item, dict):
                        final_state = item
                    else:
                        yield _sse("text", {"delta": item, "agent": "guide"})
            except Exception as exc:
                yield _sse("error", {"message": format_llm_error(exc)})
                return
            state = {**state, **(final_state or {})}
        else:
            yield _sse("agent", {"agent": "planner"})
            try:
                state = plan_stub_node(state)
            except Exception as exc:
                yield _sse("error", {"message": format_llm_error(exc)})
                return
            reply = state.get("final_reply") or ""
            yield _sse("text", {"delta": reply, "agent": "planner"})

        reply = state.get("final_reply") or ""
        agent = state.get("current_agent") or nxt
        session_store.add_message(sid, "agent", reply, agent=agent)
        yield _sse(
            "done",
            {
                "session_id": sid,
                "intent": state.get("intent"),
                "agent": agent,
                "profile": state.get("profile"),
            },
        )

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
