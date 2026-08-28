/** 登录 / 注册 / 忘记密码全屏卡片。 */

import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { forgotPassword, loginUser, registerUser } from "./api/auth";
import type { User } from "./types/itinerary";
import styles from "./AuthScreen.module.css";
import authBg from "./assets/bg-watercolor-autumn.png";
import compass from "./assets/compass.svg";
import keyIcon from "./assets/key.svg";
import mailIcon from "./assets/mail.svg";
import userIcon from "./assets/user.svg";

export type AuthView = "login" | "register" | "forgot";

type Props = {
  view: AuthView;
  onLoggedIn: (user: User) => void;
};

/**
 * 鉴权页（`/login` `/register` `/forgot`）。
 * @param props 当前页与登录成功回调
 * @returns JSX
 */
export default function AuthScreen({ view, onLoggedIn }: Props) {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setHint(null);
    setBusy(true);
    try {
      if (view === "login") {
        onLoggedIn(await loginUser(email, password));
      } else if (view === "register") {
        if (password !== confirm) {
          setError("两次密码不一致");
          return;
        }
        onLoggedIn(await registerUser(nickname, email, password));
      } else {
        setHint(await forgotPassword(email));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "失败");
    } finally {
      setBusy(false);
    }
  };

  const title =
    view === "login" ? "你的智能旅行攻略伙伴" : view === "register" ? "创建账号，开启你的旅行之旅" : "重置你的密码";

  return (
    <div
      className={styles.page}
      data-testid={view === "login" ? "login-view" : view === "register" ? "register-view" : "forgot-view"}
    >
      <div className={styles.backdrop} aria-hidden>
        <img className={styles.backdropImg} src={authBg} alt="" width={1248} height={832} />
      </div>
      <form className={styles.card} onSubmit={(e) => void submit(e)}>
        <div className={styles.logo}>
          <span className={styles.badge}>
            <img src={compass} alt="" width={28} height={28} />
          </span>
          <strong>旅途知己</strong>
          <p>{title}</p>
        </div>

        {view === "forgot" ? (
          <p className={styles.lead}>
            输入你注册时使用的邮箱或手机号，我们将发送验证码帮助你重置密码。
          </p>
        ) : null}

        {view === "register" ? (
          <label className={styles.field}>
            昵称
            <span className={styles.input}>
              <img src={userIcon} alt="" width={16} height={16} />
              <input
                value={nickname}
                onChange={(ev) => setNickname(ev.target.value)}
                placeholder="给自己取个旅行代号"
                data-testid="auth-nickname"
              />
            </span>
          </label>
        ) : null}

        <label className={styles.field}>
          邮箱 / 手机号
          <span className={styles.input}>
            <img src={mailIcon} alt="" width={16} height={16} />
            <input
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              placeholder="you@example.com"
              autoComplete="username"
              data-testid="auth-email"
            />
          </span>
        </label>

        {view !== "forgot" ? (
          <label className={styles.field}>
            密码
            <span className={styles.input}>
              <img src={keyIcon} alt="" width={16} height={16} />
              <input
                type="password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                placeholder={view === "register" ? "至少8位字符" : ""}
                autoComplete={view === "login" ? "current-password" : "new-password"}
                data-testid="auth-password"
              />
            </span>
          </label>
        ) : null}

        {view === "register" ? (
          <label className={styles.field}>
            确认密码
            <span className={styles.input}>
              <img src={keyIcon} alt="" width={16} height={16} />
              <input
                type="password"
                value={confirm}
                onChange={(ev) => setConfirm(ev.target.value)}
                placeholder="再次输入密码"
                autoComplete="new-password"
                data-testid="auth-password-confirm"
              />
            </span>
          </label>
        ) : null}

        {view === "login" ? (
          <Link className={styles.linkRight} to="/forgot">
            忘记密码？
          </Link>
        ) : null}

        {error ? (
          <p className={styles.error} data-testid="auth-error">
            {error}
          </p>
        ) : null}
        {hint ? <p className={styles.hint}>{hint}</p> : null}

        <button
          className={styles.primary}
          type="submit"
          disabled={busy}
          data-testid={view === "forgot" ? "forgot-submit" : view === "register" ? "register-button" : "login-button"}
        >
          {view === "login" ? "登录" : view === "register" ? "注册" : "发送验证码"}
        </button>

        {view === "login" ? (
          <>
            <p className={styles.switch}>
              没有账号？
              <Link to="/register">注册账号</Link>
            </p>
            <div className={styles.guest}>
              <button
                type="button"
                onClick={() => navigate("/", { state: { guest: true } })}
                data-testid="skip-login"
              >
                跳过登录，直接体验
              </button>
              <small>游客模式下数据不会长期保存</small>
            </div>
          </>
        ) : null}

        {view === "register" ? (
            <p className={styles.switch}>
              已有账号？
              <Link to="/login">去登录</Link>
            </p>
        ) : null}

        {view === "forgot" ? (
            <p className={styles.switch}>
              想起密码了？
              <Link to="/login">返回登录</Link>
            </p>
        ) : null}
      </form>
    </div>
  );
}
