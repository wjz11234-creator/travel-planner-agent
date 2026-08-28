import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./api/chat", () => ({
  fetchSessions: vi.fn(async () => []),
  fetchHistory: vi.fn(async () => []),
  streamChat: vi.fn(),
}));

vi.mock("./api/auth", () => ({
  fetchMe: vi.fn(async () => null),
  logoutUser: vi.fn(async () => undefined),
  loginUser: vi.fn(),
  registerUser: vi.fn(),
  forgotPassword: vi.fn(),
}));

import { fetchMe, loginUser, logoutUser, registerUser } from "./api/auth";
import { fetchHistory, fetchSessions, streamChat } from "./api/chat";

const mockedStream = vi.mocked(streamChat);
const mockedSessions = vi.mocked(fetchSessions);
const mockedHistory = vi.mocked(fetchHistory);
const mockedMe = vi.mocked(fetchMe);
const mockedLogin = vi.mocked(loginUser);
const mockedRegister = vi.mocked(registerUser);
const mockedLogout = vi.mocked(logoutUser);

const demoUser = { id: "u1", email: "xiaoming@traveler.com", nickname: "小明" };

async function asGuest() {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByTestId("skip-login"));
  expect(await screen.findByTestId("workbench")).toBeInTheDocument();
  return user;
}

describe("App auth + workbench", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    localStorage.clear();
    mockedMe.mockResolvedValue(null);
    mockedSessions.mockResolvedValue([]);
    mockedHistory.mockResolvedValue([]);
    mockedStream.mockReset();
    mockedLogin.mockReset();
    mockedRegister.mockReset();
    mockedLogout.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("opens the login page when logged out", async () => {
    render(<App />);
    expect(await screen.findByTestId("login-view")).toBeInTheDocument();
    expect(screen.queryByTestId("workbench")).not.toBeInTheDocument();
  });

  it("goes to register and forgot as their own pages", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("link", { name: "注册账号" }));
    expect(await screen.findByTestId("register-view")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "去登录" }));
    expect(await screen.findByTestId("login-view")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "忘记密码？" }));
    expect(await screen.findByTestId("forgot-view")).toBeInTheDocument();
  });

  it("skips login into a guest workbench", async () => {
    await asGuest();
    expect(screen.getByTestId("guest-badge")).toHaveTextContent("游客");
    expect(screen.getByTestId("guest-banner")).toBeInTheDocument();
  });

  it("logs in and shows the nickname", async () => {
    mockedLogin.mockResolvedValue(demoUser);
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByTestId("auth-email"), demoUser.email);
    await user.type(screen.getByTestId("auth-password"), "password12");
    await user.click(screen.getByTestId("login-button"));
    expect(await screen.findByTestId("workbench")).toBeInTheDocument();
    expect(screen.getByTestId("user-nickname")).toHaveTextContent("小明");
  });

  it("registers then lands on the workbench", async () => {
    mockedRegister.mockResolvedValue(demoUser);
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("link", { name: "注册账号" }));
    await user.type(await screen.findByTestId("auth-nickname"), "小明");
    await user.type(screen.getByTestId("auth-email"), demoUser.email);
    await user.type(screen.getByTestId("auth-password"), "password12");
    await user.type(screen.getByTestId("auth-password-confirm"), "password12");
    await user.click(screen.getByTestId("register-button"));
    expect(await screen.findByTestId("workbench")).toBeInTheDocument();
  });

  it("logs out back to the login page", async () => {
    mockedMe.mockResolvedValue(demoUser);
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByTestId("settings-trigger"));
    await user.click(screen.getByTestId("logout-button"));
    expect(await screen.findByTestId("login-view")).toBeInTheDocument();
    expect(mockedLogout).toHaveBeenCalled();
  });

  it("fills composer from the kyoto example", async () => {
    const user = await asGuest();
    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
    await user.click(screen.getByTestId("example-kyoto"));
    expect(screen.getByTestId("composer-input")).toHaveValue("京都四月穿什么");
  });

  it("streams a Guide reply and updates intent", async () => {
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

    const user = await asGuest();
    await user.click(await screen.findByTestId("example-kyoto"));
    await user.click(screen.getByTestId("send-button"));

    expect(await screen.findByText("四月建议带薄外套。")).toBeInTheDocument();
    expect(screen.getByTestId("agent-badge-guide")).toHaveTextContent("Guide");
    expect(screen.getByTestId("intent-pill")).toHaveTextContent("qa");
    expect(screen.getByTestId("destination-pill")).toHaveTextContent("京都");
    expect(screen.getByTestId("chat-message-0")).toHaveAttribute("data-role", "user");
  });

  it("clears the thread on new chat", async () => {
    mockedStream.mockImplementation(async (_msg, _sid, handlers) => {
      handlers.onText?.("占位行程", "planner");
      handlers.onDone?.({ session_id: "s2", intent: "plan", agent: "planner" });
    });

    const user = await asGuest();
    await user.click(await screen.findByTestId("example-tokyo-5d"));
    await user.click(screen.getByTestId("send-button"));
    expect(await screen.findByText("占位行程")).toBeInTheDocument();

    await user.click(screen.getByTestId("new-chat"));
    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
    expect(screen.getByTestId("intent-pill")).toHaveTextContent("—");
    expect(localStorage.getItem("travel-planner-session-id")).toBeNull();
  });
});
