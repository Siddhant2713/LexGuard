// Needs a real MongoDB. Skipped unless TEST_MONGODB_URI is set (use a throwaway database!).
//   TEST_MONGODB_URI=mongodb://127.0.0.1:27017/lexguard_test npm test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

const uri = process.env.TEST_MONGODB_URI;
const skip = !uri && "TEST_MONGODB_URI not set";

let base, server, User, Session, Chunk, ChatMessage, searchChunks;
const pw = "correct horse 9";

before(async () => {
  if (skip) return;
  process.env.MONGODB_URI = uri;
  process.env.GROQ_API_KEY ??= "test";
  process.env.JWT_SECRET ??= "x".repeat(48);
  process.env.ALLOWED_ORIGINS = "http://localhost:3000";
  const { connectMongo } = await import("../src/lib/mongo.js");
  await connectMongo();
  await mongoose.connection.dropDatabase();
  await mongoose.syncIndexes();
  ({ User } = await import("../src/models/User.js"));
  ({ Session, Chunk, ChatMessage } = await import("../src/models/index.js"));
  ({ searchChunks } = await import("../src/services/chat.js"));
  const { createApp } = await import("../src/app.js");
  server = createApp().listen(0);
  base = `http://localhost:${server.address().port}`;
});

after(async () => {
  if (skip) return;
  server.close();
  await mongoose.disconnect();
});

// Minimal cookie-jar client
const client = () => {
  let cookie = "";
  return async (path, { method = "GET", body, headers = {} } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { "content-type": "application/json", ...(cookie && { cookie }), ...headers },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return { res, json: await res.json().catch(() => null), set };
  };
};

test("register sets an httpOnly cookie, stores a bcrypt hash, never returns it", { skip }, async () => {
  const c = client();
  const { res, json, set } = await c("/auth/register", { method: "POST", body: { name: "Alice", email: "Alice@Example.com", password: pw } });
  assert.equal(res.status, 201);
  assert.equal(json.user.email, "alice@example.com");
  assert.ok(!JSON.stringify(json).includes("password"));
  assert.match(set, /HttpOnly/i);
  assert.match(set, /SameSite=Lax/i);
  const stored = await User.findOne({ email: "alice@example.com" }).select("+password_hash");
  assert.match(stored.password_hash, /^\$2[aby]\$12\$/);
  assert.notEqual(stored.password_hash, pw);
  assert.equal((await c("/auth/me")).json.user.name, "Alice");
});

test("duplicate email -> 409; XSS name -> 422; extra fields -> 422", { skip }, async () => {
  const c = client();
  const reg = (body) => c("/auth/register", { method: "POST", body });
  assert.equal((await reg({ name: "Alice2", email: "alice@example.com", password: pw })).res.status, 409);
  assert.equal((await reg({ name: "<script>alert(1)</script>", email: "x1@example.com", password: pw })).res.status, 422);
  assert.equal((await reg({ name: "Mallory", email: "m@example.com", password: pw, role: "admin" })).res.status, 422);
  assert.equal(await User.countDocuments({ email: "m@example.com" }), 0);
});

test("login: wrong password and unknown email give the same generic 401", { skip }, async () => {
  const c = client();
  const a = await c("/auth/login", { method: "POST", body: { email: "alice@example.com", password: "wrong-pass-1" } });
  const b = await c("/auth/login", { method: "POST", body: { email: "ghost@example.com", password: "wrong-pass-1" } });
  assert.equal(a.res.status, 401);
  assert.equal(b.res.status, 401);
  assert.equal(a.json.detail, b.json.detail);
});

test("NoSQL injection in login is rejected", { skip }, async () => {
  const c = client();
  const { res } = await c("/auth/login", { method: "POST", body: '{"email":{"$gt":""},"password":{"$gt":""}}' });
  assert.equal(res.status, 422);
});

test("malformed JSON -> 400, not 500", { skip }, async () => {
  const { res } = await client()("/auth/login", { method: "POST", body: "{not json" });
  assert.equal(res.status, 400);
});

test("account locks after repeated failures, even for the right password", { skip }, async () => {
  const c = client();
  await c("/auth/register", { method: "POST", body: { name: "Bob", email: "bob@example.com", password: pw } });
  for (let i = 0; i < 5; i++) {
    await c("/auth/login", { method: "POST", body: { email: "bob@example.com", password: "wrong-pass-1" } });
  }
  const { res } = await client()("/auth/login", { method: "POST", body: { email: "bob@example.com", password: pw } });
  assert.equal(res.status, 401);
});

test("CSRF: state-changing request from a foreign Origin is blocked", { skip }, async () => {
  const { res } = await client()("/auth/login", {
    method: "POST",
    headers: { origin: "https://evil.example" },
    body: { email: "alice@example.com", password: pw },
  });
  assert.equal(res.status, 403);
});

