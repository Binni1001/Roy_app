import assert from "node:assert/strict";
import { test } from "node:test";
import { parseProfileInput, ValidationError } from "./profile.ts";

test("text is trimmed, inner spaces collapsed and blanks become null", () => {
  assert.deepEqual(parseProfileInput({ fullName: "  Nguyen   Van  A ", nickname: "  ", phone: "", bio: " hi " }), {
    fullName: "Nguyen Van A",
    nickname: null,
    phone: null,
    bio: "hi",
  });
});

test("phone separators are removed and the digits kept", () => {
  assert.equal(parseProfileInput({ fullName: "An", phone: "090 123.45-67" }).phone, "0901234567");
  assert.equal(parseProfileInput({ fullName: "An", phone: "+84901234567" }).phone, "+84901234567");
});

test("only the four display fields are ever returned", () => {
  const parsed = parseProfileInput({ fullName: "An", status: "active", email: "x@y.z", attendance_type: "fixed", group_id: "g" });
  assert.deepEqual(Object.keys(parsed).sort(), ["bio", "fullName", "nickname", "phone"]);
});

test("invalid input is rejected with a message", () => {
  for (const body of [null, [], "x", {}, { fullName: "A" }, { fullName: 5 }, { fullName: "An", phone: "abc" },
    { fullName: "An", phone: "123" }, { fullName: "x".repeat(81) }, { fullName: "An", nickname: "y".repeat(31) },
    { fullName: "An", bio: "z".repeat(301) }]) {
    assert.throws(() => parseProfileInput(body), ValidationError);
  }
});
