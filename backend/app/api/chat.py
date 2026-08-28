"""对话 HTTP 层：同步 invoke 与 SSE 流式，把图节点事件推给前端。"""

from __future__ import annotations

import json
from typing import Any, Iterator, Optional

from fastapi import APIRouter, Cookie, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.agent.agents.guide import guide_stream
from app.agent.agents.plan_stub import plan_stub_node
from app.agent.graph import GRAPH_BACKEND, route_after_supervisor, travel_graph
from app.agent.state import empty_profile
from app.agent.supervisor import supervisor_node
from app.api.auth import COOKIE, user_from_cookie
from app.db import session_store
from app.llm import format_llm_error, llm_configured

router = APIRouter()


class HistoryItem(BaseModel):
    """游客多轮上下文中的一条。"""

    role: str
    content: str
    agent: Optional[str] = None


class ChatRequest(BaseModel):
    """聊天请求体。"""

    message: str = Field(min_length=1)
    session_id: Optional[str] = None
    history: Optional[list[HistoryItem]] = None


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


def _guest_history(items: list[HistoryItem] | None) -> list[dict]:
    rows = items or []
    trimmed = rows[-20:]
    return [
        {"role": r.role, "content": r.content, "agent": r.agent or ""}
        for r in trimmed
        if r.role in ("user", "agent")
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
    """探活与编排后端探测，前端/运维用来确认 Key 与 LangGraph 是否就绪。

    @returns dict ok/llm_configured/phase/graph
    """
    return {
        "ok": True,
        "llm_configured": llm_configured(),
        "phase": "P0",
        "graph": GRAPH_BACKEND,
    }


@router.get("/sessions")
def sessions(
    limit: int = Query(40, ge=1, le=100),
    tp_auth: Optional[str] = Cookie(default=None, alias=COOKIE),
):
    """侧边栏会话列表。游客返回空。

    @param limit: 最多条数（int），Query 约束 1–100
    @returns dict data 为 Session 摘要列表
    """
    user = user_from_cookie(tp_auth)
    if not user:
        return {"data": []}
    return {"data": session_store.list_sessions(user["id"], limit=limit)}


@router.get("/chat/history")
def history(
    session_id: str = Query(..., min_length=1),
    tp_auth: Optional[str] = Cookie(default=None, alias=COOKIE),
):
    """回放指定会话，切换侧边栏时调用。

    @param session_id: 会话 id（str）
    @returns dict data 为消息列表
    """
    user = user_from_cookie(tp_auth)
    if not user:
        raise HTTPException(status_code=404, detail="会话不存在")
    owner = session_store.session_owner(session_id)
    if owner != user["id"]:
        raise HTTPException(status_code=404, detail="会话不存在")
    return {"data": session_store.list_history(session_id)}


def _prepare_turn(body: ChatRequest, tp_auth: str | None) -> tuple[str, list[dict], bool]:
    """已登录落库并返回 sid+history；游客用请求体 history、不落库。

    @param body: ChatRequest
    @param tp_auth: Cookie
    @returns tuple sid, history, persist
    """
    user = user_from_cookie(tp_auth)
    if not user:
        return "", _guest_history(body.history), False
    try:
        sid = session_store.ensure_session(body.session_id, user["id"])
    except PermissionError as exc:
        raise HTTPException(status_code=404, detail="会话不存在") from exc
    hist = session_store.list_history(sid)
    session_store.add_message(sid, "user", body.message)
    return sid, _history_for_graph(hist), True


@router.post("/chat")
def chat(body: ChatRequest, tp_auth: Optional[str] = Cookie(default=None, alias=COOKIE)):
    """一次性返回终稿，便于脚本验收。

    @param body: ChatRequest
    @returns dict session_id/intent/agent/reply/profile/reason
    @throws HTTPException 400 未配置 Key；502 模型调用失败
    """
    if not llm_configured():
        raise HTTPException(status_code=400, detail="未配置 LLM API Key，请编辑 backend/.env")
    sid, hist, persist = _prepare_turn(body, tp_auth)
    try:
        state = travel_graph.invoke(_initial_state(body.message, hist))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=format_llm_error(exc)) from exc
    reply = state.get("final_reply") or ""
    agent = state.get("current_agent") or "guide"
    if persist:
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
def chat_stream(body: ChatRequest, tp_auth: Optional[str] = Cookie(default=None, alias=COOKIE)):
    """SSE：先推 agent/intent 再推 text，让 UI 显示谁在干活。

    流式路径不走 graph.stream，是因为 Guide 的 token 需要在节点内部 yield。

    @param body: ChatRequest
    @returns StreamingResponse text/event-stream
    @throws HTTPException 400 未配置 Key；生成器内错误以 event:error 下发
    """
    if not llm_configured():
        raise HTTPException(status_code=400, detail="未配置 LLM API Key，请编辑 backend/.env")

    def gen() -> Iterator[str]:
        sid, hist, persist = _prepare_turn(body, tp_auth)
        state = _initial_state(body.message, hist)

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
        if persist:
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
