import assert from "node:assert/strict";
import { test } from "node:test";
import type { PersonInput } from "@roy/shared";
import { bearer, setup, token } from "./testkit.ts";

const owner = async () => ({
  Authorization: `Bearer ${await token({ email: "a@b.c", app_metadata: { role: "owner" } })}`,
});

test("only the owner manages people, always in the group they are viewing", async () => {
  const seen: string[] = [];
  const app = setup({ listGroupPeople: async (groupId) => (seen.push(groupId), []) });
  assert.equal((await app.get(await bearer(), "/admin/people")).status, 403);
  assert.equal((await app.post(await bearer(), "/admin/people", { fullName: "Lan Anh" })).status, 403);
  assert.equal((await app.get(await owner(), "/admin/people")).status, 200);
  assert.deepEqual(seen, ["g1"]);
});

test("adding a person cleans the input and refuses an email already linked to someone", async () => {
  const created: unknown[] = [] as unknown[];
  const app = setup({ createMember: async (groupId, input) => void created.push([groupId, input]) });
  const res = await app.post(await owner(), "/admin/people", {
    fullName: "  Lan   Anh ",
    email: " Lan@Example.com ",
    phone: "0901 234 567",
    attendanceType: "fixed",
    status: "inactive",
  });
  assert.equal(res.status, 201);
  const expected: PersonInput = { fullName: "Lan Anh", nickname: null, email: "lan@example.com", phone: "0901234567", attendanceType: "fixed" };
  assert.deepEqual(created, [["g1", expected]]);

  const taken = setup({ findPersonIdByEmail: async () => "p9", createMember: async () => void (created as unknown[]).push("again") });
  const dup = await taken.post(await owner(), "/admin/people", { fullName: "Lan Anh", email: "lan@example.com" });
  assert.equal(dup.status, 409);
  assert.equal((await dup.json()).code, "EMAIL_TAKEN");
  for (const bad of [{ fullName: "A" }, { fullName: "Lan", email: "lan@" }, { fullName: "Lan", phone: "12ab" }, { fullName: "Lan", attendanceType: "vip" }]) {
    assert.equal((await app.post(await owner(), "/admin/people", bad)).status, 400);
  }
  assert.equal(created.length, 1);
});

test("editing only touches people of the owner's group and keeps their own email allowed", async () => {
  const updated: string[] = [];
  const app = setup({
    getMembershipStatus: async (personId) => (personId === "p9" ? "active" : personId === "wait" ? "pending" : null),
    findPersonIdByEmail: async (email) => (email === "lan@example.com" ? "p9" : email === "x@y.zz" ? "other" : null),
    updatePerson: async (personId) => void updated.push(personId),
  });
  assert.equal((await app.put(await owner(), "/admin/people/p9", { fullName: "Lan", email: "lan@example.com" })).status, 200);
  assert.equal((await app.put(await owner(), "/admin/people/p9", { fullName: "Lan", email: "x@y.zz" })).status, 409);
  assert.equal((await app.put(await owner(), "/admin/people/stranger", { fullName: "Lan" })).status, 404);
  assert.equal((await app.put(await owner(), "/admin/people/wait", { fullName: "Lan" })).status, 404);
  assert.deepEqual(updated, ["p9"]);
});

test("a person can be set to resting or playing again, but the owner cannot rest themself", async () => {
  const changed: string[] = [];
  const app = setup({
    getMembershipStatus: async () => "active",
    setMemberStatus: async (personId, groupId, status) => void changed.push(`${personId}:${groupId}:${status}`),
  });
  assert.equal((await app.put(await owner(), "/admin/people/p9/status", { status: "inactive" })).status, 200);
  // Đã đang chơi thì không ghi lại.
  assert.equal((await app.put(await owner(), "/admin/people/p9/status", { status: "active" })).status, 200);
  assert.equal((await app.put(await owner(), "/admin/people/p9/status", { status: "gone" })).status, 400);
  const self = await app.put(await owner(), "/admin/people/p1/status", { status: "inactive" });
  assert.equal(self.status, 409);
  assert.deepEqual(changed, ["p9:g1:inactive"]);
});
