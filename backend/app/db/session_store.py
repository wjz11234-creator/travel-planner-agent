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
    with _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS sessions (
              session_id TEXT PRIMARY KEY,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
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


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_session(session_id: str | None) -> str:
    init_db()
    sid = (session_id or "").strip() or str(uuid.uuid4())
    now = _now()
    with _connect() as conn:
        row = conn.execute(
            "SELECT session_id FROM sessions WHERE session_id = ?", (sid,)
        ).fetchone()
        if row:
            conn.execute(
                "UPDATE sessions SET updated_at = ? WHERE session_id = ?",
                (now, sid),
            )
        else:
            conn.execute(
                "INSERT INTO sessions (session_id, created_at, updated_at) VALUES (?,?,?)",
                (sid, now, now),
            )
    return sid


def add_message(session_id: str, role: str, content: str, agent: str | None = None) -> None:
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
    init_db()
    with _connect() as conn:
        rows = conn.execute(
            "SELECT role, content, agent, created_at FROM messages WHERE session_id = ? ORDER BY id ASC",
            (session_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def list_sessions(limit: int = 40) -> list[dict]:
    init_db()
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT s.session_id, s.updated_at,
                   (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.session_id) AS msg_count,
                   (SELECT content FROM messages m WHERE m.session_id = s.session_id ORDER BY id DESC LIMIT 1) AS preview
            FROM sessions s
            ORDER BY s.updated_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [dict(r) for r in rows]
