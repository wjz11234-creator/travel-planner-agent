# 第 4 关：实现说明

切片：注册 / 登录 / 忘记密码（占位）/ 游客跳过登录 / 退出。协议已写入 `docs/DESIGN.md` 与 `web/src/types/itinerary.ts`。UI 按第 3 关对照改写成 CSS Module，未粘贴 Tailwind。鉴权与工作台用 `react-router-dom` 分页面，不在同一页用 view state 切换。

## 改了哪些文件

| 区域 | 文件 |
|---|---|
| 协议 | `docs/DESIGN.md`、`docs/P0.md`、`web/src/types/itinerary.ts`、`AGENTS.md` |
| 后端 | `backend/app/db/user_store.py`、`session_store.py`（`user_id`）、`backend/app/api/auth.py`、`chat.py`（游客 `history` 不落库）、`main.py`、`config.py`（`auth_secret`）、`requirements.txt` |
| 前端 | `web/src/api/auth.ts`、`chat.ts`、`AuthScreen.tsx`、`Workbench.tsx`、`App.tsx`（路由）、`App.module.css`、`index.css`、`web/src/assets/*` |
| Rules | `frontend-react.mdc`、`frontend-tests.mdc` |

## 行为

- 未登录打开站点会到 `/login`。跳过登录 → `/` 游客工作台；刷新丢失 guest state，回 `/login`，消息不持久。
- 已登录 Cookie `tp_auth`；侧栏仅本人历史；设置 → 退出 → `/login`。
- 忘记密码：`POST /api/auth/forgot` 占位提示，不发短信/邮件。
- Planner 仍占位，无按天卡片。
- 鉴权三页背景为切图 `bg-watercolor-autumn.png` 全屏铺满 + 15% 罩层；工作台无风景背景。

## 未做（按需求不做）

会话重命名/删除弹窗；真实验证码网关；OAuth。

第 5 关需改单测/e2e：默认 `/login`，mock `/api/auth/me` 或点「跳过登录」再进 `/`。
