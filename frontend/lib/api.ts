import type {
  UploadResponse,
  AnalyzeResponse,
  ReportResponse,
  User,
  ContractSummary,
} from "./types"

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// ─── Auth ──────────────────────────────────────────────────────────────────
// The session lives in an httpOnly cookie set by the API, so every request opts in with
// `credentials: "include"`. The token is never visible to JavaScript.

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

async function authRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.detail || "Request failed", res.status)
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
    throw new Error(err.detail || "Upload failed")
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
