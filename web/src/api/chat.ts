/** 对接后端会话与 SSE：解析 event/data 块并回调到工作台。 */

import type { ChatMessage, SessionSummary } from "../types/itinerary";
import { parseSse, type StreamHandlers } from "./sse";

export type { StreamHandlers };

const cred: RequestInit = { credentials: "include" };

/**
 * 发起一轮流式对话。
 * @param message 用户输入（string）
 * @param sessionId 已有会话 id，新对话传 null（string | null）
 * @param handlers SSE 回调（StreamHandlers）
 * @param history 游客多轮上下文（ChatMessage[] | undefined）
 * @returns Promise<void>
 * @throws Error HTTP 非 2xx 时
 */
export async function streamChat(
  message: string,
  sessionId: string | null,
  handlers: StreamHandlers,
  history?: ChatMessage[],
): Promise<void> {
  const res = await fetch("/api/chat/stream", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      session_id: sessionId,
      ...(history ? { history } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `请求失败 ${res.status}`);
  }
  await parseSse(res, handlers);
}

/**
 * 拉取侧边栏会话。失败时返回空数组以免打断首屏。
 * @returns Promise<SessionSummary[]>
 */
export async function fetchSessions(): Promise<SessionSummary[]> {
  const res = await fetch("/api/sessions", cred);
  if (!res.ok) return [];
  const j = (await res.json()) as { data?: SessionSummary[] };
  return j.data ?? [];
}

/**
 * 拉取某会话历史。
 * @param sessionId 会话 id（string）
 * @returns Promise<ChatMessage[]>
 */
export async function fetchHistory(sessionId: string): Promise<ChatMessage[]> {
  const q = new URLSearchParams({ session_id: sessionId });
  const res = await fetch(`/api/chat/history?${q.toString()}`, cred);
  if (!res.ok) return [];
  const j = (await res.json()) as { data?: ChatMessage[] };
  return j.data ?? [];
}
