// Plans, payments, sharing and compare against a real MongoDB, with Razorpay and Groq faked.
// Skipped unless TEST_MONGODB_URI is set; uses its own database next to the one given.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import http from "node:http";
import mongoose from "mongoose";

const uri = process.env.TEST_MONGODB_URI;
const skip = !uri && "TEST_MONGODB_URI not set";

const KEY_SECRET = "rzp_test_secret_for_tests";
const WEBHOOK_SECRET = "rzp_webhook_secret_for_tests";
const DAY = 24 * 60 * 60 * 1000;
const pw = "correct horse 9";

let base, server, groqServer, User, Session, Chunk, Payment, Usage, claimUpload;

// ─── Fake Razorpay (intercepts fetch to api.razorpay.com) ────────────────────
const rzp = { orders: new Map(), payments: new Map(), calls: [], seq: 0 };
const realFetch = globalThis.fetch;
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function fakeRazorpay(url, init = {}) {
  const path = new URL(url).pathname.replace(/^\/v1/, "");
  const body = init.body ? JSON.parse(init.body) : null;
  rzp.calls.push({ method: init.method, path, body });
  if (init.method === "POST" && path === "/orders") {
    const order = { id: `order_T${++rzp.seq}x0000`, amount: body.amount, currency: body.currency, status: "created" };
    rzp.orders.set(order.id, order);
    return json(200, order);
  }
  const m = path.match(/^\/payments\/([^/]+)(\/capture)?$/);
  const p = m && rzp.payments.get(m[1]);
  if (!p) return json(400, { error: { description: "The id provided does not exist" } });
  if (m[2]) {
    if (p.status !== "authorized") return json(400, { error: { description: "This payment has already been captured" } });
    p.status = "captured";
  }
  return json(200, p);
}

/** A payment as Razorpay would hold it, and the signature Checkout would hand the browser. */
function pay(orderId, overrides = {}) {
  const order = rzp.orders.get(orderId);
  const payment = { id: `pay_T${++rzp.seq}x0000`, order_id: orderId, amount: order.amount, currency: order.currency, status: "captured", method: "upi", amount_refunded: 0, ...overrides };
  rzp.payments.set(payment.id, payment);
  const signature = createHmac("sha256", KEY_SECRET).update(`${orderId}|${payment.id}`).digest("hex");
  return { payment, confirm: { razorpay_order_id: orderId, razorpay_payment_id: payment.id, razorpay_signature: signature } };
}

before(async () => {
  if (skip) return;
  const dbUri = new URL(uri);
  dbUri.pathname = "/lexguard_billing_test";
  process.env.MONGODB_URI = dbUri.toString();
  process.env.GROQ_API_KEY ??= "test";
  process.env.JWT_SECRET ??= "x".repeat(48);
  process.env.ALLOWED_ORIGINS = "http://localhost:3000";
  process.env.RAZORPAY_KEY_ID = "rzp_test_key";
  process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;

  // Groq stand-in: every completion is a compare verdict.
  groqServer = http.createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      const content = JSON.stringify({ verdict: "better", summary: "The revised non-compete is much narrower.", changes: [{ key: "r1", impact: "better", note: "Six months instead of twenty-four." }] });
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ id: "x", object: "chat.completion", choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }], usage: { total_tokens: 50 } }));
    });
  }).listen(0);
  process.env.GROQ_BASE_URL = `http://127.0.0.1:${groqServer.address().port}`;

  globalThis.fetch = (url, init) => (String(url).startsWith("https://api.razorpay.com/") ? fakeRazorpay(String(url), init) : realFetch(url, init));

  const { connectMongo } = await import("../src/lib/mongo.js");
  await connectMongo();
  await mongoose.connection.dropDatabase();
  await mongoose.syncIndexes();
  ({ User } = await import("../src/models/User.js"));
  ({ Session, Chunk, Payment, Usage } = await import("../src/models/index.js"));
  ({ claimUpload } = await import("../src/services/plans.js"));
  const { createApp } = await import("../src/app.js");
  server = createApp().listen(0);
  base = `http://localhost:${server.address().port}`;
});

after(async () => {
  if (skip) return;
  globalThis.fetch = realFetch;
  server.close();
  groqServer.close();
  await mongoose.disconnect();
});

