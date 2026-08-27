import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./api/chat", () => ({
  fetchSessions: vi.fn(async () => []),
  fetchHistory: vi.fn(async () => []),
  streamChat: vi.fn(),
}));

import { fetchHistory, fetchSessions, streamChat } from "./api/chat";

const mockedStream = vi.mocked(streamChat);
const mockedSessions = vi.mocked(fetchSessions);
const mockedHistory = vi.mocked(fetchHistory);

describe("App workbench", () => {
  beforeEach(() => {
    localStorage.clear();
    mockedSessions.mockResolvedValue([]);
    mockedHistory.mockResolvedValue([]);
    mockedStream.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("fills composer from the kyoto example", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
    await user.click(screen.getByTestId("example-kyoto"));
    expect(screen.getByTestId("composer-input")).toHaveValue("京都四月穿什么");
  });

  it("streams a Guide reply and updates intent", async () => {
    const user = userEvent.setup();
    mockedHistory.mockResolvedValue([
      { role: "user", content: "京都四月穿什么" },
      { role: "agent", content: "四月建议带薄外套。", agent: "guide" },
    ]);
    mockedStream.mockImplementation(async (_msg, _sid, handlers) => {
      handlers.onAgent?.("supervisor");
      handlers.onIntent?.({ intent: "qa", profile: { destination: "京都" } });
      handlers.onAgent?.("guide");
      handlers.onText?.("四月建议带薄外套。", "guide");
      handlers.onDone?.({
        session_id: "s1",
        intent: "qa",
        agent: "guide",
        profile: { destination: "京都" },
      });
    });

    render(<App />);
    await user.click(await screen.findByTestId("example-kyoto"));
    await user.click(screen.getByTestId("send-button"));

    expect(await screen.findByText("四月建议带薄外套。")).toBeInTheDocument();
    expect(screen.getByTestId("agent-badge-guide")).toHaveTextContent("Guide");
    expect(screen.getByTestId("intent-pill")).toHaveTextContent("qa");
    expect(screen.getByTestId("destination-pill")).toHaveTextContent("京都");
    expect(screen.getByTestId("chat-message-0")).toHaveAttribute("data-role", "user");
  });

  it("clears the thread on new chat", async () => {
    const user = userEvent.setup();
    mockedHistory.mockResolvedValue([
      { role: "user", content: "帮我做东京 5 日" },
      { role: "agent", content: "占位行程", agent: "planner" },
    ]);
    mockedStream.mockImplementation(async (_msg, _sid, handlers) => {
      handlers.onText?.("占位行程", "planner");
      handlers.onDone?.({ session_id: "s2", intent: "plan", agent: "planner" });
    });

    render(<App />);
    await user.click(await screen.findByTestId("example-tokyo-5d"));
    await user.click(screen.getByTestId("send-button"));
    expect(await screen.findByText("占位行程")).toBeInTheDocument();

    await user.click(screen.getByTestId("new-chat"));
    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
    expect(screen.getByTestId("intent-pill")).toHaveTextContent("—");
    expect(localStorage.getItem("travel-planner-session-id")).toBeNull();
  });
});
