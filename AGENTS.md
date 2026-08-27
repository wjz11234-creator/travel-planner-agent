# Travel Planner Agent

本文件是**项目覆盖**。通用交付环、测试门禁、MCP 调用见个人 Skills：`frontend-ai-native`。

多 Agent 旅行攻略查询与方案设计。当前 **P0**：Supervisor 路由 + Guide 问答 + Planner 占位。不做订票。

## 前端根目录

- 路径：`web/`
- 开发 URL：`http://127.0.0.1:5173`
- 代理：`/api` → `http://127.0.0.1:8000`

## 协议与文档

- 架构：`docs/DESIGN.md`（改协作模型先改这份）
- 本期：`docs/P0.md`
- 契约：`web/src/types/itinerary.ts`
- SSE 解析：`web/src/api/sse.ts`；会话 API：`web/src/api/chat.ts`

## 测试命令（在 `web/`）

- 单测：`npm test`（Vitest，mock SSE，不打真实 LLM）
- e2e：`npm run test:e2e`（Playwright 拦 `/api`；macOS 12 用本机 Chrome）
- 一起：`npm run test:all`

## 验收用例

- 京都四月穿什么 → Guide，气泡有 Agent 徽章
- 东京塔几点关门 → Guide（可说不知道）
- 帮我做东京 5 日 → Planner 占位，无按天卡片
- 新对话清空消息；意图回到 `—`

## MCP 补充

- 无指定 Notion 任务库、无指定 Figma 文件时，不要主动拉外部文档。
- 浏览器验收 URL 即上面的开发 URL。

## 禁止

- 不要发明未在 `DESIGN.md` / `itinerary.ts` 出现的 API 或 State 字段
- 不要把问答做成完整日历；P0 的 plan 只走 Planner 占位
