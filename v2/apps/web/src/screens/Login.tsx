import { useState, type FormEvent } from "react";
import { isConfigured, supabase } from "../lib/supabase";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Nhập email và mật khẩu.");
      return;
    }
    setBusy(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (authError) setError("Email hoặc mật khẩu chưa đúng.");
  }

  async function google() {
    setError("");
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (authError) setError("Không mở được đăng nhập Google. Thử lại.");
  }

  return (
    <div className="login">
      <form className="login-card rise" onSubmit={submit} noValidate>
        <img src="/icons/logo-96.webp" alt="Logo Roy Badminton" width="72" height="72" />
        <h1>Roy Badminton</h1>
        <p className="muted">Đăng nhập để xem lịch đánh, đấu trường và ví của bạn.</p>

        {!isConfigured && (
          <p className="notice" role="alert">
            Chưa có cấu hình Supabase. Tạo file <code>apps/web/.env</code> theo <code>.env.example</code>.
          </p>
        )}

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="ten@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label htmlFor="password">Mật khẩu</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button className="btn btn-gold" type="submit" disabled={busy}>
          {busy ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
        <button className="btn btn-ghost" type="button" onClick={google}>
          Tiếp tục với Google
        </button>
      </form>
    </div>
  );
}
