# 第 6 关：真实接口

本轮打了本机 FastAPI `:8000` + Vite `:5173`，走了 LLM（DeepSeek）。Playwright MCP 缺 Chromium，改用 Cursor 内置浏览器点选。

## 第一轮

后端因 venv 未装 `itsdangerous` 起不来。已用 uv 装入现有 venv（`requirements.txt` 里已有该依赖），随后启动成功。

## 鉴权 API（curl Cookie）

| 步骤 | 结果 |
|---|---|
| `GET /api/auth/me` 匿名 | `{ user: null }` |
| `POST /api/auth/register` | 返回 user 并种 Cookie |
| `GET /api/auth/me` | 与注册用户一致 |
| `POST /api/auth/logout` 后再 `me` | `{ user: null }` |
| `POST /api/auth/login` | 成功 |
| `POST /api/auth/forgot` | 占位文案，未发短信/邮件 |
| 匿名 `GET /api/sessions` | `{ data: [] }` |

## 对话 SSE（真实 LLM）

| 用例 | 结果 |
|---|---|
| 京都四月穿什么 | `intent=qa`，Guide 作答（薄外套/围巾等），未出按天卡片 |
| 帮我做东京 5 日 | `intent=plan`，Planner 占位，提到 P1、不编按天行程 |
| 东京塔几点关门 | `intent=qa`，Guide，`done` |

## 浏览器主路径（http://127.0.0.1:5173）

- `/` 未登录 → `/login`
- 跳过登录 → `/` 游客横幅 + 底栏「游客」
- 发送「京都四月穿什么」→ 意图 qa、目的地京都、Guide 气泡
- 游客「立即注册」→ `/register`；注册成功进 `/`，昵称「旅途测试」；游客气泡未合并
- 设置 → 退出登录 → `/login`

## 未用

仓库 `test:e2e` 仍拦 `/api`，本关未把它当真接口门禁。
