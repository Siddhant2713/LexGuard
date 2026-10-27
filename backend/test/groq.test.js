import { test } from "node:test";
import assert from "node:assert/strict";

// 60k tokens/min → 54k usable after the 10% margin, refilling at 0.9 tokens/ms.
process.env.GROQ_TPM = "60000";
process.env.GROQ_API_KEY ??= "test";
const { reserveTokens } = await import("../src/services/groq.js");

test("token bucket: admits within budget immediately, then waits only for the shortfall", async () => {
  const model = "bucket-a";
  const t0 = Date.now();
  await reserveTokens(model, 0, 54_000); // drains the bucket
  assert.ok(Date.now() - t0 < 50);

  const t1 = Date.now();
  await reserveTokens(model, 0, 90); // 90 tokens at 0.9/ms ≈ 100ms, not a full minute
  const waited = Date.now() - t1;
  assert.ok(waited >= 90 && waited < 1000, `waited ${waited}ms`);
});

test("token bucket: unused reservation is refunded on settle", async () => {
  const model = "bucket-b";
  const r = await reserveTokens(model, 0, 54_000);
  r.settle(0); // e.g. a 429: nothing was spent
  const t0 = Date.now();
  await reserveTokens(model, 0, 50_000);
  assert.ok(Date.now() - t0 < 50);
});

test("token bucket: models have separate budgets", async () => {
  await reserveTokens("bucket-c", 0, 54_000);
  const t0 = Date.now();
  await reserveTokens("bucket-d", 0, 54_000);
  assert.ok(Date.now() - t0 < 50);
});
