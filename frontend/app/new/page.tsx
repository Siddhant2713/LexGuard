"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { getBilling, needsPro, uploadContract } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { formatDate } from "@/lib/utils"
import AppShell from "@/components/AppShell"
import type { BillingStatus } from "@/lib/types"

const MAX_BYTES = 20 * 1024 * 1024

const STEPS = [
  { n: "01", title: "We read every clause", body: "Usually in under a minute." },
  { n: "02", title: "Risks get marked", body: "Shaded by severity, right in your contract." },
  { n: "03", title: "You ask questions", body: "Every answer cites the exact clause." },
]

const TRUST = ["Encrypted in transit and at rest", "Only visible to you", "Never used to train AI", "Delete anytime"]

const card: React.CSSProperties = {
  display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 32,
  padding: "clamp(28px,4vw,48px)", borderRadius: 24, background: "var(--bg1)",
}

const line = (width?: string): React.CSSProperties => ({ height: 4, width, background: "var(--bd1)", borderRadius: 2 })

/** The little marked-up page drawn beside the drop zone. */
function PagePreview({ scanning }: { scanning?: boolean }) {
  return (
    <div aria-hidden="true" style={{ flex: "none", width: 150, height: 190, background: "var(--bg0)", borderRadius: 10, boxShadow: "var(--sh)", padding: "18px 16px", display: "flex", flexDirection: "column", gap: 7, position: "relative", overflow: "hidden" }}>
      {scanning && <div style={{ position: "absolute", left: 0, right: 0, height: 1, background: "var(--acc)", boxShadow: "0 0 12px 2px var(--acc)", animation: "lgScan 4s linear infinite" }} />}
      <div style={{ height: 6, width: "60%", background: "var(--t0)", borderRadius: 2, marginBottom: 6 }} />
      <div style={line()} /><div style={line("85%")} />
      <div style={{ padding: 5, margin: "0 -5px", borderRadius: 4, background: "var(--tc)", display: "flex", flexDirection: "column", gap: 5 }}><div style={line()} /><div style={line("70%")} /></div>
      <div style={line()} />
      <div style={{ padding: 5, margin: "0 -5px", borderRadius: 4, background: "var(--th)", display: "flex", flexDirection: "column", gap: 5 }}><div style={line()} /><div style={line("55%")} /></div>
      <div style={line("90%")} />
    </div>
  )
}

