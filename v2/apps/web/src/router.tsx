import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  useLocation,
} from "@tanstack/react-router";
import { useBootstrap } from "./hooks/useBootstrap";
import { BootstrapContext, useBootstrapData } from "./hooks/useBootstrapData";
import { useSession } from "./hooks/useSession";
import { ApiRequestError } from "./lib/api";
import { supabase } from "./lib/supabase";
import { Shell } from "./layouts/Shell";
import { Home } from "./screens/Home";
import { Login } from "./screens/Login";
import { Onboarding } from "./screens/Onboarding";
import { RESET_PATH, ResetPassword } from "./screens/ResetPassword";
import { Schedule } from "./screens/Schedule";

function Loading() {
  return (
    <div className="center" role="status" aria-label="Đang tải">
      <img className="pulse" src="/icons/logo-96.webp" alt="" width="64" height="64" />
    </div>
  );
}

function Problem({ title, detail, action }: { title: string; detail: string; action: () => void }) {
  return (
    <div className="center">
      <section className="card" role="alert">
        <h1>{title}</h1>
        <p className="muted">{detail}</p>
        <button className="btn btn-gold" onClick={action}>
          Thử lại
        </button>
      </section>
    </div>
  );
}

function Root() {
  const session = useSession();
  const { pathname } = useLocation();
  const recovering = pathname === RESET_PATH;
  const bootstrap = useBootstrap(recovering ? undefined : session?.user.id);

  if (session === undefined) return <Loading />;
  // Liên kết đặt lại mật khẩu: xử lý trước mọi thứ khác, kể cả khi liên kết đã hết hạn.
  if (recovering) return <ResetPassword session={session} />;
  if (!session) return <Login />;
  if (bootstrap.isPending) return <Loading />;

  if (bootstrap.isError) {
    const error = bootstrap.error;
    if (error instanceof ApiRequestError && error.code === "ACCOUNT_INACTIVE") {
      return (
        <Problem
          title="Tài khoản đã nghỉ"
          detail={error.message}
          action={() => void supabase.auth.signOut()}
        />
      );
    }
    return (
      <Problem title="Không tải được dữ liệu" detail={error.message} action={() => void bootstrap.refetch()} />
    );
  }

  // Chưa có hồ sơ hoặc chưa có nhóm đang hoạt động: chỉ hiện màn hình xin vào nhóm.
  if (!bootstrap.data.me?.activeGroupId) {
    return <Onboarding bootstrap={bootstrap.data} email={session.user.email ?? ""} />;
  }

  return (
    <BootstrapContext.Provider value={bootstrap.data}>
      <Shell bootstrap={bootstrap.data}>
        <Outlet />
      </Shell>
    </BootstrapContext.Provider>
  );
}

const rootRoute = createRootRoute({ component: Root });

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => <Home bootstrap={useBootstrapData()} />,
});
const scheduleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/lich",
  component: Schedule,
});
const arenaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dau-truong",
  component: lazyRouteComponent(() => import("./screens/Arena"), "Arena"),
});
const walletRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/vi",
  component: lazyRouteComponent(() => import("./screens/Wallet"), "Wallet"),
});
const tournamentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/giai-dau",
  component: lazyRouteComponent(() => import("./screens/Tournaments"), "Tournaments"),
});
const tournamentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/giai-dau/$id",
  component: lazyRouteComponent(() => import("./screens/Tournaments"), "TournamentDetail"),
});
const notificationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/thong-bao",
  component: lazyRouteComponent(() => import("./screens/NotificationsScreen"), "NotificationsScreen"),
});
// Màn hình đặt lại mật khẩu do Root vẽ; route này chỉ để địa chỉ được nhận là hợp lệ.
const resetRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: RESET_PATH,
  component: () => null,
});
const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/toi",
  component: lazyRouteComponent(() => import("./screens/Profile"), "Profile"),
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  scheduleRoute,
  arenaRoute,
  tournamentsRoute,
  tournamentRoute,
  notificationsRoute,
  walletRoute,
  profileRoute,
  resetRoute,
]);

export const router = createRouter({ routeTree, defaultPreload: "intent" });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
