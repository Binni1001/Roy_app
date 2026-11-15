import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import type { Bootstrap } from "@roy/shared";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { useSwitchGroup } from "../hooks/useGroups";
import { useNotifications } from "../hooks/useMemberData";
import { NAV } from "./nav";

interface ShellProps {
  bootstrap: Bootstrap;
  children: ReactNode;
}

function Brand() {
  return (
    <Link to="/" className="brand">
      <img src="/icons/logo-96.webp" alt="" width="40" height="40" />
      <span>Roy Badminton</span>
    </Link>
  );
}

function BellLink() {
  const { data } = useNotifications();
  const unread = data?.unread ?? 0;
  return (
    <Link
      to="/thong-bao"
      className="bell"
      aria-label={unread ? `Thông báo, ${unread} chưa đọc` : "Thông báo"}
    >
      <Bell size={20} aria-hidden="true" />
      {unread > 0 && <span className="badge">{unread > 9 ? "9+" : unread}</span>}
    </Link>
  );
}

/** Tên nhóm đang xem; thành ô chọn khi người dùng hoạt động ở nhiều nhóm. */
function GroupPill({ bootstrap }: { bootstrap: Bootstrap }) {
  const switchGroup = useSwitchGroup();
  const active = bootstrap.memberships.filter((m) => m.status === "active");
  const current = active.find((m) => m.groupId === bootstrap.me?.activeGroupId);
  if (active.length < 2) return <span className="group-pill">{current?.groupName ?? "Chưa vào nhóm"}</span>;
  return (
    <select
      className="group-pill"
      aria-label="Nhóm đang xem"
      value={current?.groupId ?? ""}
      disabled={switchGroup.isPending}
      onChange={(e) => switchGroup.mutate(e.target.value)}
    >
      {active.map((m) => (
        <option key={m.groupId} value={m.groupId}>
          {m.groupName}
        </option>
      ))}
    </select>
  );
}

/** Bố cục web: thanh điều hướng trên cùng, nội dung nhiều cột. */
function WebLayout({ bootstrap, children }: ShellProps) {
  return (
    <div className="web">
      <header className="web-header">
        <Brand />
        <nav className="web-nav" aria-label="Điều hướng chính">
          {NAV.map(({ to, label }) => (
            <Link key={to} to={to} activeProps={{ className: "on" }} activeOptions={{ exact: to === "/" }}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="header-end">
          <GroupPill bootstrap={bootstrap} />
          <BellLink />
        </div>
      </header>
      <main className="web-main">{children}</main>
    </div>
  );
}

/** Bố cục app: thanh trên gọn, nội dung một cột, thanh điều hướng nổi ở đáy. */
function AppLayout({ children }: ShellProps) {
  return (
    <div className="app">
      <header className="app-header">
        <Brand />
        <BellLink />
      </header>
      <main className="app-main">{children}</main>
      <nav className="dock" aria-label="Điều hướng app">
        {NAV.filter((item) => !item.webOnly).map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} activeProps={{ className: "on" }} activeOptions={{ exact: to === "/" }}>
            <Icon size={20} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function Shell(props: ShellProps) {
  return useIsDesktop() ? <WebLayout {...props} /> : <AppLayout {...props} />;
}
