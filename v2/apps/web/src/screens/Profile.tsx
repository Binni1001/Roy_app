import { useEffect, useState, type FormEvent } from "react";
import type { Profile as ProfileData, ProfileInput } from "@roy/shared";
import { useProfile, useSaveProfile } from "../hooks/useMemberData";
import { supabase } from "../lib/supabase";
import { QueryState } from "./QueryState";

const toForm = (profile: ProfileData): Record<keyof ProfileInput, string> => ({
  fullName: profile.fullName,
  nickname: profile.nickname ?? "",
  phone: profile.phone ?? "",
  bio: profile.bio ?? "",
});

function ProfileForm({ profile }: { profile: ProfileData }) {
  const [form, setForm] = useState(() => toForm(profile));
  const [saved, setSaved] = useState(false);
  const save = useSaveProfile();

  // Khi máy chủ trả hồ sơ mới (sau khi lưu), đồng bộ lại form.
  useEffect(() => setForm(toForm(profile)), [profile]);

  const set = (key: keyof ProfileInput) => (value: string) => {
    setSaved(false);
    save.reset();
    setForm((current) => ({ ...current, [key]: value }));
  };
  const changed = (Object.keys(form) as (keyof ProfileInput)[]).some((key) => form[key] !== toForm(profile)[key]);

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate(form, { onSuccess: () => setSaved(true) });
  }

  return (
    <form className="card rise form" onSubmit={submit} noValidate>
      <h2>Hồ sơ của bạn</h2>

      <label htmlFor="fullName">Họ tên</label>
      <input id="fullName" autoComplete="name" value={form.fullName} onChange={(e) => set("fullName")(e.target.value)} />

      <label htmlFor="nickname">Biệt danh</label>
      <input
        id="nickname"
        placeholder="Tên hiện trên bảng xếp hạng"
        value={form.nickname}
        onChange={(e) => set("nickname")(e.target.value)}
      />

      <label htmlFor="phone">Số điện thoại</label>
      <input
        id="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="0901234567"
        value={form.phone}
        onChange={(e) => set("phone")(e.target.value)}
      />

      <label htmlFor="bio">Giới thiệu</label>
      <textarea id="bio" rows={3} maxLength={300} value={form.bio} onChange={(e) => set("bio")(e.target.value)} />

      <p className="muted small">Email đăng nhập: {profile.email ?? "chưa có"}. Liên hệ quản trị viên nếu cần đổi.</p>

      {save.isError && (
        <p className="error" role="alert">
          {save.error.message}
        </p>
      )}
      {saved && (
        <p className="ok" role="status">
          Đã lưu hồ sơ.
        </p>
      )}

      {changed && (
        <button className="btn btn-gold" type="submit" disabled={save.isPending}>
          {save.isPending ? "Đang lưu…" : "Lưu thay đổi"}
        </button>
      )}
    </form>
  );
}

export function Profile() {
  const query = useProfile();
  return (
    <>
      <h1 className="page-title">Tôi</h1>
      <div className="stack narrow">
        <QueryState query={query}>{(profile) => <ProfileForm profile={profile} />}</QueryState>
        <button className="btn btn-ghost" onClick={() => void supabase.auth.signOut()}>
          Đăng xuất
        </button>
      </div>
    </>
  );
}
