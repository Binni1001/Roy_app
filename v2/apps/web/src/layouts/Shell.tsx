import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { Bootstrap } from "@roy/shared";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { NAV } from "./nav";

interface ShellProps {
  bootstrap: Bootstrap;
  children: ReactNode;
}

function Brand() {
  return (
    <div className="brand">
      <img src="/icons/logo-96.webp" alt="" width="40" height="40" />
      <span>Roy Badminton</span>
    </div>
  );
}

/** Bố cục web: thanh điều hướng trên cùng, nội dung nhiều cột. */
function WebLayout({ bootstrap, children }: ShellProps) {
  const group = bootstrap.memberships.find((m) => m.groupId === bootstrap.me?.activeGroupId);
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
        <span className="group-pill">{group?.groupName ?? "Chưa vào nhóm"}</span>
      </header>
      <main className="web-main">{children}</main>
    </div>
  );
}

/** Bố cục app: nội dung một cột, thanh điều hướng nổi ở đáy. */
function AppLayout({ children }: ShellProps) {
  return (
    <div className="app">
      <main className="app-main">{children}</main>
      <nav className="dock" aria-label="Điều hướng app">
        {NAV.map(({ to, label, icon: Icon }) => (
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
