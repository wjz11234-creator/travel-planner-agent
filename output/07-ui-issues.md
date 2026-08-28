# 第 7 关问题：pixelmatch 未全部通过

视口 1400×920，`deviceScaleFactor: 1`，未缩放。pixelmatch `threshold: 0.1`，`includeAA: true`。已做 **3 轮**（含第一次），停止进入第 8 关。

## 最后一次结果

| slug | ratio | 通过 (≤0.02) | baseline | actual | diff |
|---|---|---|---|---|---|
| login-screen | **0.0189** | 是 | `output/03-baselines/login-screen.png` | `output/07-actual/login-screen.png` | `output/07-diff/login-screen.png` |
| registration-screen | **0.0113** | 是 | 同上目录 | 同上 | 同上 |
| forgot-password-screen | **0.0187** | 是 | 同上 | 同上 | 同上 |
| chat-screen | **0.0925** | 否 | 同上 | 同上 | 同上 |

## 已尝试

1. 第 1 轮：按现有 CSS 截图。登录/注册过线；忘记密码 0.0205；工作台 0.092。
2. 第 2 轮：卡片 `gap` 改成稿里的 28px、换 Outfit 标题。四页都变差（卡片变高，背景对不齐）。
3. 第 3 轮：改回 16px 间距，补 Figtree、说明文案 `line-height: 22px`。三鉴权页过线；工作台仍约 9.3%。

工作台热区：稿里有示例会话、四条历史、Day 1–3 卡片、已登录底栏；P0 实现是空态三示例 + 游客横幅，且**禁止按天行程卡片**。继续改间距无法把主栏内容差异压到 2%。

## 建议你怎么决定

- **放宽验收**：三鉴权页已 ≤2%；工作台只验收布局/testid，不做 pixelmatch。
- **补材料再开**：出一张与 P0 空态一致的工作台 Frame，再跑第 7 关。
- **中止**：维持现状，不进第 8 关。
