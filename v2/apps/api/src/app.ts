import { Hono } from "hono";
import { cors } from "hono/cors";
import { requireAuth, type AuthEnv, type TokenVerifier } from "./auth.ts";
import { AccountInactiveError, loadBootstrap, type BootstrapStore } from "./routes/bootstrap.ts";

export interface AppDeps {
  verify: TokenVerifier;
  store: BootstrapStore;
  corsOrigins: string[];
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

  app.use("/bootstrap", requireAuth(verify));
  app.get("/bootstrap", async (c) => {
    try {
      return c.json(await loadBootstrap(c.get("user"), store));
    } catch (error) {
      if (error instanceof AccountInactiveError) {
        return c.json(
          {
            code: "ACCOUNT_INACTIVE",
            message: "Tài khoản đã nghỉ. Liên hệ quản trị viên để kích hoạt lại.",
          },
          403,
        );
      }
      console.error("[bootstrap]", error);
      return c.json({ code: "INTERNAL", message: "Không tải được dữ liệu. Thử lại sau." }, 500);
    }
  });

  return app;
}