const client = () => {
  let cookie = "";
  return async (path, { method = "GET", body, headers = {} } = {}) => {
    const res = await realFetch(base + path, {
      method,
      headers: { "content-type": "application/json", ...(cookie && { cookie }), ...headers },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return { res, json: await res.json().catch(() => null) };
  };
};

async function signUp(name) {
  const c = client();
  await c("/auth/register", { method: "POST", body: { name, email: `${name.toLowerCase()}@example.com`, password: pw } });
  return c;
}

const webhook = (event, payment, secret = WEBHOOK_SECRET) => {
  const raw = JSON.stringify({ event, payload: { payment: { entity: payment } } });
  return realFetch(`${base}/billing/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-razorpay-signature": createHmac("sha256", secret).update(raw).digest("hex") },
    body: raw,
  });
};

const proDaysLeft = async (email) => {
  const u = await User.findOne({ email });
  return u.pro_until ? Math.round((u.pro_until - Date.now()) / DAY) : 0;
};

// ─── Payments ────────────────────────────────────────────────────────────────

test("order amount is fixed by the server, whatever the client sends", { skip }, async () => {
  const c = await signUp("Payer");
  const { res, json } = await c("/billing/order", { method: "POST", body: { amount: 1, currency: "USD" } });
  assert.equal(res.status, 201);
  assert.equal(json.amount, 49_900);
  assert.equal(json.currency, "INR");
  assert.equal(rzp.calls.at(-1).body.amount, 49_900);
  const row = await Payment.findOne({ order_id: json.order_id });
  assert.equal(row.status, "created");
  assert.equal((await c("/auth/me")).json.user.plan, "free");
});

test("a forged signature grants nothing", { skip }, async () => {
  const c = await signUp("Forger");
  const { json: order } = await c("/billing/order", { method: "POST" });
  const { confirm } = pay(order.order_id);
  const { res } = await c("/billing/verify", { method: "POST", body: { ...confirm, razorpay_signature: "0".repeat(64) } });
  assert.equal(res.status, 400);
  assert.equal(await proDaysLeft("forger@example.com"), 0);
});

test("a payment for the wrong amount grants nothing", { skip }, async () => {
  const c = await signUp("Cheap");
  const { json: order } = await c("/billing/order", { method: "POST" });
  const { confirm } = pay(order.order_id, { amount: 100 });
  const { res } = await c("/billing/verify", { method: "POST", body: confirm });
  assert.equal(res.status, 402);
  assert.equal(await proDaysLeft("cheap@example.com"), 0);
});

test("one account can't claim another account's order", { skip }, async () => {
  const owner = await signUp("Owner");
  const thief = await signUp("Thief");
  const { json: order } = await owner("/billing/order", { method: "POST" });
  const { confirm } = pay(order.order_id);
  assert.equal((await thief("/billing/verify", { method: "POST", body: confirm })).res.status, 400);
  assert.equal(await proDaysLeft("thief@example.com"), 0);
});

test("verify grants 30 days once, however often it and the webhook repeat", { skip }, async () => {
  const c = await signUp("Alice");
  const { json: order } = await c("/billing/order", { method: "POST" });
  const { payment, confirm } = pay(order.order_id);

  const first = await c("/billing/verify", { method: "POST", body: confirm });
  assert.equal(first.res.status, 200);
  assert.equal(first.json.user.plan, "pro");
  assert.equal(await proDaysLeft("alice@example.com"), 30);

  await Promise.all([c("/billing/verify", { method: "POST", body: confirm }), webhook("payment.captured", payment), webhook("order.paid", payment)]);
  assert.equal(await proDaysLeft("alice@example.com"), 30);
  assert.equal((await Payment.findOne({ order_id: order.order_id })).status, "paid");
});

test("webhook alone settles a payment (browser closed early), and passes stack", { skip }, async () => {
  const c = client();
  await c("/auth/login", { method: "POST", body: { email: "alice@example.com", password: pw } });
  const { json: order } = await c("/billing/order", { method: "POST" });
  const { payment } = pay(order.order_id, { status: "authorized" });

  assert.equal((await webhook("payment.authorized", payment, "wrong-secret")).status, 400);
  assert.equal(await proDaysLeft("alice@example.com"), 30);

  assert.equal((await webhook("payment.authorized", payment)).status, 200);
  assert.equal(rzp.payments.get(payment.id).status, "captured"); // we captured it
  assert.equal(await proDaysLeft("alice@example.com"), 60);
});

test("a full refund takes the order's days back, once", { skip }, async () => {
  const [row] = await Payment.find({ status: "paid", user_id: (await User.findOne({ email: "alice@example.com" }))._id }).sort({ createdAt: -1 });
  const refunded = { ...rzp.payments.get(row.payment_id), amount_refunded: row.amount };
  assert.equal((await webhook("refund.processed", refunded)).status, 200);
  assert.equal((await webhook("refund.processed", refunded)).status, 200);
  assert.equal(await proDaysLeft("alice@example.com"), 30);
  assert.equal((await Payment.findById(row._id)).status, "refunded");
});

test("billing status shows plan, history and no free allowance for Pro", { skip }, async () => {
  const c = client();
  await c("/auth/login", { method: "POST", body: { email: "alice@example.com", password: pw } });
  const { json } = await c("/billing");
  assert.equal(json.user.plan, "pro");
  assert.equal(json.usage, null);
  assert.deepEqual(json.payments.map((p) => p.status).sort(), ["paid", "refunded"]);
  assert.equal(json.price.amount, 49_900);
});

// ─── Free plan limits ────────────────────────────────────────────────────────

test("free uploads are capped per month, even under concurrency", { skip }, async () => {
  await signUp("Racer");
  const user = await User.findOne({ email: "racer@example.com" });
  const results = await Promise.allSettled(Array.from({ length: 6 }, () => claimUpload(user)));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 3);
  assert.ok(results.filter((r) => r.status === "rejected").every((r) => r.reason.code === "QUOTA_EXCEEDED"));
});

test("a 4th upload is refused with 402; a failed upload doesn't use up the allowance", { skip }, async () => {
  await signUp("Uploader");
  const user = await User.findOne({ email: "uploader@example.com" });
  // Multipart, so this skips the JSON client: fetch must set the boundary itself.
  const login = await realFetch(`${base}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "uploader@example.com", password: pw }) });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const post = () => {
    const form = new FormData();
    form.append("file", new Blob(["%PDF-1.4 not really a pdf"]), "broken.pdf");
    return realFetch(`${base}/upload`, { method: "POST", headers: { cookie }, body: form });
  };

  assert.equal((await post()).status, 422); // unparseable
  assert.equal((await Usage.findOne({ user_id: user._id }))?.uploads ?? 0, 0);

  await Usage.updateOne({ user_id: user._id, period: new Date().toISOString().slice(0, 7) }, { uploads: 3 }, { upsert: true });
  const refused = await post();
  assert.equal(refused.status, 402);
  assert.equal((await refused.json()).code, "QUOTA_EXCEEDED");
});

