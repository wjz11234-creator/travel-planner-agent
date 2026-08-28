"""鉴权 HTTP：注册、登录、退出、忘记密码占位。"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Cookie, HTTPException, Response
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from pydantic import BaseModel, Field

from app.config import settings
from app.db import user_store

router = APIRouter()
COOKIE = "tp_auth"
_MAX_AGE = 60 * 60 * 24 * 14


class RegisterBody(BaseModel):
    """注册请求。"""

    nickname: str = Field(min_length=1, max_length=40)
    email: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=8, max_length=128)


class LoginBody(BaseModel):
    """登录请求。"""

    email: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=1, max_length=128)


class ForgotBody(BaseModel):
    """忘记密码占位。"""

    email: str = Field(min_length=3, max_length=120)


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(settings.auth_secret, salt="tp-auth")


def set_auth_cookie(response: Response, user_id: str) -> None:
    """写入登录 Cookie。

    @param response: FastAPI Response
    @param user_id: 用户 id（str）
    @returns None
    """
    token = _serializer().dumps({"uid": user_id})
    response.set_cookie(
        key=COOKIE,
        value=token,
        httponly=True,
        samesite="lax",
        path="/",
        max_age=_MAX_AGE,
    )


def clear_auth_cookie(response: Response) -> None:
    """删除登录 Cookie。

    @param response: FastAPI Response
    @returns None
    """
    response.delete_cookie(COOKIE, path="/")


def user_from_cookie(tp_auth: str | None) -> dict | None:
    """解析 Cookie，无效则视为未登录。

    @param tp_auth: Cookie 值（str | None）
    @returns dict | None id/email/nickname
    """
    if not tp_auth:
        return None
    try:
        data = _serializer().loads(tp_auth, max_age=_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return None
    uid = data.get("uid") if isinstance(data, dict) else None
    if not uid:
        return None
    return user_store.get_by_id(str(uid))


def current_user(tp_auth: Optional[str] = Cookie(default=None, alias=COOKIE)) -> dict | None:
    """依赖：当前用户或 None。

    @param tp_auth: Cookie
    @returns dict | None
    """
    return user_from_cookie(tp_auth)


@router.get("/auth/me")
def me(tp_auth: Optional[str] = Cookie(default=None, alias=COOKIE)):
    """当前登录态。

    @returns dict user
    """
    return {"user": user_from_cookie(tp_auth)}


@router.post("/auth/register")
def register(body: RegisterBody, response: Response):
    """注册并登录。

    @param body: RegisterBody
    @param response: 用于 Set-Cookie
    @returns dict user
    @throws HTTPException 409 标识已占用
    """
    user_store.init_users()
    if user_store.get_by_email(body.email):
        raise HTTPException(status_code=409, detail="该邮箱或手机号已注册")
    user = user_store.create_user(body.email, body.nickname, body.password)
    set_auth_cookie(response, user["id"])
    return {"user": user}


@router.post("/auth/login")
def login(body: LoginBody, response: Response):
    """登录。

    @param body: LoginBody
    @param response: 用于 Set-Cookie
    @returns dict user
    @throws HTTPException 401 密码错误
    """
    row = user_store.get_by_email(body.email)
    if not row or not user_store.verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="账号或密码不正确")
    user = {"id": row["id"], "email": row["email"], "nickname": row["nickname"]}
    set_auth_cookie(response, user["id"])
    return {"user": user}


@router.post("/auth/logout")
def logout(response: Response):
    """退出。

    @param response: 用于清 Cookie
    @returns dict ok
    """
    clear_auth_cookie(response)
    return {"ok": True}


@router.post("/auth/forgot")
def forgot(body: ForgotBody):
    """忘记密码占位：不发送验证码。

    @param body: ForgotBody
    @returns dict ok/message
    """
    _ = body.email
    return {"ok": True, "message": "若该账号存在，验证码将在稍后送达（本期为占位，未发送短信或邮件）"}
