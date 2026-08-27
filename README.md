# Travel Planner Agent

多 Agent 协作的旅行攻略查询与方案设计。独立仓库，不依赖 `zj-agent-service-toolkit`。

当前进度：**P0 已实现**（Supervisor 路由 + GuideAgent 问答 + 规划占位）。

方案全文见 [docs/DESIGN.md](docs/DESIGN.md)。P0 实现说明见 [docs/P0.md](docs/P0.md)。

## 技术栈

- 后端：Python 3.10+ 推荐（系统若仅有 3.8，已将 LangChain 钉在 0.2 以兼容）、FastAPI、LangGraph、Pydantic
- 前端：Vite、React、TypeScript
- LLM：OpenAI 兼容接口（默认 DeepSeek）

## 本地启动

准备两个终端。

推荐 **Python 3.10+**。本仓库后端 venv 使用 **3.12**（可用 `uv python install 3.12` 安装）。

**1. 后端**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
cp .env.example .env   # 填入 DEEPSEEK_API_KEY
uvicorn app.main:app --reload --port 8000
```

**2. 前端**

```bash
cd web
npm install
npm run dev
```

浏览器打开 http://127.0.0.1:5173 。开发时 Vite 会把 `/api` 代理到 `8000`。

前端 Agent 走**通用**个人 Skills（`frontend-ai-native` / `frontend-slice` / `frontend-test` / `ui-verify`）。本仓库只覆盖产品差异，见 [AGENTS.md](AGENTS.md)。

## 前端测试

在 `web/` 下：

```bash
npm test           # Vitest 单测（mock SSE，不打真实 LLM）
npm run test:e2e   # Playwright e2e（拦截 /api，会起或复用 :5173）
```

首次 e2e：本仓库钉了 Playwright 1.49（兼容 macOS 12）。配置使用本机 Google Chrome（`channel: "chrome"`）。更高系统可再执行 `npx playwright install chromium` 并去掉 channel。

## P0 怎么验收

- 「京都四月穿什么」→ Supervisor 判 `qa` → Guide 引用本地攻略
- 「东京塔几点关门」→ Guide 只依据知识库，没有的信息会说不知道，不编造
- 「帮我做东京 5 日」→ Supervisor 判 `plan` → Planner 占位回复（完整流水线在 P1）
- 聊天气泡上能看到当前 Agent 名称切换
