# LexGuard

AI contract intelligence: upload a PDF/DOCX, get clause-level risk analysis, an overall risk profile, and a chat grounded in the document.

**Stack:** Next.js frontend · Node.js (Express) backend · MongoDB (Mongoose) · Groq LLMs

## Quickstart

Requires Node 20+, a MongoDB instance (local or Atlas), and a [Groq API key](https://console.groq.com).

```bash
# Backend (http://localhost:8000)
cd backend
cp .env.example .env      # fill in MONGODB_URI, GROQ_API_KEY, JWT_SECRET and the RAZORPAY_* keys
npm install
npm run dev

# Frontend (http://localhost:3000)
cd frontend
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm install
npm run dev
```

Backend tests: `cd backend && npm test`

## How it works

Users register and sign in (`/register`, `/login`); each contract belongs to the user who uploaded it, and **My contracts** lists theirs. See [Auth](#auth).

1. **`POST /upload`** parses the file (`pdf-parse` / `mammoth`), runs Pass 1 (clause extraction), splits the text into chunks, and persists the session and chunks in MongoDB.
2. **`POST /analyze?session_id=`** runs Pass 2 (per-clause risk analysis, bounded concurrency) and Pass 3 (aggregation), then saves the report.
3. **`POST /chat`** retrieves the most relevant chunks with a MongoDB text index and streams a grounded answer over SSE. Messages are persisted.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/auth/register` | Create account, start session |
| `POST` | `/auth/login` | Sign in |
| `POST` | `/auth/logout` | Sign out (revokes the token) |
| `GET` | `/auth/me` | Current user |
| `GET` | `/contracts` | The signed-in user's contracts |
| `GET` | `/health` | Health check |
| `POST` | `/upload` | Upload + Pass 1 |
| `POST` | `/analyze` | Pass 2 + 3 |
| `POST` | `/chat` | SSE chat |
| `GET` | `/report/:sessionId` | Saved report |
| `GET` | `/chat/:sessionId/history` | Chat history |
| `GET` | `/billing` | Plan, free allowance, payment history |
| `POST` | `/billing/order` | Create a Razorpay order for Pro |
| `POST` | `/billing/verify` | Confirm a Checkout payment |
| `POST` | `/billing/webhook` | Razorpay webhook (signed, no auth) |
| `POST` / `DELETE` | `/contracts/:sessionId/share` | Create / revoke a share link (Pro) |
| `GET` | `/shared/:token` | Public read-only report |
| `POST` | `/compare` | Compare two analyzed contracts (Pro) |
| `GET` | `/compare/:id`, `/comparisons` | A comparison / past comparisons (Pro) |

### MongoDB collections

`sessions` (metadata + Pass 1/2/3 results), `chunks` (clause text, text-indexed), `chatmessages`, `payments`, `usages` (free uploads per month), `comparisons`.

## Plans & payments

| | Free | Pro (₹499 for 30 days) |
| :--- | :--- | :--- |
| Contracts | 3 per calendar month (UTC) | Unlimited |
| Clause analysis, chat | ✓ | ✓ |
| Export (print/PDF), share links | | ✓ |
| Compare two versions | | ✓ |

Pro is a **one-time Razorpay payment**, not a subscription: each purchase adds 30 days on top of whatever time is left, and nothing renews on its own. Limits are enforced by the API (`backend/src/services/plans.js`, `middleware/plan.js`). Pro-only routes answer `402` with `code: "PRO_REQUIRED"`, and an exhausted free allowance answers `402` with `code: "QUOTA_EXCEEDED"`.

Flow: `POST /billing/order` (the server sets the amount) → Razorpay Checkout → `POST /billing/verify` checks the signature, re-reads the payment from Razorpay (amount, currency, order), captures it if it's only authorized, and grants Pro. The webhook does the same, so a payment still counts if the browser closes mid-flow. Granting is idempotent: the order id is recorded in the same atomic update that extends `pro_until`. A full refund (`refund.processed`) takes back that order's days. Share links stop working while the owner isn't on Pro.

**Razorpay setup (live):**
1. Dashboard → Account & Settings → API Keys: put the key id and secret in `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`.
2. Dashboard → Webhooks → Add: URL `https://<api-host>/billing/webhook`, events `payment.authorized`, `payment.captured`, `order.paid`, `refund.processed`, and a secret, which goes in `RAZORPAY_WEBHOOK_SECRET`.
3. The frontend CSP already allows Checkout (`next.config.js`).

## Auth

bcrypt-hashed passwords (cost 12), a JWT in an `httpOnly` `SameSite=Lax` cookie, zod validation on every input (strict, rejects markup in names and NoSQL operators), account lockout, per-IP rate limits, an `Origin` check on state-changing requests (CSRF), and `helmet` headers. Contracts are only readable by their owner. Code: `backend/src/{models,controllers,routes,middleware}`.

Integration tests need a throwaway database: `TEST_MONGODB_URI=mongodb://127.0.0.1:27017/lexguard_test npm test`.

All LLM output is validated with zod before it is stored or returned.
