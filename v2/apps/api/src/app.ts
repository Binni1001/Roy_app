import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { requireAuth, type AuthEnv, type TokenVerifier } from "./auth.ts";
import { parseProfileInput, ValidationError, type ProfileStore } from "./routes/profile.ts";
import { AccountInactiveError, loadBootstrap } from "./routes/bootstrap.ts";
import { ActionError, changeOpenDay, type ActionsStore, type OpenDayAction } from "./routes/actions.ts";
import { loadArena, type ArenaStore } from "./routes/arena.ts";
import { buildArenaHistory, type ArenaHistoryStore } from "./routes/arenaHistory.ts";
import { loadNotifications, loadTournament, NotFoundError, type ExtrasStore } from "./routes/extras.ts";
import {
  loadSchedule,
  loadWallet,
  NoGroupError,
  NoProfileError,
  resolveMember,
  type MemberStore,
} from "./routes/member.ts";

export interface AppDeps {
  verify: TokenVerifier;
  store: MemberStore & ArenaStore & ArenaHistoryStore & ExtrasStore & ActionsStore & ProfileStore;
  corsOrigins: string[];
}

function fail(c: Context, error: unknown) {
  if (error instanceof AccountInactiveError) {
    return c.json(
      { code: "ACCOUNT_INACTIVE", message: "Tài khoản đã nghỉ. Liên hệ quản trị viên để kích hoạt lại." },
      403,
    );
  }
  if (error instanceof NoProfileError) {
    return c.json({ code: "NO_PROFILE", message: "Tài khoản chưa có hồ sơ người chơi." }, 404);
  }
  if (error instanceof ValidationError) {
    return c.json({ code: "INVALID", message: error.message }, 400);
  }
  if (error instanceof ActionError) {
    return c.json({ code: error.code, message: error.message }, error.status);
  }
  if (error instanceof NotFoundError) {
    return c.json({ code: "NOT_FOUND", message: "Không tìm thấy nội dung này." }, 404);
  }
  if (error instanceof NoGroupError) {
    return c.json({ code: "NO_GROUP", message: "Bạn chưa ở trong nhóm nào đang hoạt động." }, 403);
  }
  console.error(`[${c.req.path}]`, error);
  return c.json({ code: "INTERNAL", message: "Không tải được dữ liệu. Thử lại sau." }, 500);
}

export function createApp({ verify, store, corsOrigins }: AppDeps) {
  const app = new Hono<AuthEnv>();

  app.use(
    "*",
    cors({
      origin: corsOrigins,
      allowHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
      maxAge: 86400,
    }),
  );

  app.get("/health", (c) => c.json({ status: "ok", app: "roy_badminton_v2" }));

  const auth = requireAuth(verify);
  app.use("/bootstrap", auth);
  app.use("/me/*", auth);

  app.get("/bootstrap", async (c) => {
    try {
      return c.json(await loadBootstrap(c.get("user"), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.get("/me/wallet", async (c) => {
    try {
      return c.json(await loadWallet(await resolveMember(c.get("user"), store), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.get("/me/schedule", async (c) => {
    try {
      return c.json(await loadSchedule(await resolveMember(c.get("user"), store), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.get("/me/arena", async (c) => {
    try {
      return c.json(await loadArena(await resolveMember(c.get("user"), store), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.get("/me/arena/history", async (c) => {
    try {
      const member = await resolveMember(c.get("user"), store);
      return c.json(buildArenaHistory(await store.listLeaderboardSnapshots(member.groupId)));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.get("/me/notifications", async (c) => {
    try {
      return c.json(await loadNotifications(await resolveMember(c.get("user"), store), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.get("/me/tournaments", async (c) => {
    try {
      const member = await resolveMember(c.get("user"), store);
      return c.json(await store.listTournaments(member.groupId));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.get("/me/tournaments/:id", async (c) => {
    try {
      const member = await resolveMember(c.get("user"), store);
      return c.json(await loadTournament(member, c.req.param("id"), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.get("/me/profile", async (c) => {
    try {
      const member = await resolveMember(c.get("user"), store);
      const profile = await store.getProfile(member.personId);
      if (!profile) throw new NotFoundError();
      return c.json(profile);
    } catch (error) {
      return fail(c, error);
    }
  });

  app.put("/me/profile", async (c) => {
    try {
      const member = await resolveMember(c.get("user"), store);
      const input = parseProfileInput(await c.req.json().catch(() => null));
      return c.json(await store.updateProfile(member.personId, input));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post("/me/notifications/read", async (c) => {
    try {
      const member = await resolveMember(c.get("user"), store);
      await store.markNotificationsRead(member.personId);
      return c.json(await loadNotifications(member, store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post("/me/open-days/:id/:action", async (c) => {
    try {
      const action = c.req.param("action");
      if (action !== "join" && action !== "leave") {
        return c.json({ code: "NOT_FOUND", message: "Không tìm thấy nội dung này." }, 404);
      }
      const user = c.get("user");
      const member = await resolveMember(user, store);
      return c.json(await changeOpenDay(user, member, c.req.param("id"), action as OpenDayAction, store));
    } catch (error) {
      return fail(c, error);
    }
  });

  return app;
}
