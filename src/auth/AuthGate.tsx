import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { Eye, EyeOff, LockKeyhole, LogOut, Music2 } from "lucide-react";
import {
  clearAuthSession,
  createAuthSession,
  hasAuthSession,
  verifyCredentials,
} from "./auth";

const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 30;

export function AuthGate({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(hasAuthSession);
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!lockedUntil) return;
    const update = () => {
      const seconds = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setRemaining(seconds);
      if (!seconds) {
        setLockedUntil(0);
        setAttempts(0);
        setError("");
      }
    };
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [lockedUntil]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || lockedUntil) return;
    setBusy(true);
    setError("");
    try {
      if (await verifyCredentials(userId, password)) {
        createAuthSession();
        setAuthenticated(true);
        setPassword("");
        return;
      }
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      setPassword("");
      if (nextAttempts >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCK_SECONDS * 1000);
        setError(
          `入力回数が上限に達しました。${LOCK_SECONDS}秒後に再試行できます。`,
        );
      } else {
        setError(
          `ユーザーIDまたはパスワードが違います。あと${MAX_ATTEMPTS - nextAttempts}回試せます。`,
        );
      }
    } catch {
      setError(
        "認証処理を開始できませんでした。ページを再読み込みしてください。",
      );
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    clearAuthSession();
    setAuthenticated(false);
    setUserId("");
    setPassword("");
    setAttempts(0);
    setError("");
  }

  if (authenticated)
    return (
      <>
        {children}
        <button className="auth-logout" type="button" onClick={logout}>
          <LogOut size={15} />
          ログアウト
        </button>
      </>
    );

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand" aria-hidden="true">
          <span>
            <Music2 size={25} />
          </span>
          <div>
            <strong>chordcanvas</strong>
            <small>コード進行アシスト</small>
          </div>
        </div>
        <div className="auth-lock">
          <LockKeyhole size={23} />
        </div>
        <p className="auth-eyebrow">PRIVATE WORKSPACE</p>
        <h1 id="auth-title">ログイン</h1>
        <p className="auth-intro">
          コード進行ワークスペースを開くには、ユーザーIDとパスワードを入力してください。
        </p>
        <form onSubmit={(event) => void submit(event)}>
          <label htmlFor="auth-user">ユーザーID</label>
          <input
            id="auth-user"
            name="username"
            type="text"
            autoComplete="username"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            required
            autoFocus
            disabled={busy || Boolean(lockedUntil)}
          />
          <label htmlFor="auth-password">パスワード</label>
          <div className="auth-password-field">
            <input
              id="auth-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={busy || Boolean(lockedUntil)}
            />
            <button
              type="button"
              aria-label={
                showPassword ? "パスワードを隠す" : "パスワードを表示"
              }
              aria-pressed={showPassword}
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {error && (
            <p className="auth-error" role="alert">
              {lockedUntil
                ? `しばらくお待ちください（残り${remaining}秒）`
                : error}
            </p>
          )}
          <button
            className="auth-submit"
            type="submit"
            disabled={busy || Boolean(lockedUntil)}
          >
            {busy
              ? "確認中…"
              : lockedUntil
                ? `再試行まで ${remaining}秒`
                : "ワークスペースを開く"}
          </button>
        </form>
        <p className="auth-note">
          ログイン状態はこのタブを閉じるまで保持されます。
        </p>
      </section>
    </main>
  );
}
