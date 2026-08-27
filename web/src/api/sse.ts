/** 按 SSE 规范切包并分发给工作台；半包留在 buffer。 */

import type { TravelProfile } from "../types/itinerary";

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
 * 用 \\n\\n 切开完整 SSE 块；最后一段视为半包。
 * @param buf 累计未切完的文本（string）
 * @returns complete 已完整块，rest 待拼接下一段
 */
export function splitSseBuffer(buf: string): { complete: string[]; rest: string } {
  const parts = buf.split("\n\n");
  const rest = parts.pop() ?? "";
  return { complete: parts, rest };
}

/**
 * 从一块 SSE 文本取出 event 名与 data 行。
 * @param block 不含尾部分隔符的一块（string）
 * @returns event 与拼接后的 data
 */
export function parseSseBlock(block: string): { event: string; data: string } {
  const lines = block.split("\n");
  let event = "message";
  let data = "";
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  return { event, data };
}

/**
 * 把一条已解析事件交给 handlers；坏 JSON 直接丢弃。
 * @param event SSE event 名（string）
 * @param data JSON 字符串（string）
 * @param handlers 工作台回调（StreamHandlers）
 */
export function dispatchSseEvent(
  event: string,
  data: string,
  handlers: StreamHandlers,
): void {
  if (!data) return;
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(data) as Record<string, unknown>;
  } catch {
    return;
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

/**
 * 读 Response.body，按块解析 SSE。
 * @param res fetch 响应（Response）
 * @param handlers 事件回调（StreamHandlers）
 * @returns Promise<void>
 * @throws Error 当 body 不可读
 */
export async function parseSse(
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
    const { complete, rest } = splitSseBuffer(buf);
    buf = rest;
    for (const block of complete) {
      const { event, data } = parseSseBlock(block);
      dispatchSseEvent(event, data, handlers);
    }
  }
}