export default function NewAnalysisPage() {
  const { user } = useAuth()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Free plan only: this month's allowance. The API enforces it; this just shows it.
  const [usage, setUsage] = useState<BillingStatus["usage"]>(null)

  useEffect(() => {
    if (user?.plan === "free") getBilling().then((b) => setUsage(b.usage)).catch(() => {})
  }, [user])

  const outOfUploads = usage ? usage.used >= usage.limit : false

  async function handleFile(f: File) {
    const lower = f.name.toLowerCase()
    if (!lower.endsWith(".pdf") && !lower.endsWith(".docx") && !lower.endsWith(".doc")) {
      setError("Only PDF and DOCX files are supported.")
      return
    }
    if (f.size > MAX_BYTES) {
      setError("File too large. Maximum size is 20MB.")
      return
    }
    setError(null)
    setFile(f)
    try {
      const result = await uploadContract(f)
      router.push(`/analyze/${result.session_id}`)
    } catch (err) {
      setFile(null)
      if (needsPro(err)) {
        // The allowance ran out (perhaps in another tab): show the upgrade card.
        setUsage((u) => (u ? { ...u, used: u.limit } : u))
        if (!usage) router.push("/billing?feature=uploads")
        return
      }
      setError((err as Error).message || "Upload failed. Please try again.")
    }
  }

  return (
    <AppShell>
      <main style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "clamp(40px,7vh,88px) clamp(20px,4vw,48px) 64px", display: "flex", flexDirection: "column", gap: 36 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h1 style={{ margin: 0, fontFamily: "var(--serif)", fontWeight: 400, fontSize: "clamp(44px,5vw,64px)", lineHeight: 0.95, letterSpacing: "-0.04em" }}>New analysis</h1>
            <p style={{ margin: 0, fontSize: 17, color: "var(--t1)", maxWidth: 520, textWrap: "pretty" } as React.CSSProperties}>
              Upload a contract and LexGuard will mark every clause worth a second look.
            </p>
          </div>

          {outOfUploads && usage && !file ? (
            <div style={{ ...card, border: "1.5px solid var(--bd1)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 22, minWidth: 0, flex: "1 1 320px" }}>
                <div style={{ fontFamily: "var(--serif)", fontSize: "clamp(30px,3.4vw,44px)", lineHeight: 1.02, letterSpacing: "-0.03em" }}>
                  You’ve used this month’s {usage.limit} free contracts
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
                  <Link href="/billing?feature=uploads" className="lg-btn-acc" style={{ font: "500 15px var(--sans)", background: "var(--acc)", color: "var(--onacc)", padding: "13px 22px", borderRadius: 999, whiteSpace: "nowrap" }}>Get Pro for unlimited</Link>
                  <span style={{ font: "400 13px var(--mono)", color: "var(--t2)" }}>Free resets {formatDate(usage.resets_at)}</span>
                </div>
              </div>
              <PagePreview />
            </div>
          ) : file ? (
            <div style={{ ...card, border: "1.5px solid var(--acc)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0, flex: "1 1 320px" }}>
                <div style={{ font: "400 15px var(--mono)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</div>
                <div style={{ fontSize: 14, color: "var(--t1)" }}>{Math.max(1, Math.round(file.size / 1024))} KB · Uploading securely</div>
                <div style={{ width: "100%", maxWidth: 360, height: 2, background: "var(--bd1)", borderRadius: 1, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: "var(--acc)", transformOrigin: "0 50%", animation: "lgBar 1.3s cubic-bezier(.4,0,.2,1) both" }} />
                </div>
              </div>
              <PagePreview scanning />
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              aria-label="Choose a contract to upload"
              className={`lg-dropzone${dragging ? " is-drag" : ""}`}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                const f = e.dataTransfer.files?.[0]
                if (f) handleFile(f)
              }}
              style={{ ...card, border: "1.5px dashed var(--bd1)", cursor: "pointer" }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 22, minWidth: 0, flex: "1 1 320px" }}>
                <div style={{ fontFamily: "var(--serif)", fontSize: "clamp(30px,3.4vw,44px)", lineHeight: 1.02, letterSpacing: "-0.03em" }}>Drop a PDF or Word file here</div>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
                  <span style={{ font: "500 15px var(--sans)", background: "var(--t0)", color: "var(--bg0)", padding: "13px 22px", borderRadius: 999, whiteSpace: "nowrap" }}>Choose file</span>
                  <span style={{ font: "400 13px var(--mono)", color: "var(--t2)" }}>
                    Up to 20 MB{usage && ` · ${usage.limit - usage.used} of ${usage.limit} free left this month`}
                  </span>
                </div>
              </div>
              <PagePreview />
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.docx,.doc"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ""
                  if (f) handleFile(f)
                }}
                style={{ display: "none" }}
              />
            </div>
          )}

          {error && <div role="alert" style={{ marginTop: -16, fontSize: 14, color: "var(--acctx)" }}>{error}</div>}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 28, borderTop: "1px solid var(--bd1)", paddingTop: 28 }}>
            {STEPS.map((s) => (
              <div key={s.n} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ font: "500 12px var(--mono)", color: "var(--acctx)" }}>{s.n}</span>
                <span style={{ fontSize: 16, fontWeight: 500 }}>{s.title}</span>
                <span style={{ fontSize: 14, color: "var(--t1)" }}>{s.body}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 28px", fontSize: 13, color: "var(--t2)" }}>
            {TRUST.map((t) => (
              <span key={t} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true">
                  <rect x="1" y="6" width="10" height="7.5" rx="1.5" style={{ fill: "none", stroke: "currentColor", strokeWidth: 1.2 }} />
                  <path d="M3.5 6V4a2.5 2.5 0 0 1 5 0v2" style={{ fill: "none", stroke: "currentColor", strokeWidth: 1.2 }} />
                </svg>
                {t}
              </span>
            ))}
          </div>
        </div>
      </main>
    </AppShell>
  )
}
