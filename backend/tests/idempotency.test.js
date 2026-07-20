import assert from "node:assert/strict";
import test from "node:test";
import { createIdempotencyMiddleware } from "../src/middleware/idempotency.js";

function request({ key = "request-key-123", body = { name: "Roy" }, authorization = "Bearer user-a" } = {}) {
  const headers = {
    "idempotency-key": key,
    authorization
  };
  return {
    method: "POST",
    originalUrl: "/api/example",
    body,
    get(name) {
      return headers[name.toLowerCase()];
    }
  };
}

function response() {
  const headers = new Map();
  const listeners = new Map();
  return {
    statusCode: 200,
    writableEnded: false,
    body: undefined,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(name.toLowerCase());
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.setHeader("Content-Type", "application/json; charset=utf-8");
      return this.send(JSON.stringify(value));
    },
    send(value) {
      this.body = value;
      this.writableEnded = true;
      return this;
    },
    on(event, listener) {
      listeners.set(event, listener);
      return this;
    }
  };
}

const nextTurn = () => new Promise((resolve) => setImmediate(resolve));

test("replays a completed write without executing the handler twice", () => {
  const middleware = createIdempotencyMiddleware({ ttlMs: 1000, maxEntries: 10 });
  const firstResponse = response();
  let executions = 0;

  middleware(request(), firstResponse, () => {
    executions += 1;
    firstResponse.status(201).json({ id: "created-once" });
  });

  const replayResponse = response();
  middleware(request(), replayResponse, () => {
    executions += 1;
  });

  assert.equal(executions, 1);
  assert.equal(replayResponse.statusCode, 201);
  assert.equal(replayResponse.body, JSON.stringify({ id: "created-once" }));
  assert.equal(replayResponse.getHeader("Idempotency-Replayed"), "true");
});

test("waits for an in-flight write and shares its response", async () => {
  const middleware = createIdempotencyMiddleware({ ttlMs: 1000, maxEntries: 10 });
  const firstResponse = response();
  const replayResponse = response();
  let executions = 0;

  middleware(request(), firstResponse, () => {
    executions += 1;
  });
  middleware(request(), replayResponse, () => {
    executions += 1;
  });

  assert.equal(executions, 1);
  assert.equal(replayResponse.body, undefined);

  firstResponse.status(202).json({ accepted: true });
  await nextTurn();

  assert.equal(replayResponse.statusCode, 202);
  assert.equal(replayResponse.body, JSON.stringify({ accepted: true }));
});

test("rejects reuse of a key with a different payload", () => {
  const middleware = createIdempotencyMiddleware({ ttlMs: 1000, maxEntries: 10 });
  const firstResponse = response();

  middleware(request(), firstResponse, () => firstResponse.json({ ok: true }));

  const conflictResponse = response();
  middleware(request({ body: { name: "Different" } }), conflictResponse, () => {});

  assert.equal(conflictResponse.statusCode, 409);
  assert.match(conflictResponse.body, /nội dung khác/);
});

test("scopes the same key to the authenticated session", () => {
  const middleware = createIdempotencyMiddleware({ ttlMs: 1000, maxEntries: 10 });
  let executions = 0;

  for (const authorization of ["Bearer user-a", "Bearer user-b"]) {
    const res = response();
    middleware(request({ authorization }), res, () => {
      executions += 1;
      res.json({ authorization });
    });
  }

  assert.equal(executions, 2);
});

test("allows an immediate retry after a server error", () => {
  const middleware = createIdempotencyMiddleware({ ttlMs: 1000, maxEntries: 10 });
  let executions = 0;

  const failedResponse = response();
  middleware(request(), failedResponse, () => {
    executions += 1;
    failedResponse.status(500).json({ message: "temporary" });
  });

  const retryResponse = response();
  middleware(request(), retryResponse, () => {
    executions += 1;
    retryResponse.json({ ok: true });
  });

  assert.equal(executions, 2);
  assert.equal(retryResponse.body, JSON.stringify({ ok: true }));
});
