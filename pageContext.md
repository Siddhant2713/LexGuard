# LexGuard — Page Context

What every page is, what it shows and what it calls. Implemented from the spec03 design (`LexGuard Prototype.html`, git-ignored). Update this file whenever a page changes.

Stack: Next.js 14 App Router (client components), React 18. Styling is inline `style={{}}` on top of the design tokens in `app/globals.css`; hover/focus states are small `.lg-*` classes in the same file. Tailwind only supplies the reset. API: Express + MongoDB in `backend/`, at `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`), httpOnly cookie auth (`credentials: "include"`).

---

## 1. Route map

| Route | File | Auth | Purpose |
|---|---|---|---|
| `/` | `app/page.tsx` → `components/landing/Landing.tsx` | public; signed-in users are redirected to `/new` | Marketing landing page |
| `/login` | `app/login/page.tsx` → `AuthForm mode="login"` | public; signed-in → `/new` | Sign in ("Welcome back") |
| `/register` | `app/register/page.tsx` → `AuthForm mode="register"` | public; signed-in → `/new` | Create account |
| `/new` | `app/new/page.tsx` | required | Upload a contract |
| `/contracts` | `app/contracts/page.tsx` | required | Past contracts: search, filter, delete |
| `/analyze/[sessionId]` | `app/analyze/[sessionId]/page.tsx` | required | Analysis progress → results dashboard |

Signed-in pages are wrapped in `AppShell`, which runs `useRequireAuth()` (redirects to `/login`) and renders nothing until the session is known. Sign out → `/`.

---

## 2. Pages

### 2.1 `/` — Landing
Sticky blurred header (logo, Product / How it works / Pricing / FAQ scroll links, theme toggle, "Sign in" → `/login`, "Try it free" → `/register`). Sections in order:
1. **Hero:** eyebrow pill "CONTRACT REVIEW IN PLAIN ENGLISH", serif H1 "Read before you sign.", lead copy, CTAs "Analyze a contract" (→ `/register`) and "See how it reads" (scroll), "Free for 3 contracts a month". Below it a **product window mock** (static sample contract) with a looping 12s scan line, clauses tinting in by severity, and chat bubbles. It tilts (`rotateX 14° → 0`, `scale .94 → 1`) over the first 480px of scroll.
2. **Marquee** of contract types (40s loop).
3. **The fine print, marked** (`#product`): highlighted §4 Inventions quote + In plain English / If you sign this / What to ask for.
4. **Ask the contract** (inverted band): three Q&A cards cycling (15s).
5. **How it works** (`#how`): 01–03 steps.
6. **Testimonials:** 3 quotes, auto-rotate every 6.5s, clickable dots.
7. **Privacy:** three promises.
8. **Pricing** (`#pricing`): Free $0 / Pro $15 per month. Both CTAs → `/register`. *No billing yet; payments come later.*
9. **FAQ** (`#faq`): accordion, first item open.
10. **CTA band** (accent): "Know what you’re signing." → `/register`.
11. **Footer:** disclaimer, Privacy / Terms / Contact (plain text, no pages yet), giant "LexGuard" wordmark.

All landing content is static sample copy.

### 2.2 `/login`, `/register` — `components/auth/AuthForm.tsx`
Split screen. Left (inverted): logo → `/`, "Every clause, in plain English.", Critical sample-quote card, "Free for 3 contracts a month". Right: theme toggle; form with placeholder-only rounded inputs (Full name for register, Email, Password), hint "At least 8 characters, with a letter and a number." (register), inline error line, pill submit ("Create account" / "Sign in"), switch link underlined in accent.
Validation mirrors the server (name chars/max 60, email, password ≥ 8 with letter + digit, ≤ 72 bytes). API: `POST /auth/register`, `POST /auth/login`. On success the auth context updates and the page redirects to `/new`.

### 2.3 App header — `components/AppShell.tsx`
60px bar: logo → `/new`; pill nav **New analysis** (`/new`) and **Contracts** (`/contracts`), with the active one filled; on the dashboard `/ filename` breadcrumb and an **Export** button; theme toggle; avatar (initials) opening a menu with name, email, Contracts, Sign out.

### 2.4 `/new` — Upload
H1 "New analysis" + lead. A dashed drop zone ("Drop a PDF or Word file here", "Choose file" pill, "Up to 20 MB", marked-up page thumbnail) accepts click, Enter/Space and drag-drop, and highlights in accent while hovered or dragged over. While uploading it shows the filename, size "· Uploading securely", a 1.3s bar and a scanning thumbnail. Errors appear as an accent line below. Then a 01–03 steps row and four lock-icon trust lines.
Client checks: `.pdf/.docx/.doc`, ≤ 20 MB. API: `POST /upload` → `/analyze/{session_id}`.

