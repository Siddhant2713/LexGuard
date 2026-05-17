import type {
  UploadResponse,
  AnalyzeResponse,
  ReportResponse,
} from "./types"

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// ─── Upload ────────────────────────────────────────────────────────────────

export async function uploadContract(file: File): Promise<UploadResponse> {
  const form = new FormData()
  form.append("file", file)

  const res = await fetch(`${API_URL}/upload`, {
    method: "POST",
    body: form,
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
    { method: "POST" }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Analysis failed" }))
    throw new Error(err.detail || "Analysis failed")
  }

  return res.json()
}

// ─── Report ────────────────────────────────────────────────────────────────

export async function getReport(sessionId: string): Promise<ReportResponse> {
  const res = await fetch(`${API_URL}/report/${sessionId}`)

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
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        throw new Error("Chat request failed")
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split("\n")

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
