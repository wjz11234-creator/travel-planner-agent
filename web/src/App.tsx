/** 路由：鉴权页与会话工作台分页面。 */

import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AuthScreen from "./AuthScreen";
import Workbench from "./Workbench";
import { fetchMe, logoutUser } from "./api/auth";
import type { User } from "./types/itinerary";
import styles from "./App.module.css";

/**
 * 应用壳：登录/注册/忘记密码与工作台走不同 URL。
 * @returns 路由 JSX
 */
export default function App() {
  const [boot, setBoot] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    void fetchMe()
      .then((u) => setUser(u))
      .finally(() => setBoot(false));
  }, []);

  if (boot) {
    return <div className={styles.boot} data-testid="boot" />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <AuthScreen view="login" onLoggedIn={setUser} />}
        />
        <Route
          path="/register"
          element={user ? <Navigate to="/" replace /> : <AuthScreen view="register" onLoggedIn={setUser} />}
        />
        <Route
          path="/forgot"
          element={user ? <Navigate to="/" replace /> : <AuthScreen view="forgot" onLoggedIn={setUser} />}
        />
        <Route
          path="/"
          element={
            <Workbench
              user={user}
              onLogout={async () => {
                await logoutUser();
                setUser(null);
              }}
            />
          }
        />
        <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
