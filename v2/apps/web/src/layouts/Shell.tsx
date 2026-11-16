import type { ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { ArrowLeftRight, Bell, ShieldCheck } from "lucide-react";
import type { Bootstrap } from "@roy/shared";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { useSwitchGroup } from "../hooks/useGroups";
import { useNotifications } from "../hooks/useMemberData";
import { ADMIN_NAV, ADMIN_ROOT, currentSection, isAdminPath } from "./adminNav";
import { NAV } from "./nav";

interface ShellProps {
  bootstrap: Bootstrap;
  children: ReactNode;
}

// Đường dẫn quản trị được dựng từ cấu hình nên kiểu của TanStack Router không suy ra được.
const path = (to: string) => to as never;

function Brand({ admin }: { admin: boolean }) {
  return (
    <Link to={path(admin ? ADMIN_ROOT : "/")} className="brand">
      <img src="/icons/logo-96.webp" alt="" width="40" height="40" />
      <span>
        Roy Badminton{admin && <small className="brand-tag">Quản trị</small>}
      </span>
    </Link>
  );
}

function BellLink() {
  const { data } = useNotifications();
  const unread = data?.unread ?? 0;
  return (
    <Link to="/thong-bao" className="bell" aria-label={unread ? `Thông báo, ${unread} chưa đọc` : "Thông báo"}>
      <Bell size={20} aria-hidden="true" />
      {unread > 0 && <span className="badge">{unread > 9 ? "9+" : unread}</span>}
    </Link>
  );
}

/** Nút chuyển giữa giao diện thành viên và khu quản trị (chỉ owner thấy). */
function ModeSwitch({ admin, compact }: { admin: boolean; compact?: boolean }) {
  const label = admin ? "Giao diện thành viên" : "Quản trị";
  return (
    <Link to={path(admin ? "/" : ADMIN_ROOT)} className={`mode-switch${admin ? "" : " to-admin"}`} aria-label={label} title={label}>
      {admin ? <ArrowLeftRight size={18} aria-hidden="true" /> : <ShieldCheck size={18} aria-hidden="true" />}
      {!compact && <span>{label}</span>}
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

/** Tab con của mục quản trị đang mở (ví dụ Tiền: Công nợ & sổ quỹ, Tiền cầu & chốt kỳ). */
function AdminTabs({ pathname }: { pathname: string }) {
  const section = currentSection(pathname);
  if (!section || section.tabs.length < 2) return null;
  return (
    <nav className="admin-tabs" aria-label={`Mục ${section.label}`}>
      {section.tabs.map((tab) => {
        const on = pathname === tab.to || pathname.startsWith(tab.to + "/") || (tab.to === "/quan-tri/ky-quy" && pathname.startsWith("/quan-tri/bao-cao"));
        return (
          <Link key={tab.to} to={path(tab.to)} className={on ? "on" : ""}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Bố cục web: thanh điều hướng trên cùng, nội dung nhiều cột. */
function WebLayout({ bootstrap, children, admin, pathname }: ShellProps & { admin: boolean; pathname: string }) {
  const owner = bootstrap.role === "owner";
  const section = admin ? currentSection(pathname) : undefined;
  return (
    <div className={`web${admin ? " is-admin" : ""}`}>
      <header className="web-header">
        <Brand admin={admin} />
        <nav className="web-nav" aria-label={admin ? "Điều hướng quản trị" : "Điều hướng chính"}>
          {admin
            ? ADMIN_NAV.map((item) => (
                <Link key={item.to} to={path(item.to)} className={section === item ? "on" : ""}>
                  {item.label}
                </Link>
              ))
            : NAV.map(({ to, label }) => (
                <Link key={to} to={to} activeProps={{ className: "on" }} activeOptions={{ exact: to === "/" }}>
                  {label}
                </Link>
              ))}
        </nav>
        <div className="header-end">
          <GroupPill bootstrap={bootstrap} />
          {owner && <ModeSwitch admin={admin} />}
          <BellLink />
        </div>
      </header>
      <main className="web-main">
        {admin && <AdminTabs pathname={pathname} />}
        {children}
      </main>
    </div>
  );
}

/** Bố cục app: thanh trên gọn, nội dung một cột, thanh điều hướng nổi ở đáy. */
function AppLayout({ bootstrap, children, admin, pathname }: ShellProps & { admin: boolean; pathname: string }) {
  const owner = bootstrap.role === "owner";
  const section = admin ? currentSection(pathname) : undefined;
  return (
    <div className={`app${admin ? " is-admin" : ""}`}>
      <header className="app-header">
        <Brand admin={admin} />
        <div className="header-end">
          {owner && <ModeSwitch admin={admin} compact />}
          <BellLink />
        </div>
      </header>
      <main className="app-main">
        {admin && <AdminTabs pathname={pathname} />}
        {children}
      </main>
      <nav className="dock" aria-label={admin ? "Điều hướng quản trị" : "Điều hướng app"}>
        {admin
          ? ADMIN_NAV.map(({ to, label, icon: Icon }, index) => (
              <Link key={to} to={path(to)} className={section === ADMIN_NAV[index] ? "on" : ""}>
                <Icon size={20} aria-hidden="true" />
                {label}
              </Link>
            ))
          : NAV.filter((item) => !item.webOnly).map(({ to, label, icon: Icon }) => (
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
  const { pathname } = useLocation();
  // Khu quản trị chỉ dành cho owner; người khác vào đường dẫn đó vẫn thấy thanh của thành viên.
  const admin = props.bootstrap.role === "owner" && isAdminPath(pathname);
  return useIsDesktop() ? <WebLayout {...props} admin={admin} pathname={pathname} /> : <AppLayout {...props} admin={admin} pathname={pathname} />;
}
