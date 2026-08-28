/** 鉴权 API：Cookie 会话，须 credentials include。 */

import type { User } from "../types/itinerary";

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { detail?: string | Array<{ msg?: string }> };
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail) && j.detail[0]?.msg) return j.detail[0].msg ?? "请求失败";
  } catch {
    /* ignore */
  }
  return `请求失败 ${res.status}`;
}

/**
 * 当前登录用户。
 * @returns Promise<User | null>
 */
export async function fetchMe(): Promise<User | null> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) return null;
  const j = (await res.json()) as { user?: User | null };
  return j.user ?? null;
}

/**
 * 注册并登录。
 * @param nickname 昵称（string）
 * @param email 邮箱或手机号（string）
 * @param password 密码（string）
 * @returns Promise<User>
 */
export async function registerUser(
  nickname: string,
  email: string,
  password: string,
): Promise<User> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname, email, password }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const j = (await res.json()) as { user: User };
  return j.user;
}

/**
 * 登录。
 * @param email 邮箱或手机号（string）
 * @param password 密码（string）
 * @returns Promise<User>
 */
export async function loginUser(email: string, password: string): Promise<User> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const j = (await res.json()) as { user: User };
  return j.user;
}

/**
 * 退出。
 * @returns Promise<void>
 */
export async function logoutUser(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
}

/**
 * 忘记密码占位。
 * @param email 邮箱或手机号（string）
 * @returns Promise<string> 提示文案
 */
export async function forgotPassword(email: string): Promise<string> {
  const res = await fetch("/api/auth/forgot", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const j = (await res.json()) as { message?: string };
  return j.message ?? "已提交";
}
