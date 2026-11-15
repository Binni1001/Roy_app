import { useEffect, useState, type FormEvent } from "react";
import { isConfigured, supabase } from "../lib/supabase";
import { RESET_PATH } from "./ResetPassword";

type Mode = "login" | "register" | "forgot";

const COOLDOWN_KEY = "roy:reset-sent-at";
const COOLDOWN_SECONDS = 60;

function cooldownLeft(): number {
  try {
    const sentAt = Number(localStorage.getItem(COOLDOWN_KEY) ?? 0);
    return Math.max(0, Math.ceil((sentAt + COOLDOWN_SECONDS * 1000 - Date.now()) / 1000));
  } catch {
    return 0;
  }
}

const TITLES: Record<Mode, { title: string; lead: string; submit: string; busy: string }> = {
  login: {
    title: "Roy Badminton",
    lead: "Đăng nhập để xem lịch đánh, đấu trường và ví của bạn.",
    submit: "Đăng nhập",
    busy: "Đang đăng nhập…",
  },
  register: {
    title: "Tạo tài khoản",
    lead: "Sau khi tạo tài khoản, nhập mã mời của câu lạc bộ để xin vào nhóm.",
    submit: "Tạo tài khoản",
    busy: "Đang tạo…",
  },
  forgot: {
    title: "Quên mật khẩu",
    lead: "Nhập email đã đăng ký. Chúng tôi gửi liên kết để bạn đặt mật khẩu mới.",
    submit: "Gửi liên kết",
    busy: "Đang gửi…",
  },
};

export function Login() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(cooldownLeft);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait(cooldownLeft()), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  function switchTo(next: Mode) {
    setMode(next);
    setError("");
    setInfo("");
    setPassword("");
    setConfirm("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const address = email.trim();
    setError("");
    setInfo("");
    if (!address.includes("@")) return setError("Nhập email hợp lệ.");

    if (mode === "forgot") {
      if (wait > 0) return setError(`Chờ ${wait} giây rồi gửi lại.`);
      setBusy(true);
      const { error: authError } = await supabase.auth.resetPasswordForEmail(address, {
        redirectTo: window.location.origin + RESET_PATH,
      });
      setBusy(false);
      try {
        localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
      } catch {
        // Không lưu được thì chỉ mất phần chờ giữa hai lần gửi.
      }
      setWait(cooldownLeft());
      if (authError) {
        return setError(
          authError.status === 429 ? "Bạn gửi quá nhanh. Chờ một lúc rồi thử lại." : "Không gửi được email. Thử lại sau.",
        );
      }
      return setInfo("Nếu email này đã đăng ký, liên kết đặt lại mật khẩu sẽ đến trong vài phút. Xem cả thư rác.");
    }

    if (!password) return setError("Nhập mật khẩu.");

    if (mode === "register") {
      if (password.length < 8) return setError("Mật khẩu cần ít nhất 8 ký tự.");
      if (password !== confirm) return setError("Mật khẩu nhập lại chưa khớp.");
      setBusy(true);
      const { data, error: authError } = await supabase.auth.signUp({
        email: address,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      setBusy(false);
      if (authError) {
        return setError(
          authError.status === 429
            ? "Bạn thử quá nhanh. Chờ một lúc rồi thử lại."
            : "Không tạo được tài khoản. Kiểm tra email, hoặc email này đã được đăng ký.",
        );
      }
      // Khi Supabase bật xác nhận email, chưa có phiên đăng nhập cho tới khi người dùng bấm liên kết.
      if (!data.session) {
        switchTo("login");
        setInfo("Đã tạo tài khoản. Mở email xác nhận rồi quay lại đăng nhập.");
      }
      return;
    }

    setBusy(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: address, password });
    setBusy(false);
    if (authError) {
      setError(
        authError.message.toLowerCase().includes("not confirmed")
          ? "Email chưa được xác nhận. Mở email xác nhận rồi thử lại."
          : "Email hoặc mật khẩu chưa đúng.",
      );
    }
  }

  async function google() {
    setError("");
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (authError) setError("Không mở được đăng nhập Google. Thử lại.");
  }

  const text = TITLES[mode];

  return (
    <div className="login">
      <form className="login-card rise" onSubmit={submit} noValidate>
        <img src="/icons/logo-96.webp" alt="Logo Roy Badminton" width="72" height="72" />
        <h1>{text.title}</h1>
        <p className="muted">{text.lead}</p>

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

        {mode !== "forgot" && (
          <>
            <label htmlFor="password">Mật khẩu</label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </>
        )}

        {mode === "register" && (
          <>
            <label htmlFor="confirm">Nhập lại mật khẩu</label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {info && (
          <p className="ok" role="status">
            {info}
          </p>
        )}

        <button className="btn btn-gold" type="submit" disabled={busy || (mode === "forgot" && wait > 0)}>
          {busy ? text.busy : mode === "forgot" && wait > 0 ? `Gửi lại sau ${wait} giây` : text.submit}
        </button>

        {mode === "login" && (
          <>
            <button className="btn btn-ghost" type="button" onClick={google}>
              Tiếp tục với Google
            </button>
            <div className="login-links">
              <button type="button" className="text-btn" onClick={() => switchTo("forgot")}>
                Quên mật khẩu?
              </button>
              <button type="button" className="text-btn" onClick={() => switchTo("register")}>
                Tạo tài khoản
              </button>
            </div>
          </>
        )}
        {mode !== "login" && (
          <button type="button" className="text-btn" onClick={() => switchTo("login")}>
            Quay lại đăng nhập
          </button>
        )}
      </form>
    </div>
  );
}
