import type {
  UploadResponse,
  AnalyzeResponse,
  ReportResponse,
  User,
  ContractSummary,
  BillingStatus,
  CheckoutOrder,
  Comparison,
  ComparisonSummary,
  SharedReport,
} from "./types"

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// ─── Auth ──────────────────────────────────────────────────────────────────
// The session lives in an httpOnly cookie set by the API, so every request opts in with
// `credentials: "include"`. The token is never visible to JavaScript.

export class ApiError extends Error {
  /** `code` is set for plan errors: "PRO_REQUIRED" or "QUOTA_EXCEEDED" (both 402). */
  constructor(message: string, public status: number, public code?: string) {
    super(message)
  }
}

/** True when the API refused because the feature or allowance needs Pro. */
export const needsPro = (err: unknown) => err instanceof ApiError && err.status === 402 && !!err.code

async function authRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.detail || "Request failed", res.status, data.code)
  return data as T
}

export const register = (name: string, email: string, password: string) =>
  authRequest<{ user: User }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  }).then((r) => r.user)

export const login = (email: string, password: string) =>
  authRequest<{ user: User }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  }).then((r) => r.user)

export const logout = () => authRequest<{ ok: boolean }>("/auth/logout", { method: "POST" })

/** Returns the signed-in user, or null when there is no valid session. */
export const getMe = () =>
  authRequest<{ user: User }>("/auth/me")
    .then((r) => r.user)
    .catch((err) => {
      if (err instanceof ApiError && err.status === 401) return null
      throw err
    })

export const listContracts = () =>
  authRequest<{ contracts: ContractSummary[] }>("/contracts").then((r) => r.contracts)

/** Removes the contract, its report and its chat. */
export const deleteContract = (sessionId: string) =>
  authRequest<{ ok: boolean }>(`/contracts/${encodeURIComponent(sessionId)}`, { method: "DELETE" })

// ─── Billing ───────────────────────────────────────────────────────────────

export const getBilling = () => authRequest<BillingStatus>("/billing")

export const createOrder = () => authRequest<CheckoutOrder>("/billing/order", { method: "POST" })

export interface PaymentConfirmation {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

/** Sends Checkout's success payload to the API, which checks it with Razorpay before granting Pro. */
export const verifyPayment = (confirmation: PaymentConfirmation) =>
  authRequest<{ user: User }>("/billing/verify", { method: "POST", body: JSON.stringify(confirmation) }).then((r) => r.user)

// ─── Sharing ───────────────────────────────────────────────────────────────

export const shareContract = (sessionId: string) =>
  authRequest<{ share_token: string }>(`/contracts/${encodeURIComponent(sessionId)}/share`, { method: "POST" }).then((r) => r.share_token)

export const unshareContract = (sessionId: string) =>
  authRequest<{ ok: boolean }>(`/contracts/${encodeURIComponent(sessionId)}/share`, { method: "DELETE" })

/** Public: no session needed. Null when the link is unknown or no longer active. */
export async function getSharedReport(token: string): Promise<SharedReport | null> {
  const res = await fetch(`${API_URL}/shared/${encodeURIComponent(token)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error("Could not load this report")
  return res.json()
}

// ─── Compare ───────────────────────────────────────────────────────────────

export const compareContracts = (baseSessionId: string, revisedSessionId: string) =>
  authRequest<{ comparison_id: string }>("/compare", {
    method: "POST",
    body: JSON.stringify({ base_session_id: baseSessionId, revised_session_id: revisedSessionId }),
  }).then((r) => r.comparison_id)

export const getComparison = (id: string) => authRequest<Comparison>(`/compare/${encodeURIComponent(id)}`)

export const listComparisons = () =>
  authRequest<{ comparisons: ComparisonSummary[] }>("/comparisons").then((r) => r.comparisons)

// ─── Upload ────────────────────────────────────────────────────────────────

export async function uploadContract(file: File): Promise<UploadResponse> {
  const form = new FormData()
  form.append("file", file)

  const res = await fetch(`${API_URL}/upload`, {
    method: "POST",
    body: form,
    credentials: "include",
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }))
    throw new ApiError(err.detail || "Upload failed", res.status, err.code)
  }

  return res.json()
}

// ─── Analyze ───────────────────────────────────────────────────────────────

export async function analyzeContract(
  sessionId: string
): Promise<AnalyzeResponse> {
  const res = await fetch(
    `${API_URL}/analyze?session_id=${sessionId}`,
    { method: "POST", credentials: "include" }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Analysis failed" }))
    throw new Error(err.detail || "Analysis failed")
  }

  return res.json()
}

export interface AnalyzeProgress {
  analyzed: boolean
  /** Clauses Pass 2 has finished, out of the ones it analyzes. Null before it starts. */
  progress: { done: number; total: number } | null
}

export const getAnalyzeProgress = (sessionId: string) =>
  authRequest<AnalyzeProgress>(`/analyze/progress?session_id=${encodeURIComponent(sessionId)}`)

// ─── Report ────────────────────────────────────────────────────────────────

export async function getReport(sessionId: string): Promise<ReportResponse | null> {
  const res = await fetch(`${API_URL}/report/${sessionId}`, { credentials: "include" })

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error("Could not load report")
  }

  return res.json()
}

// ─── Chat (SSE stream) ─────────────────────────────────────────────────────

export function streamChat(
  sessionId: string,
  query: string,
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (err: Error) => void
): () => void {
  const controller = new AbortController()

  ;(async () => {
    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, query }),
        credentials: "include",
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        throw new Error("Chat request failed")
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6)
            if (data === "[DONE]") {
              onDone()
              return
            }
            // Restore escaped newlines
            onToken(data.replace(/\\n/g, "\n"))
          }
        }
      }
      onDone()
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        onError(err as Error)
      }
    }
  })()

  // Return cleanup function
  return () => controller.abort()
}
