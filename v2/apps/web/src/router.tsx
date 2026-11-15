import { createContext, useContext } from "react";
import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from "@tanstack/react-router";
import type { Bootstrap } from "@roy/shared";
import { useBootstrap } from "./hooks/useBootstrap";
import { useSession } from "./hooks/useSession";
import { ApiRequestError } from "./lib/api";
import { supabase } from "./lib/supabase";
import { Shell } from "./layouts/Shell";
import { Home } from "./screens/Home";
import { Login } from "./screens/Login";
import { Schedule } from "./screens/Schedule";

const BootstrapContext = createContext<Bootstrap | null>(null);

function useBootstrapData(): Bootstrap {
  const value = useContext(BootstrapContext);
  if (!value) throw new Error("Bootstrap data is not loaded");
  return value;
}

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
  const bootstrap = useBootstrap(session?.user.id);

  if (session === undefined) return <Loading />;
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

  return (
    <BootstrapContext.Provider value={bootstrap.data}>
      <Shell bootstrap={bootstrap.data}>
        <Outlet />
      </Shell>
    </BootstrapContext.Provider>
  );
}

function Profile() {
  const { me } = useBootstrapData();
  return (
    <section className="card rise">
      <h1>{me?.fullName ?? "Tài khoản"}</h1>
      <button className="btn btn-ghost" onClick={() => void supabase.auth.signOut()}>
        Đăng xuất
      </button>
    </section>
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
const profileRoute = createRoute({ getParentRoute: () => rootRoute, path: "/toi", component: Profile });

const routeTree = rootRoute.addChildren([
  homeRoute,
  scheduleRoute,
  arenaRoute,
  tournamentsRoute,
  tournamentRoute,
  notificationsRoute,
  walletRoute,
  profileRoute,
]);

export const router = createRouter({ routeTree, defaultPreload: "intent" });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
