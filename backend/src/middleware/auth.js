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

export function requireAdmin(req, res, next) {
  if (req.authRole !== "owner" && req.authRole !== "admin") {
    res.status(403).json({
      message: "Admin role is required"
    });
    return;
  }

  next();
}

async function getPersonById(personId) {
  if (!personId) return null;

  const { data, error } = await supabase
    .from("people")
    .select("id, email")
    .eq("id", personId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

function isSameEmail(left, right) {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
}

export function requireSelfPersonOrAdmin(source = "params", key = "personId") {
  return async function selfPersonGuard(req, res, next) {
    if (req.authRole === "owner" || req.authRole === "admin") {
      next();
      return;
    }

    try {
      const personId = source === "body" ? req.body?.[key] : req.params?.[key];
      const person = await getPersonById(personId);

      if (!person || !isSameEmail(person.email, req.authUser?.email)) {
        res.status(403).json({
          message: "Person profile access is denied"
        });
        return;
      }

      next();
    } catch (error) {
      res.status(400).json({
        message: error.message
      });
    }
  };
}

export async function requirePaymentOwnerOrAdmin(req, res, next) {
  if (req.authRole === "owner" || req.authRole === "admin") {
    next();
    return;
  }

  try {
    const { data, error } = await supabase
      .from("payments")
      .select("id, person:people(id, email)")
      .eq("id", req.params.id)
      .maybeSingle();

    if (error) throw error;

    if (!data?.person || !isSameEmail(data.person.email, req.authUser?.email)) {
      res.status(403).json({
        message: "Payment access is denied"
      });
      return;
    }

    next();
  } catch (error) {
    res.status(400).json({
      message: error.message
    });
  }
}
