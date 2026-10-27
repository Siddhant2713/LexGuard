import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

process.env.RAZORPAY_KEY_SECRET = "key_secret_for_tests";
process.env.RAZORPAY_WEBHOOK_SECRET = "webhook_secret_for_tests";
const { isValidPaymentSignature, isValidWebhookSignature } = await import("../src/services/razorpay.js");
const { currentPeriod, periodResetsAt } = await import("../src/services/plans.js");
const { VerifyPaymentInput } = await import("../src/lib/schemas.js");

const hmac = (secret, data) => createHmac("sha256", secret).update(data).digest("hex");

test("checkout signature: HMAC of order_id|payment_id with the key secret", () => {
  const sig = hmac("key_secret_for_tests", "order_ABC|pay_XYZ");
  assert.ok(isValidPaymentSignature("order_ABC", "pay_XYZ", sig));
  assert.ok(!isValidPaymentSignature("order_ABC", "pay_OTHER", sig));
  assert.ok(!isValidPaymentSignature("order_ABC", "pay_XYZ", hmac("wrong", "order_ABC|pay_XYZ")));
  assert.ok(!isValidPaymentSignature("order_ABC", "pay_XYZ", sig.slice(0, 10)));
  assert.ok(!isValidPaymentSignature("order_ABC", "pay_XYZ", undefined));
});

test("webhook signature covers the exact raw body", () => {
  const body = Buffer.from('{"event":"order.paid"}');
  const sig = hmac("webhook_secret_for_tests", body);
  assert.ok(isValidWebhookSignature(body, sig));
  assert.ok(!isValidWebhookSignature(Buffer.from('{"event": "order.paid"}'), sig));
  assert.ok(!isValidWebhookSignature(body, undefined));
});

test("verify input only accepts Razorpay-shaped ids", () => {
  const ok = { razorpay_order_id: "order_Abc123XYZ", razorpay_payment_id: "pay_Abc123XYZ", razorpay_signature: "a".repeat(64) };
  assert.ok(VerifyPaymentInput.safeParse(ok).success);
  assert.ok(!VerifyPaymentInput.safeParse({ ...ok, razorpay_order_id: { $gt: "" } }).success);
  assert.ok(!VerifyPaymentInput.safeParse({ ...ok, extra: 1 }).success);
  assert.ok(!VerifyPaymentInput.safeParse({ ...ok, razorpay_signature: "zz" }).success);
});

test("free allowance resets on the first of the next UTC month", () => {
  const now = new Date("2026-12-31T23:30:00Z");
  assert.equal(currentPeriod(now), "2026-12");
  assert.equal(periodResetsAt(now).toISOString(), "2027-01-01T00:00:00.000Z");
});
