# 第 5 关：mock 单测

命令在 `web/`。未打真实后端或 LLM。

## 命令与结果

| 命令 | 结果 |
|---|---|
| `npm test` | 3 files / 17 tests 通过 |
| `npm run test:e2e`（拦 `/api`） | 7 passed |

## 覆盖

- 未登录默认 `/login`；注册/忘记密码为独立路由
- 跳过登录 → 游客工作台 + 横幅
- 登录/注册 mock 成功进 `/`；退出回 `/login`
- 原 P0：京都示例填入、Guide 流式徽章、东京 5 日 Planner 占位、新对话清空（游客路径）

## 说明

单测 mock `./api/auth` 与 `./api/chat`。e2e `page.route` 拦 `/api/auth/me`、`logout`、sessions、history、stream。
