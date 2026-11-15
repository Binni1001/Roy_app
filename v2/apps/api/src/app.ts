import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { requireAuth, type AuthEnv, type TokenVerifier } from "./auth.ts";
import { AccountInactiveError, loadBootstrap } from "./routes/bootstrap.ts";
import { loadArena, type ArenaStore } from "./routes/arena.ts";
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
  store: MemberStore & ArenaStore;
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

  return app;
}