test("Pro features answer 402 PRO_REQUIRED on the free plan", { skip }, async () => {
  const c = await signUp("Freeloader");
  const user = await User.findOne({ email: "freeloader@example.com" });
  await Session.create({ session_id: "sess-free", user_id: user._id, filename: "f.pdf", aggregation: { overall_risk: "low", risk_score: 1 } });
  for (const [method, path, body] of [
    ["POST", "/contracts/sess-free/share"],
    ["POST", "/compare", { base_session_id: crypto.randomUUID(), revised_session_id: crypto.randomUUID() }],
    ["GET", "/comparisons"],
  ]) {
    const { res, json } = await c(path, { method, body });
    assert.equal(res.status, 402, path);
    assert.equal(json.code, "PRO_REQUIRED");
  }
});

// ─── Sharing ─────────────────────────────────────────────────────────────────

test("share links are public, read-only, revocable, and die when Pro lapses", { skip }, async () => {
  const c = client();
  await c("/auth/login", { method: "POST", body: { email: "alice@example.com", password: pw } });
  const alice = await User.findOne({ email: "alice@example.com" });
  await Session.create({ session_id: "sess-share", user_id: alice._id, filename: "offer.pdf", pass1_result: { document_type: "Offer", parties: [], governing_law: null, clauses: [] }, aggregation: { overall_risk: "high", risk_score: 7 } });

  const { res, json } = await c("/contracts/sess-share/share", { method: "POST" });
  assert.equal(res.status, 201);
  const token = json.share_token;
  assert.match(token, /^[A-Za-z0-9_-]{32}$/);
  assert.equal((await c("/contracts/sess-share/share", { method: "POST" })).json.share_token, token);

  const anon = await realFetch(`${base}/shared/${token}`);
  assert.equal(anon.status, 200);
  const body = await anon.json();
  assert.equal(body.filename, "offer.pdf");
  assert.ok(!("session_id" in body) && !("user_id" in body));
  assert.equal((await realFetch(`${base}/shared/${"A".repeat(32)}`)).status, 404);

  await User.updateOne({ _id: alice._id }, { pro_until: new Date(Date.now() - 1000) });
  assert.equal((await realFetch(`${base}/shared/${token}`)).status, 404);
  await User.updateOne({ _id: alice._id }, { pro_until: new Date(Date.now() + 30 * DAY) });
  assert.equal((await realFetch(`${base}/shared/${token}`)).status, 200);

  assert.equal((await c("/contracts/sess-share/share", { method: "DELETE" })).res.status, 200);
  assert.equal((await realFetch(`${base}/shared/${token}`)).status, 404);
});

