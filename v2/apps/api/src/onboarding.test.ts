import assert from "node:assert/strict";
import { test } from "node:test";
import { bearer, person, setup } from "./testkit.ts";

test("an invite code reveals only the group name", async () => {
  const { post } = setup();
  const ok = await post(await bearer(), "/onboarding/check-invite", { code: " royclub " });
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { groupName: "Roy moi" });
  assert.equal((await post(await bearer(), "/onboarding/check-invite", { code: "WRONG1" })).status, 404);
  assert.equal((await post(await bearer(), "/onboarding/check-invite", { code: "a%" })).status, 400);
  assert.equal((await post({}, "/onboarding/check-invite", { code: "ROYCLUB" })).status, 401);
});

test("a new account joins with a pending profile under its own signed-in email", async () => {
  const created: unknown[] = [];
  const { post } = setup({
    findPerson: async () => null,
    createPendingPerson: async (input) => void created.push(input),
  });
  const missingName = await post(await bearer("New@B.c"), "/onboarding/join", { code: "ROYCLUB" });
  assert.equal(missingName.status, 400);
  assert.equal(created.length, 0);
  const res = await post(await bearer("New@B.c"), "/onboarding/join", {
    code: "ROYCLUB",
    fullName: "  Lan   Anh ",
    email: "evil@x.y",
  });
  assert.equal(res.status, 200);
  assert.deepEqual(created, [{ email: "new@b.c", fullName: "Lan Anh", groupId: "g3" }]);
});

test("an existing profile asks to join as pending, never twice and never past three groups", async () => {
  const requested: string[] = [];
  const ok = setup({ requestMembership: async (personId, groupId) => void requested.push(`${personId}:${groupId}`) });
  assert.equal((await ok.post(await bearer(), "/onboarding/join", { code: "ROYCLUB" })).status, 200);
  assert.deepEqual(requested, ["p1:g3"]);

  const already = setup({
    findPerson: async () => ({
      ...person,
      person_groups: [{ group_id: "g3", status: "pending", member_role: "member", groups: null }],
    }),
    requestMembership: async () => void requested.push("again"),
  });
  const twice = await already.post(await bearer(), "/onboarding/join", { code: "ROYCLUB" });
  assert.equal(twice.status, 409);
  assert.equal((await twice.json()).code, "ALREADY_MEMBER");

  const row = (group_id: string) => ({ group_id, status: "active" as const, member_role: "member" as const, groups: null });
  const full = setup({
    findPerson: async () => ({ ...person, person_groups: [row("a"), row("b"), row("c")] }),
    requestMembership: async () => void requested.push("too many"),
  });
  const tooMany = await full.post(await bearer(), "/onboarding/join", { code: "ROYCLUB" });
  assert.equal(tooMany.status, 409);
  assert.equal((await tooMany.json()).code, "TOO_MANY_GROUPS");
  assert.deepEqual(requested, ["p1:g3"]);
});

test("an inactive account cannot join a group", async () => {
  const { post } = setup({ findPerson: async () => ({ ...person, status: "inactive" }) });
  assert.equal((await post(await bearer(), "/onboarding/join", { code: "ROYCLUB" })).status, 403);
});

test("switching group only accepts a group where the caller is active", async () => {
  const switched: string[] = [];
  const { put } = setup({ setActiveGroup: async (personId, groupId) => void switched.push(`${personId}:${groupId}`) });
  assert.equal((await put(await bearer(), "/me/active-group", { groupId: "g2" })).status, 403);
  assert.equal((await put(await bearer(), "/me/active-group", { groupId: "nope" })).status, 403);
  assert.equal((await put(await bearer(), "/me/active-group", { groupId: "g1" })).status, 200);
  assert.deepEqual(switched, ["p1:g1"]);
});

test("deleting notifications touches only the caller, one or all", async () => {
  const seen: unknown[] = [];
  const { del } = setup({ deleteNotifications: async (personId, id) => void seen.push([personId, id]) });
  assert.equal((await del(await bearer(), "/me/notifications/n1")).status, 200);
  assert.equal((await del(await bearer(), "/me/notifications")).status, 200);
  assert.equal((await del({}, "/me/notifications")).status, 401);
  assert.deepEqual(seen, [["p1", "n1"], ["p1", null]]);
});

const webp = () => {
  const bytes = new Uint8Array(64);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  return bytes;
};

test("an avatar is checked by its content, stored under the caller id and saved on the profile", async () => {
  const saved: string[] = [];
  const { upload } = setup({ setAvatarUrl: async (personId, url) => void saved.push(`${personId}|${url}`) });
  // Content-Type khai sai (png) nhưng nội dung là WebP: lưu theo nội dung.
  const res = await upload(await bearer(), "/me/avatar", webp(), "image/png");
  assert.equal(res.status, 200);
  assert.deepEqual(saved, ["p1|https://cdn/avatars/p1.webp"]);
});

test("a fake, empty or oversized avatar is refused before upload", async () => {
  let uploads = 0;
  const { upload } = setup({
    uploadAvatar: async () => {
      uploads++;
      return "";
    },
  });
  const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
  assert.equal((await upload(await bearer(), "/me/avatar", html, "image/webp")).status, 415);
  assert.equal((await upload(await bearer(), "/me/avatar", new Uint8Array(0))).status, 400);
  const big = new Uint8Array(2 * 1024 * 1024 + 1);
  big.set(webp());
  assert.equal((await upload(await bearer(), "/me/avatar", big)).status, 413);
  assert.equal(uploads, 0);
});

test("the arena lists everyone's matches in the period except cancelled ones", async () => {
  const match = (id: string, status: string) => ({
    id,
    status,
    type: "singles" as const,
    playedAt: "2026-11-12",
    sets: 1,
    challengers: [{ id: "x", name: "X", avatarUrl: null }],
    opponents: [{ id: "y", name: "Y", avatarUrl: null }],
    winnerSide: null,
    setScores: null,
    voided: false,
  });
  const { get } = setup({
    listPeriodMatches: async () => [match("a", "pending"), match("b", "cancelled"), match("c", "completed")],
  });
  const body = await (await get(await bearer(), "/me/arena")).json();
  assert.deepEqual(body.periodMatches.map((m: { id: string }) => m.id), ["a", "c"]);
  assert.equal(body.myMatches.length, 0);
});
