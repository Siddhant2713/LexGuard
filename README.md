# LexGuard

AI contract intelligence: upload a PDF or DOCX and get a clause-by-clause risk analysis, an overall risk profile, and a chat that answers questions using only that document.

**Stack:** Next.js 15 (React 19) · Node.js + Express · MongoDB (Mongoose) · Groq LLMs · Razorpay

## Contents

- [Quickstart](#quickstart)
- [How it works](#how-it-works)
- [API reference](#api-reference)
- [Plans and payments](#plans-and-payments)
- [Authentication and security](#authentication-and-security)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Project layout](#project-layout)
- [Testing](#testing)

## Quickstart

You need Node 20+ (Node 22+ only for the Cloudflare preview), a MongoDB database (local or Atlas), and a free [Groq API key](https://console.groq.com).

```bash
# Backend: http://localhost:8000
cd backend
cp .env.example .env     # fill in MONGODB_URI, GROQ_API_KEY, JWT_SECRET and the RAZORPAY_* keys
npm install
npm run dev

# Frontend: http://localhost:3000
cd frontend
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm install
npm run dev
```

Use `rzp_test_` Razorpay keys while developing. In test mode, pay with the UPI ID `success@razorpay` or the card `4111 1111 1111 1111` (any future expiry and CVV). Real UPI IDs and real cards do not work with test keys.

## How it works

Each user registers and signs in, and every contract belongs to the user who uploaded it. **My contracts** lists theirs.

1. **Upload** (`POST /upload`): the file is parsed (`pdf-parse` or `mammoth`), Pass 1 extracts the clauses, the text is split into chunks, and the session and chunks are saved in MongoDB.
2. **Analyze** (`POST /analyze`): Pass 2 scores the risk of each clause (several clauses at a time), Pass 3 writes the overall summary, and the report is saved.
3. **Chat** (`POST /chat`): the most relevant chunks are found with a MongoDB text index, and a grounded answer streams back over SSE. Messages are saved.

All LLM output is validated with zod before it is stored or returned.

### MongoDB collections

| Collection | Holds |
| :--- | :--- |
| `users` | Accounts, plan expiry (`pro_until`), login lockout state |
| `sessions` | Contract metadata and the Pass 1, 2 and 3 results |
| `chunks` | Clause text, text-indexed for chat retrieval |
| `chatmessages` | Chat history |
| `payments` | Razorpay orders and their status |
| `usages` | Free uploads used per month |
| `comparisons` | Saved contract comparisons |

## API reference

Auth is a session cookie. Routes marked **Pro** need an active Pro plan.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | none | Health check |
| `POST` | `/auth/register` | none | Create account and start a session |
| `POST` | `/auth/login` | none | Sign in |
| `POST` | `/auth/logout` | user | Sign out and revoke the token |
| `GET` | `/auth/me` | user | Current user |
| `GET` | `/contracts` | user | The signed-in user's contracts |
| `DELETE` | `/contracts/:sessionId` | user | Delete a contract |
| `POST` | `/upload` | user | Upload and run Pass 1 |
| `POST` | `/analyze?session_id=` | user | Run Pass 2 and 3 |
| `GET` | `/analyze/progress` | user | Analysis progress |
| `GET` | `/report/:sessionId` | user | Saved report |
| `POST` | `/chat` | user | Streaming chat (SSE) |
| `GET` | `/chat/:sessionId/history` | user | Chat history |
| `POST` / `DELETE` | `/contracts/:sessionId/share` | **Pro** / user | Create or revoke a share link |
| `GET` | `/shared/:token` | none | Public read-only report |
| `POST` | `/compare` | **Pro** | Compare two analyzed contracts |
| `GET` | `/compare/:id`, `/comparisons` | **Pro** | One comparison, or past comparisons |
| `GET` | `/billing` | user | Plan, free allowance, payment history |
| `POST` | `/billing/order` | user | Create a Razorpay order for Pro |
| `POST` | `/billing/verify` | user | Confirm a Checkout payment |
| `POST` | `/billing/webhook` | signature | Razorpay webhook (no cookie) |

## Plans and payments

| | Free | Pro (₹499 for 30 days) |
| :--- | :--- | :--- |
| Contracts | 3 per calendar month (UTC) | Unlimited |
| Clause analysis and chat | ✓ | ✓ |
| Export (print or PDF) and share links | | ✓ |
| Compare two versions | | ✓ |

Pro is a **one-time payment**, not a subscription. Each purchase adds 30 days on top of any time left, and nothing renews on its own. The API enforces the limits (`backend/src/services/plans.js`, `middleware/plan.js`). Pro-only routes return `402` with `code: "PRO_REQUIRED"`, and an used-up free allowance returns `402` with `code: "QUOTA_EXCEEDED"`.

### Payment flow

1. The browser calls `POST /billing/order`. The server sets the amount, so the client can't change it.
2. Razorpay Checkout opens and the user pays.
3. The browser calls `POST /billing/verify`. The API checks the signature, re-reads the payment from Razorpay (amount, currency, order), captures it if it is only authorized, and grants Pro.
4. Razorpay also calls `/billing/webhook`, which does the same. A payment still counts if the browser closes mid-flow.

Granting is idempotent: the order id is recorded in the same atomic update that extends `pro_until`. A full refund (`refund.processed`) takes back that order's days. Share links stop working while the owner isn't on Pro.

To grant Pro by hand (for support): `cd backend && npm run grant-pro`.

## Authentication and security

- Passwords are hashed with bcrypt (cost 12), and accounts lock after repeated failed logins.
- The session is a JWT in an `httpOnly` cookie, so JavaScript can't read it. In production the cookie is `Secure`.
- Every input is validated with zod (strict, rejects markup in names and NoSQL operators).
- Rate limits apply per IP. State-changing requests that carry an `Origin` header must come from an allowed origin (CSRF defence), otherwise the API returns `403 Origin not allowed`.
- `helmet` sets security headers, and the frontend sets a Content-Security-Policy that allows Razorpay Checkout (`frontend/next.config.js`).
- Contracts are readable only by their owner.

## Configuration

### Backend (`backend/.env`, see `.env.example`)

| Variable | Required | Purpose |
| :--- | :--- | :--- |
| `MONGODB_URI` | yes | Database connection string |
| `JWT_SECRET` | yes | Session signing key, 32+ characters |
| `GROQ_API_KEY` | yes | LLM access |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | yes | Razorpay API keys (`rzp_test_` or `rzp_live_`) |
| `RAZORPAY_WEBHOOK_SECRET` | production | Secret you choose when adding the webhook. Without it the webhook is ignored |
| `ALLOWED_ORIGINS` | production | Comma-separated frontend origins, for example `https://lexguard.example.workers.dev` |
| `COOKIE_SAMESITE` | production | `lax` when the frontend proxies the API (the default setup) |
| `TRUST_PROXY` | production | Number of proxies in front of the API (`1` on Render) |
| `NODE_ENV` | production | `production` turns on `Secure` cookies |
| `PORT` | no | Default `8000` |
| `GROQ_MODEL`, `GROQ_CHAT_MODEL`, `GROQ_TPM`, `MAX_CONTEXT_CHARS`, `PASS2_CONCURRENCY` | no | LLM tuning. Raise the limits on a paid Groq tier |

### Frontend

| Variable | When | Purpose |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | build time | Local: `http://localhost:8000`. Deployed: `/api` |
| `API_ORIGIN` | build time (deployed) | Render API address, for example `https://lexguard-api.onrender.com`. Only the scheme and host are used |

Both are baked in at build time, so change them and rebuild.

## Deployment

The free-tier setup uses four services:

| Part | Service | Notes |
| :--- | :--- | :--- |
| Database | MongoDB Atlas (M0) | Allow `0.0.0.0/0` in Network Access, since Render has no fixed IP |
| API | Render free Web Service | Root directory `backend`, build `npm ci`, start `npm start`, health check `/health`, `NODE_VERSION=20` |
| Frontend | Cloudflare Workers (OpenNext) | Root directory `frontend`, build `npm ci && npx opennextjs-cloudflare build`, deploy `npx opennextjs-cloudflare deploy`, `NODE_VERSION=22` |
| Keep-alive | UptimeRobot | Pings `/health` every 5 minutes so Render doesn't sleep |

**How the pieces connect.** The browser only talks to the Cloudflare site. A rewrite in `frontend/next.config.js` forwards `/api/*` to the Render API (`API_ORIGIN`). Because the cookie is then first-party, login works in Safari and Chrome without a custom domain.

Deploy in this order:

1. Create the Atlas cluster and copy the connection string.
2. Deploy the API on Render with the backend variables above (`ALLOWED_ORIGINS` can wait until step 4).
3. Deploy the frontend on Cloudflare with `NEXT_PUBLIC_API_URL=/api` and `API_ORIGIN`.
4. Set `ALLOWED_ORIGINS` on Render to the Cloudflare address (exact, no trailing slash) and redeploy.
5. Check `https://<cloudflare-site>/api/health` returns `{"status":"ok",...}`, then register and log in.
6. Go live with Razorpay (below), then add the UptimeRobot monitor.

### Going live with Razorpay

1. Switch the Razorpay dashboard to **Live mode** (KYC must be approved).
2. **Account & Settings → API Keys**: generate live keys and put them in Render as `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. The secret is shown once.
3. **Webhooks → Add**: URL `https://<render-api>/billing/webhook` (point it at Render directly, not the Cloudflare site), events `payment.authorized`, `payment.captured`, `order.paid` and `refund.processed`, and a secret you generate. Use the same secret as `RAZORPAY_WEBHOOK_SECRET` on Render.
4. Make a real ₹499 payment yourself, confirm Pro unlocks and the webhook shows 200 in the dashboard, then refund it.

Never commit live keys. Keep them only in Render's environment variables.

### Common problems

| Symptom | Cause and fix |
| :--- | :--- |
| `Origin not allowed` on sign up | `ALLOWED_ORIGINS` on Render doesn't match the site's address exactly |
| `/api/health` shows `Authentication required` | `API_ORIGIN` is wrong or the build used an old value. Fix it and rebuild |
| `Razorpay order failed: Authentication failed` | The key id and secret are from different pairs, or from different modes |
| Render log: `tlsv1 alert internal error` | Atlas is blocking Render. Allow `0.0.0.0/0` under Network Access |
| First request is slow | Render was asleep. Check the keep-alive monitor |
| Cloudflare build: `could not determine executable to run` | Root directory isn't `frontend`, or the changes aren't pushed |
| UPI fails in test mode | Use `success@razorpay`. Real UPI IDs only work with live keys |

## Project layout

```text
backend/
  index.js            server entry
  src/
    app.js            middleware and route wiring
    config.js         environment and limits
    routes/           auth, contracts, billing, shared
    controllers/      request handlers
    services/         analyzer, chat, groq, billing, razorpay, plans, compare
    middleware/       auth, plan checks, origin guard
    models/           Mongoose models
    prompts/          LLM prompts
  scripts/grant-pro.js
  test/               node:test unit and integration tests
frontend/
  app/                pages: landing, auth, new, analyze, contracts, compare, billing, shared
  components/         UI by area (dashboard, analysis, compare, auth, landing)
  lib/                API client, auth context, Razorpay Checkout loader, plans
  next.config.js      CSP, /api rewrite
  open-next.config.ts, wrangler.jsonc   Cloudflare Workers build
```

## Testing

```bash
cd backend && npm test
```

The integration tests use a throwaway database: `TEST_MONGODB_URI=mongodb://127.0.0.1:27017/lexguard_test npm test`. Without it, those tests are skipped. CI (GitHub Actions) runs them against a Mongo service on every push and pull request.

To try the Cloudflare build locally, use Node 22 and run `npm run preview` in `frontend/`.