// ─── Compare ─────────────────────────────────────────────────────────────────

test("compare diffs two owned contracts, caches the result, and is owner-only", { skip }, async () => {
  const c = client();
  await c("/auth/login", { method: "POST", body: { email: "alice@example.com", password: pw } });
  const alice = await User.findOne({ email: "alice@example.com" });
  const [a, b] = [crypto.randomUUID(), crypto.randomUUID()];
  const mk = (session_id, score, sev, nc) => Promise.all([
    Session.create({
      session_id, user_id: alice._id, filename: `${session_id}.pdf`, document_type: "Employment agreement",
      pass1_result: { document_type: "Employment agreement", parties: [], governing_law: null, clauses: [{ id: "clause_01", heading: "9. Non-compete", text: nc, category: "non_compete", suspicion_score: 9 }] },
      risk_report: [{ clause_id: "clause_01", severity: sev, risk_type: "Non-compete" }],
      aggregation: { overall_risk: sev, risk_score: score },
    }),
    Chunk.insertMany([
      { user_id: alice._id, session_id, chunk_id: "clause_00", heading: "1. Position", text: "You will be a software engineer reporting to the CTO." },
      { user_id: alice._id, session_id, chunk_id: "clause_01", heading: "9. Non-compete", text: nc },
    ]),
  ]);
  await mk(a, 8.1, "critical", "You shall not work for any competitor anywhere in the world for 24 months.");
  await mk(b, 4.2, "medium", "You shall not work for a direct competitor in Bengaluru for 6 months.");

  const created = await c("/compare", { method: "POST", body: { base_session_id: a, revised_session_id: b } });
  assert.equal(created.res.status, 201);
  const again = await c("/compare", { method: "POST", body: { base_session_id: a, revised_session_id: b } });
  assert.equal(again.json.comparison_id, created.json.comparison_id);

  const { json } = await c(`/compare/${created.json.comparison_id}`);
  assert.equal(json.verdict, "better");
  assert.equal(json.unchanged, 1);
  assert.equal(json.changes.length, 1);
  assert.equal(json.changes[0].kind, "changed");
  assert.equal(json.changes[0].severity_before, "critical");
  assert.equal(json.changes[0].severity_after, "medium");
  assert.equal(json.changes[0].note, "Six months instead of twenty-four.");
  assert.equal(json.base.filename, `${a}.pdf`);

  const eve = await signUp("Eve");
  await User.updateOne({ email: "eve@example.com" }, { pro_until: new Date(Date.now() + DAY) });
  assert.equal((await eve(`/compare/${created.json.comparison_id}`)).res.status, 404);
  assert.equal((await eve("/compare", { method: "POST", body: { base_session_id: a, revised_session_id: b } })).res.status, 404);

  assert.equal((await c("/comparisons")).json.comparisons.length, 1);
  await c(`/contracts/${a}`, { method: "DELETE" });
  assert.equal((await c("/comparisons")).json.comparisons.length, 0);
});
