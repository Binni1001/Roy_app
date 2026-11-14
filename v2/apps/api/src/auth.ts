import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { MiddlewareHandler } from "hono";

export type GlobalRole = "owner" | "admin" | "user";

export interface AuthUser {
  id: string;
  email: string;
  /** Vai trò toàn hệ thống. Chỉ đọc từ app_metadata do máy chủ quản lý. */
  role: GlobalRole;
}

export type AuthEnv = { Variables: { user: AuthUser } };

const ROLES: readonly GlobalRole[] = ["owner", "admin", "user"];

export function userFromClaims(claims: JWTPayload): AuthUser | null {
  const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  if (!claims.sub || !email) return null;
  const meta = claims.app_metadata as { role?: unknown } | undefined;
  const role = ROLES.find((r) => r === meta?.role) ?? "user";
  return { id: claims.sub, email, role };
}

export type TokenVerifier = (token: string) => Promise<JWTPayload>;

/**
 * Kiểm tra JWT của Supabase ngay tại máy chủ, không gọi mạng cho từng yêu cầu.
 * Khóa công khai (JWKS) được jose tải một lần rồi giữ trong bộ nhớ.
 */
export function createTokenVerifier(env: {
  SUPABASE_URL?: string;
  SUPABASE_JWT_SECRET?: string;
}): TokenVerifier {
  if (!env.SUPABASE_URL) throw new Error("SUPABASE_URL is required");
  const issuer = `${env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1`;
  const options = { issuer, audience: "authenticated" };

  if (env.SUPABASE_JWT_SECRET) {
    const secret = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);
    return async (token) =>
      (await jwtVerify(token, secret, { ...options, algorithms: ["HS256"] })).payload;
  }

  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  return async (token) => (await jwtVerify(token, jwks, options)).payload;
}

export function requireAuth(verify: TokenVerifier): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    const [scheme, token] = (c.req.header("Authorization") ?? "").split(" ");
    if (scheme !== "Bearer" || !token) {
      return c.json({ code: "UNAUTHENTICATED", message: "Cần đăng nhập." }, 401);
    }
    let user: AuthUser | null = null;
    try {
      user = userFromClaims(await verify(token));
    } catch {
      user = null;
    }
    if (!user) {
      return c.json(
        { code: "UNAUTHENTICATED", message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn." },
        401,
      );
    }
    c.set("user", user);
    await next();
  };
}
