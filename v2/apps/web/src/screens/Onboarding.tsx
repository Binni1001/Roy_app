import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Bootstrap } from "@roy/shared";
import { useCheckInvite, useJoinGroup } from "../hooks/useGroups";
import { supabase } from "../lib/supabase";

/**
 * Màn hình cho tài khoản chưa vào được app: chưa có hồ sơ, hoặc chưa có nhóm nào đang hoạt động.
 * Mọi yêu cầu vào nhóm đều chờ quản trị viên của nhóm duyệt.
 */
export function Onboarding({ bootstrap, email }: { bootstrap: Bootstrap; email: string }) {
  const client = useQueryClient();
  const check = useCheckInvite();
  const join = useJoinGroup();
  const [code, setCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [groupName, setGroupName] = useState<string | null>(null);

  const needsProfile = !bootstrap.me;
  const pending = bootstrap.memberships.filter((m) => m.status === "pending");
  const error = check.error ?? join.error;
  const busy = check.isPending || join.isPending;

  function reset() {
    setGroupName(null);
    check.reset();
    join.reset();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!groupName) {
      check.mutate(code, { onSuccess: (result) => setGroupName(result.groupName) });
      return;
    }
    join.mutate(
      { code, ...(needsProfile ? { fullName } : {}) },
      {
        onSuccess: () => {
          setCode("");
          setGroupName(null);
        },
      },
    );
  }

  const name = bootstrap.me ? bootstrap.me.nickname || bootstrap.me.fullName : null;

  return (
    <div className="login">
      <form className="login-card rise" onSubmit={submit} noValidate>
        <img src="/icons/logo-96.webp" alt="Logo Roy Badminton" width="72" height="72" />
        <h1>{name ? `Chào ${name}` : "Vào câu lạc bộ"}</h1>

        {pending.length > 0 ? (
          <div className="notice" role="status">
            {pending.map((m) => (
              <p key={m.groupId}>
                Yêu cầu vào <strong>{m.groupName}</strong> đang chờ quản trị viên duyệt.
              </p>
            ))}
            <p className="muted small">Khi được duyệt, bấm Kiểm tra lại để vào app.</p>
          </div>
        ) : (
          <p className="muted">
            {needsProfile
              ? `Tài khoản ${email} chưa thuộc câu lạc bộ nào. Nhập mã mời do quản trị viên gửi.`
              : "Bạn chưa ở nhóm nào đang hoạt động. Nhập mã mời để xin vào nhóm."}
          </p>
        )}

        <label htmlFor="invite">Mã mời{pending.length ? " (nhóm khác)" : ""}</label>
        <input
          id="invite"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="VD: ROYCLUB"
          maxLength={16}
          value={code}
          disabled={Boolean(groupName)}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            reset();
          }}
        />

        {groupName && (
          <>
            <p className="ok" role="status">
              Mã đúng: nhóm <strong>{groupName}</strong>.
            </p>
            {needsProfile && (
              <>
                <label htmlFor="full-name">Họ tên của bạn</label>
                <input
                  id="full-name"
                  autoComplete="name"
                  placeholder="Nguyễn Văn A"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </>
            )}
          </>
        )}

        {error && (
          <p className="error" role="alert">
            {error.message}
          </p>
        )}

        <button className="btn btn-gold" type="submit" disabled={busy || !code.trim()}>
          {busy ? "Đang gửi…" : groupName ? "Gửi yêu cầu vào nhóm" : "Kiểm tra mã"}
        </button>
        {groupName && (
          <button type="button" className="text-btn" onClick={reset}>
            Nhập mã khác
          </button>
        )}

        <div className="login-links">
          {pending.length > 0 && (
            <button type="button" className="text-btn" onClick={() => void client.invalidateQueries({ queryKey: ["bootstrap"] })}>
              Kiểm tra lại
            </button>
          )}
          <button type="button" className="text-btn" onClick={() => void supabase.auth.signOut()}>
            Đăng xuất
          </button>
        </div>
      </form>
    </div>
  );
}