### 2.5 `/contracts`
H1 "Contracts", search pill (filename), "New analysis" button; tabs All / Critical / High / Medium / Low (by `overall_risk`). Rows (click → `/analyze/{id}`) show the filename, `document_type · Oct 24, 2026`, a flag summary ("1 critical · 2 high" or "Nothing serious"), a severity pill ("Not analyzed" if pending) and a serif score. A trash button appears on row hover; the first click arms it ("Delete") and the second deletes. Empty states: "No contracts yet." / "No contracts match."
API: `GET /contracts`, `DELETE /contracts/:sessionId`.

### 2.6 `/analyze/[sessionId]`
Loads `GET /report/:id`. If the report is already analyzed it goes straight to the dashboard. Otherwise it shows the progress view and calls `POST /analyze?session_id=`. A missing report or a failure shows "Analysis failed" + message + "Try again" → `/new`.

**Progress (`components/analysis/Analyzing.tsx`):** 2px accent bar; left, the document (pass-1 clauses in document order) with the current clause outlined and finished clauses tinted and labelled; right, filename, big serif `n / N`, pulsing "Reading §n Heading" / "Preparing your report", and a list of found risks (medium and above). Progress is simulated (one clause per 2s, holding on the last until the API returns). Labels use the **pass-1 suspicion score** (≥8 critical, ≥6 high, ≥4 medium); the dashboard shows the real severities.

**Dashboard (`components/dashboard/Dashboard.tsx`):**
- **Flags (left):** count, then every analysed clause sorted by severity: dot, severity, `risk_type`. Clicking one selects it, scrolls the document to it with a flash ring, and appends its clause card to the chat.
- **Document (centre):** "{Overall} risk" + `score / 10`, `aggregation.summary`, severity legend with counts; then a paper card with document type, parties · governing law, and every pass-1 clause (number from id, heading, full text) tinted and labelled by severity.
- **Chat (right, `ChatPanel.tsx`):** opening message ("I read your {type} and flagged N clauses…"), clause cards (In plain English / If you sign this / What to ask for), user bubbles, streamed answers with a blinking accent cursor. `[[CLAUSE:id:Heading]]` markers become inline headings plus `§n Heading` chips once the answer finishes, and a chip scrolls to that clause. Three suggestion chips show until the first question. The composer grows with its text (Enter sends, Shift+Enter adds a newline). API: `POST /chat` (SSE).
- **Export:** `window.print()`. Print CSS hides the app and prints a report (overall risk, summary, each flag with explanation, consequence and what to ask for).

---

## 3. Design system (`app/globals.css`)

- **Theme:** `data-lg` on `<html>` = `auto | light | dark`, saved in `localStorage["lg-theme"]` and applied before hydration (`lib/theme.tsx`). The toggle flips whatever is showing.
- **Tokens:** surfaces `--bg0..3`, borders `--bd0/1`, text `--t0..2`, accent `--acc` (oklch orange) / `--acctx` / `--onacc`, inverted `--inv/--oninv/--oninv2`, severity tints `--tc` (critical) `--th` (high) `--tm` (medium) `--tl` (low), shadow `--sh`, window `--win`. Fonts `--serif` Newsreader, `--sans` Geist, `--mono` Geist Mono (Google Fonts in `layout.tsx`).
- **Severity:** one accent at four strengths (`severityStyle` in `lib/utils.ts`): critical is a solid accent pill, high an accent outline, medium and low neutral.
- **Brand:** `components/brand.tsx`: `LogoMark` (tile + shield + accent pen, plus a compact variant for avatars), `Logo` (mark + "LexGuard" 600 Geist), `ThemeToggle`. Favicon `app/icon.svg`.
- **Motion:** keyframes `lgUp`, `lgScan`, `lgT*/lgL*/lgC*` (product mock), `lgQ*` (Q&A), `lgMarq`, `lgPulse`, `lgBlink`, `lgFlashA/B`, `lgBar`; all are disabled under `prefers-reduced-motion`.
- **Shape:** pills (999px) for buttons, tags and nav; 10–24px radii for cards.

## 4. Data shapes (`lib/types.ts`)
`RawClause { id, heading, text, category, suspicion_score }` (pass 1, top 15 by suspicion; `inDocumentOrder` re-sorts by the number in `id`) · `RiskAnalysis { clause_id, severity, risk_type, affects, plain_english, consequence, red_flags, negotiation_tip }` · `AggregationResult { overall_risk, risk_score, major_concerns, summary, favors }` · `ReportResponse` · `ContractSummary` · `User`.

## 5. Known gaps
- Pricing and the "3 contracts a month" limit are copy only (payments come later). Testimonials are sample copy.
- Footer Privacy / Terms / Contact have no pages.
- Chat history isn't reloaded (`GET /chat/:id/history` exists but the UI doesn't use it).
- `affects`, `red_flags`, `major_concerns` and `favors` aren't shown anywhere (not in the design).
