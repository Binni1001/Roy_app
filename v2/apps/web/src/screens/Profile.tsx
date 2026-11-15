import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Camera } from "lucide-react";
import type { Profile as ProfileData, ProfileInput } from "@roy/shared";
import { useBootstrapData } from "../hooks/useBootstrapData";
import { useSwitchGroup } from "../hooks/useGroups";
import { useProfile, useSaveProfile, useUploadAvatar } from "../hooks/useMemberData";
import { squareAvatar } from "../lib/image";
import { useInstall } from "../lib/pwa";
import { supabase } from "../lib/supabase";
import { QueryState } from "./QueryState";

function AvatarPicker({ profile }: { profile: ProfileData }) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadAvatar();
  const [problem, setProblem] = useState("");

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setProblem("");
    try {
      upload.mutate(await squareAvatar(file));
    } catch (error) {
      setProblem((error as Error).message);
    }
  }

  const initials = profile.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  const message = problem || upload.error?.message;

  return (
    <div className="avatar-picker">
      <button
        type="button"
        className="avatar-edit"
        onClick={() => input.current?.click()}
        disabled={upload.isPending}
        aria-label="Đổi ảnh đại diện"
      >
        {profile.avatarUrl ? (
          <img className="avatar" src={profile.avatarUrl} alt="" width="88" height="88" />
        ) : (
          <span className="avatar" aria-hidden="true">
            {initials}
          </span>
        )}
        <span className="avatar-badge" aria-hidden="true">
          <Camera size={16} />
        </span>
      </button>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => void pick(e)} />
      <p className="muted small">{upload.isPending ? "Đang tải ảnh lên…" : "Chạm vào ảnh để đổi"}</p>
      {message && (
        <p className="error" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}

/** Nút cài app (Android, máy tính) hoặc hướng dẫn thêm vào màn hình chính (iPhone). */
function InstallCard() {
  const { state, install } = useInstall();
  if (state === "installed" || state === "unavailable") return null;
  return (
    <section className="card rise d2">
      <h2>Cài app lên điện thoại</h2>
      {state === "prompt" ? (
        <>
          <p className="muted">Mở nhanh từ màn hình chính, không cần gõ địa chỉ.</p>
          <button className="btn btn-gold" onClick={() => void install()}>
            Cài Roy Badminton
          </button>
        </>
      ) : (
        <p className="muted">
          Trong Safari, bấm nút Chia sẻ rồi chọn <strong>Thêm vào MH chính</strong>.
        </p>
      )}
    </section>
  );
}

/** Chỉ hiện khi người dùng đang hoạt động ở từ hai nhóm trở lên. */
function GroupSwitcher() {
  const { me, memberships } = useBootstrapData();
  const switchGroup = useSwitchGroup();
  const active = memberships.filter((m) => m.status === "active");
  if (active.length < 2) return null;
  return (
    <section className="card rise d1 form">
      <h2>Nhóm đang xem</h2>
      <label htmlFor="group">Chọn nhóm</label>
      <select
        id="group"
        value={me?.activeGroupId ?? ""}
        disabled={switchGroup.isPending}
        onChange={(e) => switchGroup.mutate(e.target.value)}
      >
        {active.map((m) => (
          <option key={m.groupId} value={m.groupId}>
            {m.groupName}
          </option>
        ))}
      </select>
      {switchGroup.isError && (
        <p className="error" role="alert">
          {switchGroup.error.message}
        </p>
      )}
    </section>
  );
}

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
  // Chỉ theo các ô trong form: đổi ảnh đại diện không được xóa phần đang gõ dở.
  useEffect(() => setForm(toForm(profile)), [profile.fullName, profile.nickname, profile.phone, profile.bio]);

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
      <AvatarPicker profile={profile} />
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
  const { role } = useBootstrapData();
  return (
    <>
      <h1 className="page-title">Tôi</h1>
      <div className="stack narrow">
        <QueryState query={query}>{(profile) => <ProfileForm profile={profile} />}</QueryState>
        {role === "owner" && (
          <section className="card rise d1 admin-links">
            <h2>Quản trị câu lạc bộ</h2>
            <Link to="/ky-quy" className="btn btn-ghost link-btn">
              Kỳ quỹ
            </Link>
            <Link to="/nhan-su" className="btn btn-ghost link-btn">
              Nhân sự
            </Link>
            <Link to="/duyet" className="btn btn-ghost link-btn">
              Duyệt thành viên xin vào nhóm
            </Link>
          </section>
        )}
        <GroupSwitcher />
        <InstallCard />
        <button className="btn btn-ghost" onClick={() => void supabase.auth.signOut()}>
          Đăng xuất
        </button>
      </div>
    </>
  );
}
