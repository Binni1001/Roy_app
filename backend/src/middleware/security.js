const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173"
];

function parseOrigins(value = "") {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function getAllowedOrigins() {
  const configuredOrigins = parseOrigins(process.env.CORS_ORIGINS);
  const frontendUrl = process.env.FRONTEND_URL;

  return [
    ...defaultOrigins,
    ...(frontendUrl ? [frontendUrl] : []),
    ...configuredOrigins
  ];
}

export function corsOptions() {
  const allowedOrigins = getAllowedOrigins();

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin is not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400
  };
}

export function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  next();
}

function clientKey(req, scope) {
  const forwardedFor = req.headers["x-forwarded-for"];
  const firstForwardedIp =
    typeof forwardedFor === "string" ? forwardedFor.split(",")[0].trim() : "";
  const ip = firstForwardedIp || req.ip || req.socket?.remoteAddress || "unknown";

  return `${scope}:${ip}`;
}

export function createRateLimiter({
  windowMs = 60_000,
  max = 120,
  scope = "default",
  methods = null,
  message = "Too many requests. Please try again later."
} = {}) {
  const hits = new Map();

  return function rateLimiter(req, res, next) {
    if (methods && !methods.includes(req.method)) {
      next();
      return;
    }

    const now = Date.now();
    const key = clientKey(req, scope);
    const current = hits.get(key);

    if (!current || current.resetAt <= now) {
      hits.set(key, {
        count: 1,
        resetAt: now + windowMs
      });
      next();
      return;
    }

    current.count += 1;

    if (current.count > max) {
      const retryAfter = Math.ceil((current.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        message,
        retry_after_seconds: retryAfter
      });
      return;
    }

    hits.set(key, current);

    if (Math.random() < 0.01) {
      for (const [hitKey, value] of hits.entries()) {
        if (value.resetAt <= now) {
          hits.delete(hitKey);
        }
      }
    }

    next();
  };
}

export const generalApiLimiter = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_API_PER_MINUTE || 300),
  scope: "api",
  message: "Too many API requests. Please slow down."
});

export const writeApiLimiter = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_WRITE_PER_MINUTE || 80),
  scope: "write",
  methods: ["POST", "PUT", "DELETE"],
  message: "Too many write requests. Please slow down."
});

export const paymentLimiter = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_PAYMENT_PER_MINUTE || 10),
  scope: "payment",
  methods: ["POST", "PUT"],
  message: "Too many payment requests. Please wait before trying again."
});

export const webhookLimiter = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_WEBHOOK_PER_MINUTE || 120),
  scope: "webhook",
  methods: ["POST"],
  message: "Too many webhook requests."
});
