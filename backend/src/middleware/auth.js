import { supabase } from "../config/supabase.js";

function readBearerToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

export function getUserRole(user) {
  return user?.app_metadata?.role || user?.user_metadata?.role || "user";
}

export async function requireAuth(req, res, next) {
  const token = readBearerToken(req);

  if (!token) {
    res.status(401).json({
      message: "Authentication token is required"
    });
    return;
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    res.status(401).json({
      message: "Authentication token is invalid"
    });
    return;
  }

  req.authUser = data.user;
  req.authRole = getUserRole(data.user);
  next();
}

export function requireOwner(req, res, next) {
  if (req.authRole !== "owner") {
    res.status(403).json({
      message: "Owner role is required"
    });
    return;
  }

  next();
}
