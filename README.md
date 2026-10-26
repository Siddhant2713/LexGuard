# LexGuard

AI contract intelligence: upload a PDF/DOCX, get clause-level risk analysis, an overall risk profile, and a chat grounded in the document.

**Stack:** Next.js frontend · Node.js (Express) backend · MongoDB (Mongoose) · Groq LLMs

## Quickstart

Requires Node 20+, a MongoDB instance (local or Atlas), and a [Groq API key](https://console.groq.com).

```bash
# Backend (http://localhost:8000)
cd backend
cp .env.example .env      # fill in MONGODB_URI, GROQ_API_KEY and JWT_SECRET
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

### MongoDB collections

`sessions` (metadata + Pass 1/2/3 results), `chunks` (clause text, text-indexed), `chatmessages`.

## Auth

bcrypt-hashed passwords (cost 12), a JWT in an `httpOnly` `SameSite=Lax` cookie, zod validation on every input (strict, rejects markup in names and NoSQL operators), account lockout, per-IP rate limits, an `Origin` check on state-changing requests (CSRF), and `helmet` headers. Contracts are only readable by their owner. Code: `backend/src/{models,controllers,routes,middleware}`.

Integration tests need a throwaway database: `TEST_MONGODB_URI=mongodb://127.0.0.1:27017/lexguard_test npm test`.

All LLM output is validated with zod before it is stored or returned.
