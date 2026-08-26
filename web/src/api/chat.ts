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

export async function fetchSessions(): Promise<SessionSummary[]> {
  const res = await fetch("/api/sessions");
  if (!res.ok) return [];
  const j = (await res.json()) as { data?: SessionSummary[] };
  return j.data ?? [];
}

export async function fetchHistory(sessionId: string): Promise<ChatMessage[]> {
  const q = new URLSearchParams({ session_id: sessionId });
  const res = await fetch(`/api/chat/history?${q.toString()}`);
  if (!res.ok) return [];
  const j = (await res.json()) as { data?: ChatMessage[] };
  return j.data ?? [];
}
