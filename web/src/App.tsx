import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { fetchHistory, fetchSessions, streamChat } from "./api/chat";
import type { ChatMessage, SessionSummary, TravelProfile } from "./types/itinerary";
import styles from "./App.module.css";

const SESSION_KEY = "travel-planner-session-id";

const AGENT_LABEL: Record<string, string> = {
  supervisor: "Supervisor",
  guide: "Guide",
  planner: "Planner",
  preference: "Preference",
  research: "Research",
  budget: "Budget",
  critic: "Critic",
  writer: "Writer",
};

function agentLabel(id?: string | null): string {
  if (!id) return "";
  return AGENT_LABEL[id] ?? id;
}

export default function App() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(() =>
    localStorage.getItem(SESSION_KEY),
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [intent, setIntent] = useState<string | null>(null);
  const [profile, setProfile] = useState<TravelProfile>({});
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const refreshSessions = useCallback(async () => {
    setSessions(await fetchSessions());
  }, []);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      return;
    }
    localStorage.setItem(SESSION_KEY, sessionId);
    void fetchHistory(sessionId).then(setMessages);
  }, [sessionId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    setLoading(true);
    setActiveAgent("supervisor");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    let acc = "";
    try {
      await streamChat(text, sessionId, {
        onAgent: (agent) => {
          setActiveAgent(agent);
        },
        onIntent: (p) => {
          setIntent(p.intent);
          if (p.profile) setProfile(p.profile);
        },
        onText: (delta, agent) => {
          acc += delta;
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === "agent" && last.agent === agent) {
              next[next.length - 1] = { ...last, content: acc };
            } else {
              next.push({ role: "agent", content: acc, agent });
            }
            return next;
          });
        },
        onDone: (p) => {
          setSessionId(p.session_id);
          setIntent(p.intent);
          if (p.profile) setProfile(p.profile);
          setActiveAgent(null);
        },
        onError: (m) => setError(m),
      });
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
    localStorage.removeItem(SESSION_KEY);
    setSessionId(null);
    setMessages([]);
    setIntent(null);
    setProfile({});
    setError(null);
  };

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <strong>Travel Planner</strong>
          <span>P0 · 多 Agent 骨架</span>
        </div>
        <button className={styles.newBtn} type="button" onClick={newChat}>
          新对话
        </button>
        <ul className={styles.sessionList}>
          {sessions.map((s) => (
            <li key={s.session_id}>
              <button
                type="button"
                className={s.session_id === sessionId ? styles.active : ""}
                onClick={() => setSessionId(s.session_id)}
              >
                <em>{s.preview || "空会话"}</em>
                <small>{s.msg_count} 条</small>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main className={styles.main}>
        <header className={styles.topbar}>
          <div>
            <h1>旅行攻略查询</h1>
            <p>
              Supervisor 路由 · Guide 检索作答 · 规划流水线将在 P1 上线
            </p>
          </div>
          <div className={styles.meta}>
            <span className={styles.pill}>
              意图 {intent ?? "—"}
            </span>
            <span className={styles.pill}>
              目的地 {profile.destination ?? "未识别"}
            </span>
            {activeAgent ? (
              <span className={styles.live}>
                {agentLabel(activeAgent)} 工作中
              </span>
            ) : null}
          </div>
        </header>

        <div className={styles.list} ref={listRef}>
          {messages.length === 0 ? (
            <div className={styles.empty}>
              <p>试着问：</p>
              <button type="button" onClick={() => setInput("京都四月穿什么")}>
                京都四月穿什么
              </button>
              <button type="button" onClick={() => setInput("东京塔几点关门")}>
                东京塔几点关门
              </button>
              <button type="button" onClick={() => setInput("帮我做东京 5 日")}>
                帮我做东京 5 日
              </button>
            </div>
          ) : null}
          {messages.map((m, i) => (
            <article
              key={`${m.role}-${i}`}
              className={m.role === "user" ? styles.user : styles.agent}
            >
              {m.role === "agent" ? (
                <span className={styles.badge} data-agent={m.agent ?? ""}>
                  {agentLabel(m.agent)}
                </span>
              ) : (
                <span className={styles.badgeUser}>你</span>
              )}
              <div className={styles.bubble}>{m.content}</div>
            </article>
          ))}
          {loading && !messages.some((m) => m.role === "agent" && m.content) && activeAgent === "supervisor" ? (
            <p className={styles.hint}>Supervisor 正在判断意图…</p>
          ) : null}
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}

        <footer className={styles.composer}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="问攻略，或让我规划行程…"
            rows={2}
            disabled={loading}
          />
          <button type="button" onClick={() => void send()} disabled={loading || !input.trim()}>
            {loading ? "协作中" : "发送"}
          </button>
        </footer>
      </main>
    </div>
  );
}
