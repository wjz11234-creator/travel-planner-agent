/** 会话工作台页（`/`）。 */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { fetchHistory, fetchSessions, streamChat } from "./api/chat";
import { agentLabel } from "./lib/agents";
import type { ChatMessage, SessionSummary, TravelProfile, User } from "./types/itinerary";
import styles from "./App.module.css";
import avatarUser from "./assets/avatar-user.png";
import closeIcon from "./assets/close.svg";
import compass from "./assets/compass.svg";
import logoutIcon from "./assets/logout.svg";
import messageIcon from "./assets/message.svg";
import paperclipIcon from "./assets/paperclip.svg";
import plusIcon from "./assets/plus.svg";
import sendIcon from "./assets/send.svg";
import settingsIcon from "./assets/settings.svg";

type Props = {
  user: User | null;
  onLogout: () => Promise<void>;
};

/**
 * 登录后或游客进入的对话页。
 * @param props 当前用户与退出
 * @returns 工作台或跳转登录
 */
export default function Workbench({ user, onLogout }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const guest = !user && Boolean((location.state as { guest?: boolean } | null)?.guest);

  const [bannerOn, setBannerOn] = useState(true);
  const [menuOn, setMenuOn] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [intent, setIntent] = useState<string | null>(null);
  const [profile, setProfile] = useState<TravelProfile>({});
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const refreshSessions = useCallback(async () => {
    if (!user) {
      setSessions([]);
      return;
    }
    setSessions(await fetchSessions());
  }, [user]);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    if (!user || !sessionId) return;
    void fetchHistory(sessionId).then(setMessages);
  }, [sessionId, user]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  if (!user && !guest) {
    return <Navigate to="/login" replace />;
  }

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    setLoading(true);
    setActiveAgent("supervisor");
    const pending: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(pending);
    try {
      await streamChat(
        text,
        sessionId,
        {
          onAgent: (agent) => {
            setActiveAgent(agent);
          },
          onIntent: (p) => {
            setIntent(p.intent);
            if (p.profile) setProfile(p.profile);
          },
          onText: (delta, agent) => {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "agent" && last.agent === agent) {
                next[next.length - 1] = { ...last, content: last.content + delta };
              } else {
                next.push({ role: "agent", content: delta, agent });
              }
              return next;
            });
          },
          onDone: (p) => {
            if (user && p.session_id) setSessionId(p.session_id);
            setIntent(p.intent);
            if (p.profile) setProfile(p.profile);
            setActiveAgent(null);
          },
          onError: (m) => setError(m),
        },
        guest ? messages : undefined,
      );
      void refreshSessions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "发送失败");
      setActiveAgent(null);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const newChat = () => {
    setSessionId(null);
    setMessages([]);
    setIntent(null);
    setProfile({});
    setError(null);
  };

  const title = messages[0]?.content?.slice(0, 18) || "新对话";

  return (
    <div className={styles.shell} data-testid="workbench">
      <aside className={styles.sidebar}>
        <div className={styles.sideTop}>
          <div className={styles.brand}>
            <span className={styles.miniBadge}>
              <img src={compass} alt="" width={18} height={18} />
            </span>
            <strong>旅途知己</strong>
          </div>
          <button className={styles.newBtn} type="button" onClick={newChat} data-testid="new-chat">
            <img src={plusIcon} alt="" width={16} height={16} />
            新建会话
          </button>
          <p className={styles.histLabel}>历史行程</p>
          <ul className={styles.sessionList} data-testid="session-list">
            {sessions.map((s) => (
              <li key={s.session_id}>
                <button
                  type="button"
                  className={s.session_id === sessionId ? styles.active : ""}
                  onClick={() => setSessionId(s.session_id)}
                  data-testid={`session-${s.session_id}`}
                >
                  <img src={messageIcon} alt="" width={16} height={16} />
                  <span>
                    <em>{s.preview || "空会话"}</em>
                    <small>{s.msg_count} 条</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.sideFoot}>
          {user ? (
            <>
              <div className={styles.footUser}>
                <img className={styles.footAvatar} src={avatarUser} alt="" width={36} height={36} />
                <div>
                  <strong data-testid="user-nickname">{user.nickname}</strong>
                  <small>{user.email}</small>
                </div>
              </div>
              <div className={styles.menuWrap}>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => setMenuOn((v) => !v)}
                  data-testid="settings-trigger"
                  aria-label="设置"
                >
                  <img src={settingsIcon} alt="" width={18} height={18} />
                </button>
                {menuOn ? (
                  <div className={styles.menu}>
                    <button type="button" onClick={() => void onLogout()} data-testid="logout-button">
                      <img src={logoutIcon} alt="" width={16} height={16} />
                      退出登录
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <span data-testid="guest-badge">游客</span>
          )}
        </div>
      </aside>

      <main className={styles.main}>
        {guest && bannerOn ? (
          <div className={styles.banner} data-testid="guest-banner">
            <span>你正在使用游客模式，数据不会长期保存。</span>
            <button type="button" onClick={() => navigate("/register")}>
              立即注册
            </button>
            <button type="button" className={styles.bannerX} onClick={() => setBannerOn(false)} aria-label="关闭">
              <img src={closeIcon} alt="" width={14} height={14} />
            </button>
          </div>
        ) : null}

        <header className={styles.topbar}>
          <div>
            <h1>{title}</h1>
            <p>Supervisor 路由 · Guide 检索作答 · 规划流水线将在 P1 上线</p>
          </div>
          <div className={styles.meta}>
            <span className={styles.pill} data-testid="intent-pill">
              意图 {intent ?? "—"}
            </span>
            <span className={styles.pill} data-testid="destination-pill">
              目的地 {profile.destination ?? "未识别"}
            </span>
            {activeAgent ? (
              <span className={styles.live} data-testid="active-agent">
                {agentLabel(activeAgent)} 工作中
              </span>
            ) : null}
          </div>
        </header>

        <div className={styles.list} ref={listRef} data-testid="message-list">
          {messages.length === 0 ? (
            <div className={styles.empty} data-testid="empty-state">
              <p>试着问：</p>
              <button type="button" onClick={() => setInput("京都四月穿什么")} data-testid="example-kyoto">
                京都四月穿什么
              </button>
              <button type="button" onClick={() => setInput("东京塔几点关门")} data-testid="example-tokyo-tower">
                东京塔几点关门
              </button>
              <button type="button" onClick={() => setInput("帮我做东京 5 日")} data-testid="example-tokyo-5d">
                帮我做东京 5 日
              </button>
            </div>
          ) : null}
          {messages.map((m, i) => (
            <article
              key={`${m.role}-${i}`}
              className={m.role === "user" ? styles.user : styles.agent}
              data-testid={`chat-message-${i}`}
              data-role={m.role}
            >
              {m.role === "agent" ? (
                <span
                  className={styles.badge}
                  data-agent={m.agent ?? ""}
                  data-testid={`agent-badge-${m.agent ?? "unknown"}`}
                >
                  {agentLabel(m.agent)}
                </span>
              ) : (
                <span className={styles.badgeUser} data-testid="user-badge">
                  你
                </span>
              )}
              <div className={styles.bubble} data-testid="chat-bubble">
                {m.content}
              </div>
            </article>
          ))}
          {loading && !messages.some((m) => m.role === "agent" && m.content) && activeAgent === "supervisor" ? (
            <p className={styles.hint} data-testid="supervisor-hint">
              Supervisor 正在判断意图…
            </p>
          ) : null}
        </div>

        {error ? (
          <p className={styles.error} data-testid="error-banner">
            {error}
          </p>
        ) : null}

        <footer className={styles.composer}>
          <button type="button" className={styles.clipBtn} disabled aria-label="附件（本期不可用）">
            <img src={paperclipIcon} alt="" width={20} height={20} />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="输入你的旅行问题..."
            rows={1}
            disabled={loading}
            data-testid="composer-input"
          />
          <button
            type="button"
            className={styles.sendBtn}
            onClick={() => void send()}
            disabled={loading || !input.trim()}
            data-testid="send-button"
            aria-label="发送"
          >
            <img src={sendIcon} alt="" width={16} height={16} />
          </button>
        </footer>
      </main>
    </div>
  );
}
