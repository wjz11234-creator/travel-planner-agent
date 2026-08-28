import { expect, test, type Page } from "@playwright/test";

function sse(...events: Array<{ event: string; data: Record<string, unknown> }>) {
  return events
    .map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`)
    .join("");
}

async function mockApi(
  page: Page,
  streamBody: string,
  history: Array<{ role: string; content: string; agent?: string }> = [],
  user: { id: string; email: string; nickname: string } | null = null,
) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user }),
    });
  });
  await page.route("**/api/auth/logout", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route("**/api/sessions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    });
  });
  await page.route("**/api/chat/history**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: history }),
    });
  });
  await page.route("**/api/chat/stream", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
      },
      body: streamBody,
    });
  });
}

async function enterGuest(page: Page) {
  await page.goto("/login");
  await page.getByTestId("skip-login").click();
  await expect(page.getByTestId("workbench")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await mockApi(page, "");
});

test("logged-out users land on login", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("login-view")).toBeVisible();
});

test("skip login opens a guest workbench", async ({ page }) => {
  await enterGuest(page);
  await expect(page.getByTestId("guest-badge")).toHaveText("游客");
  await expect(page.getByTestId("guest-banner")).toBeVisible();
});

test("empty state shows three P0 examples", async ({ page }) => {
  await enterGuest(page);
  await expect(page.getByTestId("empty-state")).toBeVisible();
  await expect(page.getByTestId("example-kyoto")).toBeVisible();
  await expect(page.getByTestId("example-tokyo-tower")).toBeVisible();
  await expect(page.getByTestId("example-tokyo-5d")).toBeVisible();
});

test("kyoto example streams a Guide bubble", async ({ page }) => {
  await mockApi(
    page,
    sse(
      { event: "agent", data: { agent: "supervisor" } },
      {
        event: "intent",
        data: { intent: "qa", profile: { destination: "京都" } },
      },
      { event: "agent", data: { agent: "guide" } },
      {
        event: "text",
        data: { delta: "四月建议带薄外套。", agent: "guide" },
      },
      {
        event: "done",
        data: {
          session_id: "s-kyoto",
          intent: "qa",
          agent: "guide",
          profile: { destination: "京都" },
        },
      },
    ),
    [
      { role: "user", content: "京都四月穿什么" },
      { role: "agent", content: "四月建议带薄外套。", agent: "guide" },
    ],
  );
  await enterGuest(page);
  await page.getByTestId("example-kyoto").click();
  await expect(page.getByTestId("composer-input")).toHaveValue("京都四月穿什么");
  await page.getByTestId("send-button").click();
  await expect(page.getByTestId("agent-badge-guide")).toHaveText("Guide");
  await expect(page.getByTestId("chat-bubble").last()).toHaveText("四月建议带薄外套。");
  await expect(page.getByTestId("intent-pill")).toContainText("qa");
  await expect(page.getByTestId("destination-pill")).toContainText("京都");
});

test("tokyo 5-day example shows Planner placeholder", async ({ page }) => {
  await mockApi(
    page,
    sse(
      { event: "agent", data: { agent: "supervisor" } },
      {
        event: "intent",
        data: { intent: "plan", profile: { destination: "东京", days: 5 } },
      },
      { event: "agent", data: { agent: "planner" } },
      {
        event: "text",
        data: { delta: "完整流水线将在 P1 上线。", agent: "planner" },
      },
      {
        event: "done",
        data: {
          session_id: "s-plan",
          intent: "plan",
          agent: "planner",
          profile: { destination: "东京", days: 5 },
        },
      },
    ),
    [
      { role: "user", content: "帮我做东京 5 日" },
      { role: "agent", content: "完整流水线将在 P1 上线。", agent: "planner" },
    ],
  );
  await enterGuest(page);
  await page.getByTestId("example-tokyo-5d").click();
  await page.getByTestId("send-button").click();
  await expect(page.getByTestId("agent-badge-planner")).toHaveText("Planner");
  await expect(page.getByTestId("chat-bubble").last()).toContainText("P1");
  await expect(page.getByTestId("intent-pill")).toContainText("plan");
});

test("new chat clears the thread", async ({ page }) => {
  await mockApi(
    page,
    sse(
      { event: "agent", data: { agent: "guide" } },
      { event: "text", data: { delta: "先回一条。", agent: "guide" } },
      {
        event: "done",
        data: { session_id: "s-clear", intent: "qa", agent: "guide" },
      },
    ),
    [
      { role: "user", content: "东京塔几点关门" },
      { role: "agent", content: "先回一条。", agent: "guide" },
    ],
  );
  await enterGuest(page);
  await page.getByTestId("example-tokyo-tower").click();
  await page.getByTestId("send-button").click();
  await expect(page.getByTestId("agent-badge-guide")).toBeVisible();
  await page.getByTestId("new-chat").click();
  await expect(page.getByTestId("empty-state")).toBeVisible();
  await expect(page.getByTestId("intent-pill")).toContainText("—");
});

test("logout returns to the login page", async ({ page }) => {
  await mockApi(page, "", [], {
    id: "u1",
    email: "xiaoming@traveler.com",
    nickname: "小明",
  });
  await page.goto("/");
  await expect(page.getByTestId("workbench")).toBeVisible();
  await expect(page.getByTestId("user-nickname")).toHaveText("小明");
  await page.getByTestId("settings-trigger").click();
  await page.getByTestId("logout-button").click();
  await expect(page.getByTestId("login-view")).toBeVisible();
});
