import { test } from "node:test";
import assert from "node:assert/strict";
import { RegisterInput, LoginInput } from "../src/lib/authSchemas.js";

const ok = { name: "Jane O'Neil-Smith", email: "  Jane@Example.COM ", password: "hunter2hunter2" };

test("register normalises email and trims name", () => {
  const r = RegisterInput.parse({ ...ok, name: "  Jane  " });
  assert.equal(r.email, "jane@example.com");
  assert.equal(r.name, "Jane");
});

test("accepts non-latin names", () => {
  assert.ok(RegisterInput.safeParse({ ...ok, name: "सिद्धांत" }).success);
});

for (const bad of ['<script>alert(1)</script>', 'Jane<img src=x onerror=alert(1)>', '"; DROP TABLE', "javascript:alert(1)", "a&b", "`x`"]) {
  test(`rejects markup/injection in name: ${bad}`, () => {
    assert.ok(!RegisterInput.safeParse({ ...ok, name: bad }).success);
  });
}

test("rejects NoSQL operator objects for email/password", () => {
  assert.ok(!LoginInput.safeParse({ email: { $gt: "" }, password: "x" }).success);
  assert.ok(!LoginInput.safeParse({ email: "a@b.co", password: { $ne: null } }).success);
});

test("rejects unknown fields (mass assignment)", () => {
  assert.ok(!RegisterInput.safeParse({ ...ok, role: "admin" }).success);
  assert.ok(!RegisterInput.safeParse({ ...ok, token_version: 9 }).success);
});

test("password rules", () => {
  const p = (password) => RegisterInput.safeParse({ ...ok, password }).success;
  assert.ok(!p("short1"));
  assert.ok(!p("allletterslong"));
  assert.ok(!p("1234567890"));
  assert.ok(!p("a1".repeat(40))); // > 72 bytes
  assert.ok(!p("abcdefg1\u0000"));
  assert.ok(p("correct horse 9"));
});

test("rejects bad emails", () => {
  for (const email of ["nope", "a@b", "a@b.com\nBcc: x@y.z", `${"a".repeat(250)}@b.com`]) {
    assert.ok(!LoginInput.safeParse({ email, password: "x" }).success, email);
  }
});
