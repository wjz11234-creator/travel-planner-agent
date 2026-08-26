/** 对接后端会话与 SSE：解析 event/data 块并回调到工作台。 */

import type { ChatMessage, SessionSummary, TravelProfile } from "../types/itinerary";

export type StreamHandlers = {
  onAgent?: (agent: string) => void;
  onIntent?: (payload: {
    intent: string;
    reason?: string;
    profile?: TravelProfile;
  }) => void;
  onText?: (delta: string, agent: string) => void;
  onDone?: (payload: {
    session_id: string;
    intent: string;
    agent: string;
    profile?: TravelProfile;
  }) => void;
  onError?: (message: string) => void;
};

/**
 * 按 SSE 规范切包；不完整的尾块留在 buf，避免 TCP 半包把 JSON 切坏。
 * @param res fetch 响应（Response）
 * @param handlers 事件回调（StreamHandlers）
 * @returns Promise<void>
 * @throws Error 当 body 不可读
 */
async function parseSse(
  res: Response,
  handlers: StreamHandlers,
): Promise<void> {
  if (!res.body) {
    throw new Error("浏览器不支持流式读取");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const block of parts) {
      const lines = block.split("\n");
      let event = "message";
      let data = "";
      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(data) as Record<string, unknown>;
      } catch {
        continue;
      }
      if (event === "agent") handlers.onAgent?.(String(payload.agent ?? ""));
      if (event === "intent") {
        handlers.onIntent?.({
          intent: String(payload.intent ?? ""),
          reason: payload.reason as string | undefined,
          profile: payload.profile as TravelProfile | undefined,
        });
      }
      if (event === "text") {
        handlers.onText?.(
          String(payload.delta ?? ""),
          String(payload.agent ?? ""),
        );
      }
      if (event === "error") {
        handlers.onError?.(String(payload.message ?? "请求失败"));
      }
      if (event === "done") {
        handlers.onDone?.({
          session_id: String(payload.session_id ?? ""),
          intent: String(payload.intent ?? ""),
          agent: String(payload.agent ?? ""),
          profile: payload.profile as TravelProfile | undefined,
        });
      }
    }
  }
}

/**
 * 发起一轮流式对话。
 * @param message 用户输入（string）
 * @param sessionId 已有会话 id，新对话传 null（string | null）
 * @param handlers SSE 回调（StreamHandlers）
 * @returns Promise<void>
 * @throws Error HTTP 非 2xx 时
 */
export async function streamChat(
  message: string,
  sessionId: string | null,
  handlers: StreamHandlers,
): Promise<void> {
  const res = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session_id: sessionId }),
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
  const res = await fetch("/api/sessions");
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
  const res = await fetch(`/api/chat/history?${q.toString()}`);
  if (!res.ok) return [];
  const j = (await res.json()) as { data?: ChatMessage[] };
  return j.data ?? [];
}
