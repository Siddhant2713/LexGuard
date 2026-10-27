import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";

// Thin client over the Razorpay REST API (https://razorpay.com/docs/api/). Only the handful
// of calls billing needs, so no SDK dependency.
const API = "https://api.razorpay.com/v1";

async function call(method, path, body) {
  const auth = Buffer.from(`${config.razorpayKeyId}:${config.razorpayKeySecret}`).toString("base64");
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(data?.error?.description || `Razorpay ${method} ${path} failed (${res.status})`), {
      status: res.status,
    });
  }
  return data;
}

export const createOrder = ({ amount, currency, receipt, notes }) =>
  call("POST", "/orders", { amount, currency, receipt, notes });

export const fetchPayment = (paymentId) => call("GET", `/payments/${encodeURIComponent(paymentId)}`);

export const capturePayment = (paymentId, amount, currency) =>
  call("POST", `/payments/${encodeURIComponent(paymentId)}/capture`, { amount, currency });

// ─── Signatures ──────────────────────────────────────────────────────────────

const hmacHex = (secret, data) => createHmac("sha256", secret).update(data).digest("hex");

function safeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

// Checkout success handler: signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret).
export const isValidPaymentSignature = (orderId, paymentId, signature) =>
  safeEqualHex(hmacHex(config.razorpayKeySecret, `${orderId}|${paymentId}`), signature);

// Webhooks: X-Razorpay-Signature = HMAC_SHA256(raw request body, webhook secret).
export const isValidWebhookSignature = (rawBody, signature) =>
  safeEqualHex(hmacHex(config.razorpayWebhookSecret, rawBody), signature);
