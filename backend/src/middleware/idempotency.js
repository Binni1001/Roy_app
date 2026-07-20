import { createHash } from "node:crypto";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 1000;
const KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

function hash(value) {
  return createHash("sha256").update(value).digest("base64url");
}

function fingerprintRequest(req) {
  return hash(JSON.stringify({
    method: req.method,
    path: req.originalUrl,
    body: req.body ?? null
  }));
}

function replay(res, response) {
  res.setHeader("Idempotency-Replayed", "true");
  if (response.contentType) {
    res.setHeader("Content-Type", response.contentType);
  }
  res.status(response.statusCode).send(response.body);
}

export function createIdempotencyMiddleware({
  ttlMs = Number(process.env.IDEMPOTENCY_TTL_MS || DEFAULT_TTL_MS),
  maxEntries = Number(process.env.IDEMPOTENCY_MAX_ENTRIES || DEFAULT_MAX_ENTRIES)
} = {}) {
  const entries = new Map();

  function cleanup(now) {
    for (const [key, entry] of entries.entries()) {
      if (entry.state === "completed" && entry.expiresAt <= now) {
        entries.delete(key);
      }
    }

    if (entries.size < maxEntries) return;

    const completed = [...entries.entries()]
      .filter(([, entry]) => entry.state === "completed")
      .sort((a, b) => a[1].expiresAt - b[1].expiresAt);

    for (const [key] of completed) {
      entries.delete(key);
      if (entries.size < maxEntries) break;
    }
  }

  return function idempotencyMiddleware(req, res, next) {
    if (!WRITE_METHODS.has(req.method)) {
      next();
      return;
    }

    const idempotencyKey = req.get("Idempotency-Key");
    if (!idempotencyKey) {
      next();
      return;
    }

    if (!KEY_PATTERN.test(idempotencyKey)) {
      res.status(400).json({ message: "Idempotency-Key không hợp lệ." });
      return;
    }

    const now = Date.now();
    cleanup(now);

    const authScope = hash(req.get("Authorization") || "anonymous");
    const storeKey = `${authScope}:${idempotencyKey}`;
    const fingerprint = fingerprintRequest(req);
    const existing = entries.get(storeKey);

    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        res.status(409).json({
          message: "Khóa thao tác đã được sử dụng cho một nội dung khác."
        });
        return;
      }

      if (existing.state === "completed") {
        replay(res, existing.response);
        return;
      }

      existing.promise.then((response) => {
        if (!response) {
          res.status(503).json({ message: "Thao tác trước chưa hoàn tất. Vui lòng thử lại." });
          return;
        }
        replay(res, response);
      });
      return;
    }

    if (entries.size >= maxEntries) {
      next();
      return;
    }

    let resolvePending;
    const promise = new Promise((resolve) => {
      resolvePending = resolve;
    });
    const entry = { state: "pending", fingerprint, promise };
    entries.set(storeKey, entry);

    const originalSend = res.send.bind(res);
    let captured = false;

    res.send = (body) => {
      if (!captured) {
        captured = true;
        const response = {
          statusCode: res.statusCode,
          contentType: res.getHeader("Content-Type") || null,
          body
        };
        entry.state = "completed";
        entry.response = response;
        entry.expiresAt = Date.now() + ttlMs;
        resolvePending(response);
        if (response.statusCode >= 500) entries.delete(storeKey);
      }
      return originalSend(body);
    };

    res.on("close", () => {
      if (!captured && !res.writableEnded) {
        entries.delete(storeKey);
        resolvePending(null);
      }
    });

    next();
  };
}

export const idempotencyMiddleware = createIdempotencyMiddleware();
