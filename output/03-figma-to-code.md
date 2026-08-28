# 第 3 关：设计稿读取转代码

Figma（`input/materials.md`）：  
https://www.figma.com/design/RhBZ6FL3iv79TrEra87KFo/Untitled?node-id=0-1  
fileKey `RhBZ6FL3iv79TrEra87KFo`。已 `get_metadata`、对 4 个产品 Frame `get_design_context` + `get_screenshot` 落盘。

**已按稿修订** `01-requirements.md`、`02-design.md`（以设计交互为准）。

---

## 切页

Page `0:1` 上产品屏幕 Frame（1400×920）：

| Frame | node-id | 基准图 |
|---|---|---|
| login-screen-root | 3:6 | output/03-baselines/login-screen.png |
| registration-screen-root | 6:6 | output/03-baselines/registration-screen.png |
| forgot-password-screen-root | 6:50 | output/03-baselines/forgot-password-screen.png |
| chat-screen-root | 3:36 | output/03-baselines/chat-screen.png |

未当产品页：模板 Dashboard（1:844）等；规范板 `interaction-states-and-overlays`（4:10）只作交互说明。清单见 [manifest.md](03-baselines/manifest.md)。

---

## 切图面板（Assets Export Panel `17:14`）

图标按节点导出设置下 **SVG**；背景与头像下 **PNG**。已 `download_assets` 落到 `web/src/assets/`，**禁止手画 SVG**。清单见 [assets-manifest.md](03-baselines/assets-manifest.md)。

| 用途 | 文件 | node-id |
|---|---|---|
| 鉴权页全屏背景 | `bg-watercolor-autumn.png`（源图 1248×832；组件 2x 导出仅 560×360，全屏用源图） | 17:20 |
| 侧栏用户头像 | `avatar-user.png` | 17:24 |
| AI 头像（本期气泡仍用文字徽章，资源已入库） | `avatar-ai-1.png` / `avatar-ai-2.png` | 17:28 / 17:32 |
| 品牌罗盘 | `compass.svg` | 17:41 |
| 设置 / 发送 / 邮箱 / 新建 / 历史 | `settings.svg` `send.svg` `mail.svg` `plus.svg` `message.svg` | 17:47 / 17:59 / 17:65 / 17:71 / 17:77 |
| 输入栏回形针（视觉，本期不可点附件） | `paperclip.svg` | 17:53 |
| 退出 / 横幅关闭 | `logout.svg` `close.svg` | 17:101 / 17:113 |
| 鉴权字段图标 | `user.svg` `key.svg` | 17:119 / 17:125 |
| 规范板预留（本期不做会话改名/删除） | `edit.svg` `trash.svg` `arrow-up.svg` `alert.svg` | 17:89 / 17:95 / 17:83 / 17:107 |

切图面板本身不是产品页，**不**再为它做 pixelmatch 基准图。第 7 关仍对上面 4 个 1400×920 屏幕 Frame 对比。

---

## 与第 1、2 关原稿的偏差（已改文档）

| 原稿约定 | 设计稿 | 处理 |
|---|---|---|
| 登录/注册做在现有深色侧栏里 | 独立全屏卡片 + 水彩背景 | 跟稿：三鉴权页 + 工作台 |
| 未登录直接进工作台 | 默认登录页；「跳过登录，直接体验」才进工作台 | 跟稿 |
| 不做忘记密码 | 有忘记密码页 | 跟稿做页；验证码不接真网关 |
| 仅邮箱 | 「邮箱 / 手机号」；注册有昵称、确认密码 | 跟稿 |
| 退出做侧栏按钮 | 底栏设置 →「退出登录」 | 跟稿 |
| 游客只 pill 文案 | 登录页游客区 + 工作台顶栏横幅「立即注册」 | 跟稿 |
| 品牌 Travel Planner | 「旅途知己」 | 跟稿 |

仍遵守 P0：Planner 占位不输出按天卡片（稿里 Day 块仅工作台视觉示例）。

---

## 对照（React + CSS Module，禁止原样粘贴 Tailwind）

### 登录 3:6

居中 440px 卡 `#fcfaf7`、圆角 24、主色按钮 `#d65e47`「登录」。字段：邮箱/手机号、密码、忘记密码链接、没有账号→注册、分割线、「跳过登录，直接体验」+ 灰字「游客模式下数据不会长期保存」。背景：Figma 导出图 + 15% 深色罩。图标用 MCP asset 下载进仓库，不要手画 SVG。

### 注册 6:6

同卡：昵称、邮箱/手机号、密码（至少 8 位）、确认密码、「注册」、已有账号→去登录。无游客跳过（游客从登录页进）。

### 忘记密码 6:50

说明文案 + 标识输入 +「发送验证码」+ 返回登录。

### 工作台 3:36

左 280 `#f7f4ef`：品牌、新建会话、历史行程、底栏头像+昵称+设置。右：标题+「定制中」类徽章、气泡（用户 `#d65e47` 白字 / AI 浅纸色）、底栏输入与发送。游客：横幅（规范 08）、历史空、底栏「游客」。

### 规范板（实现鉴权时要用）

- 主按钮 Default/Hover/Pressed/Disabled（Terracotta）
- 「跳过登录」链接 Sage `#6e8071`
- 设置下拉仅「退出登录」（本期不做改密）
- 游客横幅 + 立即注册 + 关闭

---

## 第 4 关注意

参考代码是 Tailwind，必须改成现有 Vite React + `*.module.css`。不新增第二个前端入口。鉴权 `/login` `/register` `/forgot`，工作台 `/`。
