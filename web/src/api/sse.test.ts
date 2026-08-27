import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchSseEvent, parseSse, parseSseBlock, splitSseBuffer } from "./sse";
import type { StreamHandlers } from "./sse";

function handlers() {
  const calls: Record<string, unknown[]> = {
    agent: [],
    intent: [],
    text: [],
    done: [],
    error: [],
  };
  const h: StreamHandlers = {
    onAgent: (a) => calls.agent.push(a),
    onIntent: (p) => calls.intent.push(p),
    onText: (d, a) => calls.text.push({ d, a }),
    onDone: (p) => calls.done.push(p),
    onError: (m) => calls.error.push(m),
  };
  return { calls, h };
}

describe("splitSseBuffer", () => {
  it("keeps a half packet in rest", () => {
    const { complete, rest } = splitSseBuffer('event: text\ndata: {"delta":"四');
    expect(complete).toEqual([]);
    expect(rest).toContain("四");
  });

  it("splits complete blocks and leaves the tail", () => {
    const { complete, rest } = splitSseBuffer(
      'event: agent\ndata: {"agent":"guide"}\n\nevent: text\ndata: {"delta":"月"}\n\nevent: done\ndata: {"session',
    );
    expect(complete).toHaveLength(2);
    expect(rest.startsWith("event: done")).toBe(true);
  });
});

describe("parseSseBlock + dispatchSseEvent", () => {
  it("dispatches agent, intent, text, done", () => {
    const { calls, h } = handlers();
    const blocks = [
      'event: agent\ndata: {"agent":"guide"}',
      'event: intent\ndata: {"intent":"qa","profile":{"destination":"京都"}}',
      'event: text\ndata: {"delta":"四月带薄外套","agent":"guide"}',
      'event: done\ndata: {"session_id":"s1","intent":"qa","agent":"guide"}',
    ];
    for (const block of blocks) {
      const { event, data } = parseSseBlock(block);
      dispatchSseEvent(event, data, h);
    }
    expect(calls.agent).toEqual(["guide"]);
    expect(calls.intent).toEqual([
      { intent: "qa", reason: undefined, profile: { destination: "京都" } },
    ]);
    expect(calls.text).toEqual([{ d: "四月带薄外套", a: "guide" }]);
    expect(calls.done).toEqual([
      { session_id: "s1", intent: "qa", agent: "guide", profile: undefined },
    ]);
  });

  it("drops malformed JSON without throwing", () => {
    const { calls, h } = handlers();
    dispatchSseEvent("text", "{not-json", h);
    expect(calls.text).toEqual([]);
  });

  it("forwards error events", () => {
    const { calls, h } = handlers();
    dispatchSseEvent("error", '{"message":"上游超时"}', h);
    expect(calls.error).toEqual(["上游超时"]);
  });
});

describe("parseSse", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reassembles a JSON payload split across two reads", async () => {
    const { calls, h } = handlers();
    const chunks = [
      'event: text\ndata: {"delta":"四',
      '月","agent":"guide"}\n\n',
    ];
    let i = 0;
    const reader = {
      read: async () => {
        if (i >= chunks.length) return { done: true, value: undefined };
        const value = new TextEncoder().encode(chunks[i]);
        i += 1;
        return { done: false, value };
      },
    };
    const res = {
      body: { getReader: () => reader },
    } as unknown as Response;

    await parseSse(res, h);
    expect(calls.text).toEqual([{ d: "四月", a: "guide" }]);
  });
});
