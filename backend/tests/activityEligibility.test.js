import test from "node:test";
import assert from "node:assert/strict";
import { createActivityEligibility } from "../src/utils/activityEligibility.js";

test("eligibility uses Auth roles, not names; preserves history and supports offline members", async () => {
  const annotate = createActivityEligibility(async () => ({ data: { users: [
    { email: "ADMIN@example.com", app_metadata: { role: "admin" } },
    { email: "owner@example.com", app_metadata: { role: "owner" } },
    { email: "member@example.com", app_metadata: { role: "user" }, user_metadata: { role: "admin" } },
    { email: "legacy@example.com", user_metadata: { role: "admin" } }
  ] } }));
  const people = [
    { email: " admin@example.com ", status: "active" },
    { email: "owner@example.com", status: "active" },
    { email: "member@example.com", status: "active" },
    { full_name: "Admin", status: "active" },
    { email: "legacy@example.com", status: "active" },
    { status: "inactive" }, { status: "pending" }
  ];
  const result = await annotate(people);
  assert.equal(result.length, people.length);
  assert.deepEqual(result.map((p) => p.activity_eligible), [false, false, true, true, true, false, false]);
  assert.equal(people[0].account_role, undefined);
});

test("roles on later Auth pages are checked and refreshed on every request", async () => {
  let role = "admin";
  const pages = [];
  const annotate = createActivityEligibility(async ({ page }) => {
    pages.push(page);
    return { data: { users: page === 1
      ? Array.from({ length: 100 }, (_, i) => ({ email: `${i}@example.com` }))
      : [{ email: "target@example.com", app_metadata: { role } }] } };
  });
  const people = [{ email: "target@example.com", status: "active" }];
  assert.equal((await annotate(people))[0].activity_eligible, false);
  role = "user";
  assert.equal((await annotate(people))[0].activity_eligible, true);
  assert.deepEqual(pages, [1, 2, 1, 2]);
});

test("Auth lookup failure does not silently allow a player", async () => {
  const annotate = createActivityEligibility(async () => ({ error: { message: "unavailable" } }));
  await assert.rejects(annotate([{ status: "active" }]), /Không thể kiểm tra/);
});
