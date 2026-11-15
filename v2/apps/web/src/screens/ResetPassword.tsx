import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export const RESET_PATH = "/dat-lai-mat-khau";

/**
 * Mở từ liên kết trong email đặt lại mật khẩu. Supabase đọc token trong địa chỉ
 * và tạo phiên tạm, nhờ đó updateUser đổi được mật khẩu.
 */
export function ResetPassword({ session }: { session: Session | null }) {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (password.length < 8) return setError("Mật khẩu mới cần ít nhất 8 ký tự.");
    if (password !== confirm) return setError("Mật khẩu nhập lại chưa khớp.");
    setBusy(true);
    const { error: authError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (authError) {
      return setError(
        authError.message.toLowerCase().includes("different")
          ? "Mật khẩu mới phải khác mật khẩu cũ."
          : "Không đổi được mật khẩu. Mở lại liên kết mới nhất trong email.",
      );
    }
    setDone(true);
  }

  // Về trang chủ: có phiên thì vào app, không có thì ra màn hình đăng nhập.
  const finish = () => void navigate({ to: "/", replace: true });

  if (!session) {
    return (
      <div className="login">
        <section className="login-card rise" role="alert">
          <img src="/icons/logo-96.webp" alt="" width="72" height="72" />
          <h1>Liên kết đã hết hạn</h1>
          <p className="muted">Liên kết đặt lại mật khẩu chỉ dùng được một lần và trong thời gian ngắn. Gửi lại liên kết mới từ màn hình đăng nhập.</p>
          <button className="btn btn-gold" onClick={finish}>
            Về màn hình đăng nhập
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="login">
      <form className="login-card rise" onSubmit={submit} noValidate>
        <img src="/icons/logo-96.webp" alt="" width="72" height="72" />
        <h1>Đặt mật khẩu mới</h1>
        <p className="muted">Cho tài khoản {session.user.email}</p>

        {done ? (
          <>
            <p className="ok" role="status">
              Đã đổi mật khẩu. Từ giờ đăng nhập bằng mật khẩu mới.
            </p>
            <button className="btn btn-gold" type="button" onClick={finish}>
              Vào app
            </button>
          </>
        ) : (
          <>
            <label htmlFor="new-password">Mật khẩu mới</label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <label htmlFor="confirm-password">Nhập lại mật khẩu mới</label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="btn btn-gold" type="submit" disabled={busy}>
              {busy ? "Đang lưu…" : "Lưu mật khẩu mới"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