test("protected routes need auth; forged and alg=none tokens are rejected", { skip }, async () => {
  const anon = client();
  assert.equal((await anon("/contracts")).res.status, 401);
  assert.equal((await anon("/auth/me", { headers: { authorization: "Bearer garbage" } })).res.status, 401);
  const none = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from('{"sub":"x","tv":0}').toString("base64url")}.`;
  assert.equal((await anon("/auth/me", { headers: { authorization: `Bearer ${none}` } })).res.status, 401);
});

test("users only see their own contracts; others get 404", { skip }, async () => {
  const alice = client(), eve = client();
  await alice("/auth/login", { method: "POST", body: { email: "alice@example.com", password: pw } });
  await eve("/auth/register", { method: "POST", body: { name: "Eve", email: "eve@example.com", password: pw } });
  const aliceUser = await User.findOne({ email: "alice@example.com" });
  await Session.create({ session_id: "sess-alice", user_id: aliceUser._id, filename: "a.pdf", pass1_result: { document_type: "NDA", parties: [], governing_law: null, clauses: [] } });

  assert.equal((await alice("/contracts")).json.contracts.length, 1);
  assert.equal((await eve("/contracts")).json.contracts.length, 0);
  assert.equal((await alice("/report/sess-alice")).res.status, 200);
  assert.equal((await eve("/report/sess-alice")).res.status, 404);
  assert.equal((await eve("/chat/sess-alice/history")).res.status, 404);
  assert.equal((await eve("/analyze?session_id=sess-alice", { method: "POST" })).res.status, 404);
  assert.equal((await eve("/analyze/progress?session_id=sess-alice")).res.status, 404);
  await Session.updateOne({ session_id: "sess-alice" }, { analysis_progress: { done: 3, total: 10 } });
  assert.deepEqual((await alice("/analyze/progress?session_id=sess-alice")).json, { analyzed: false, progress: { done: 3, total: 10 } });
  assert.equal((await eve("/chat", { method: "POST", body: { session_id: "sess-alice", query: "hi" } })).res.status, 404);
});

test("chunks and chat messages are owned too, and queries are scoped by owner", { skip }, async () => {
  const alice = await User.findOne({ email: "alice@example.com" });
  const eve = await User.findOne({ email: "eve@example.com" });
  await Chunk.create({ user_id: alice._id, session_id: "sess-alice", chunk_id: "c1", heading: "Termination", text: "Either party may terminate this agreement with notice." });
  await ChatMessage.create({ user_id: alice._id, session_id: "sess-alice", role: "user", content: "hi" });

  assert.equal((await searchChunks(alice._id, "sess-alice", "terminate")).length, 1);
  // Same session id, wrong owner: nothing comes back, with or without the fallback path.
  assert.equal((await searchChunks(eve._id, "sess-alice", "terminate")).length, 0);
  assert.equal((await searchChunks(eve._id, "sess-alice", "the")).length, 0);
  // Schema refuses ownerless rows.
  await assert.rejects(Chunk.create({ session_id: "s", chunk_id: "c", heading: "h", text: "t" }), /user_id/);
  await assert.rejects(ChatMessage.create({ session_id: "s", role: "user", content: "x" }), /user_id/);
});

test("delete removes a contract with its chunks and chat; only the owner can delete", { skip }, async () => {
  const alice = client(), eve = client();
  await alice("/auth/login", { method: "POST", body: { email: "alice@example.com", password: pw } });
  await eve("/auth/login", { method: "POST", body: { email: "eve@example.com", password: pw } });

  assert.equal((await eve("/contracts/sess-alice", { method: "DELETE" })).res.status, 404);
  assert.ok(await Session.exists({ session_id: "sess-alice" }));

  assert.equal((await alice("/contracts/sess-alice", { method: "DELETE" })).res.status, 200);
  assert.equal(await Session.countDocuments({ session_id: "sess-alice" }), 0);
  assert.equal(await Chunk.countDocuments({ session_id: "sess-alice" }), 0);
  assert.equal(await ChatMessage.countDocuments({ session_id: "sess-alice" }), 0);
  assert.equal((await alice("/contracts/sess-alice", { method: "DELETE" })).res.status, 404);
});

test("logout revokes the token server-side", { skip }, async () => {
  const c = client();
  const login = await c("/auth/login", { method: "POST", body: { email: "alice@example.com", password: pw } });
  const token = login.set.split(";")[0].split("=")[1];
  assert.equal((await c("/auth/logout", { method: "POST" })).res.status, 200);
  const replay = await client()("/auth/me", { headers: { authorization: `Bearer ${token}` } });
  assert.equal(replay.res.status, 401);
});

test("security headers are present", { skip }, async () => {
  const res = await fetch(`${base}/health`);
  assert.ok(res.headers.get("x-content-type-options"));
  assert.equal(res.headers.get("x-powered-by"), null);
});
