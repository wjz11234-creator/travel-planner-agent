"""SQLite 会话仓储：多轮 history 与侧边栏会话列表。"""

from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timezone

from app.config import settings


def _connect() -> sqlite3.Connection:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(settings.sqlite_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """幂等建表，并为已有库补 user_id 列。

    @returns None
    """
    with _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS sessions (
              session_id TEXT PRIMARY KEY,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              user_id TEXT
            );
            CREATE TABLE IF NOT EXISTS messages (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              session_id TEXT NOT NULL,
              role TEXT NOT NULL,
              content TEXT NOT NULL,
              agent TEXT,
              created_at TEXT NOT NULL,
              FOREIGN KEY(session_id) REFERENCES sessions(session_id)
            );
            """
        )
        cols = [r[1] for r in conn.execute("PRAGMA table_info(sessions)").fetchall()]
        if "user_id" not in cols:
            conn.execute("ALTER TABLE sessions ADD COLUMN user_id TEXT")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_session(session_id: str | None, user_id: str) -> str:
    """没有 session_id 则新建并绑定 user_id；已有则校验归属。

    @param session_id: 客户端带来的会话 id（str | None）
    @param user_id: 登录用户 id（str）
    @returns str 实际使用的 session_id
    @raises PermissionError 会话不属于该用户
    """
    init_db()
    sid = (session_id or "").strip() or str(uuid.uuid4())
    now = _now()
    with _connect() as conn:
        row = conn.execute(
            "SELECT session_id, user_id FROM sessions WHERE session_id = ?",
            (sid,),
        ).fetchone()
        if row:
            owner = row["user_id"]
            if owner and owner != user_id:
                raise PermissionError("session not owned")
            conn.execute(
                "UPDATE sessions SET updated_at = ?, user_id = COALESCE(user_id, ?) WHERE session_id = ?",
                (now, user_id, sid),
            )
        else:
            conn.execute(
                "INSERT INTO sessions (session_id, created_at, updated_at, user_id) VALUES (?,?,?,?)",
                (sid, now, now, user_id),
            )
    return sid


def add_message(session_id: str, role: str, content: str, agent: str | None = None) -> None:
    """追加一条消息并更新会话时间，供侧边栏按最近对话排序。

    @param session_id: 会话 id（str）
    @param role: user | agent（str）
    @param content: 正文（str）
    @param agent: 产出该条的专家名（str | None），用户消息为 None
    @returns None
    """
    now = _now()
    with _connect() as conn:
        conn.execute(
            "INSERT INTO messages (session_id, role, content, agent, created_at) VALUES (?,?,?,?,?)",
            (session_id, role, content, agent, now),
        )
        conn.execute(
            "UPDATE sessions SET updated_at = ? WHERE session_id = ?",
            (now, session_id),
        )


def list_history(session_id: str) -> list[dict]:
    """按写入顺序取出一轮会话，供多轮指代消解。

    @param session_id: 会话 id（str）
    @returns list[dict] 含 role/content/agent/created_at
    """
    init_db()
    with _connect() as conn:
        rows = conn.execute(
            "SELECT role, content, agent, created_at FROM messages WHERE session_id = ? ORDER BY id ASC",
            (session_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def session_owner(session_id: str) -> str | None:
    """会话所属用户。

    @param session_id: 会话 id（str）
    @returns str | None
    """
    init_db()
    with _connect() as conn:
        row = conn.execute(
            "SELECT user_id FROM sessions WHERE session_id = ?",
            (session_id,),
        ).fetchone()
    if not row:
        return None
    return row["user_id"]


def list_sessions(user_id: str, limit: int = 40) -> list[dict]:
    """该用户的会话列表。

    @param user_id: 用户 id（str）
    @param limit: 最多返回条数（int）
    @returns list[dict] session_id/updated_at/msg_count/preview
    """
    init_db()
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT s.session_id, s.updated_at,
                   (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.session_id) AS msg_count,
                   (SELECT content FROM messages m WHERE m.session_id = s.session_id ORDER BY id DESC LIMIT 1) AS preview
            FROM sessions s
            WHERE s.user_id = ?
            ORDER BY s.updated_at DESC
            LIMIT ?
            """,
            (user_id, limit),
        ).fetchall()
    return [dict(r) for r in rows]
