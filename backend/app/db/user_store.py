"""用户仓储：注册、按标识查找。密码用 PBKDF2。"""

from __future__ import annotations

import binascii
import hashlib
import os
import sqlite3
import uuid
from datetime import datetime, timezone

from app.config import settings

_PBKDF2_ROUNDS = 100_000


def _connect() -> sqlite3.Connection:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(settings.sqlite_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_users() -> None:
    """建 users 表。

    @returns None
    """
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
              id TEXT PRIMARY KEY,
              email TEXT NOT NULL UNIQUE,
              nickname TEXT NOT NULL,
              password_hash TEXT NOT NULL,
              created_at TEXT NOT NULL
            )
            """
        )


def hash_password(password: str) -> str:
    """生成 salt$hash。

    @param password: 明文（str）
    @returns str
    """
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ROUNDS)
    return f"{binascii.hexlify(salt).decode()}${binascii.hexlify(dk).decode()}"


def verify_password(password: str, stored: str) -> bool:
    """校验明文与存储哈希。

    @param password: 明文（str）
    @param stored: 仓储哈希（str）
    @returns bool
    """
    try:
        salt_hex, dk_hex = stored.split("$", 1)
    except ValueError:
        return False
    salt = binascii.unhexlify(salt_hex)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ROUNDS)
    return binascii.hexlify(dk).decode() == dk_hex


def get_by_id(user_id: str) -> dict | None:
    """按主键取用户。

    @param user_id: 用户 id（str）
    @returns dict | None id/email/nickname
    """
    init_users()
    with _connect() as conn:
        row = conn.execute(
            "SELECT id, email, nickname FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    return dict(row) if row else None


def get_by_email(email: str) -> dict | None:
    """按登录标识取用户（含 password_hash）。

    @param email: 邮箱或手机号（str）
    @returns dict | None
    """
    init_users()
    ident = email.strip().lower()
    with _connect() as conn:
        row = conn.execute(
            "SELECT id, email, nickname, password_hash FROM users WHERE email = ?",
            (ident,),
        ).fetchone()
    return dict(row) if row else None


def create_user(email: str, nickname: str, password: str) -> dict:
    """插入用户。调用方须先检查占用。

    @param email: 登录标识（str）
    @param nickname: 昵称（str）
    @param password: 明文（str）
    @returns dict id/email/nickname
    """
    init_users()
    uid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    ident = email.strip().lower()
    with _connect() as conn:
        conn.execute(
            "INSERT INTO users (id, email, nickname, password_hash, created_at) VALUES (?,?,?,?,?)",
            (uid, ident, nickname.strip(), hash_password(password), now),
        )
    return {"id": uid, "email": ident, "nickname": nickname.strip()}
