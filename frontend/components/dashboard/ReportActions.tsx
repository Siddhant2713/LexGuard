"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { needsPro, shareContract, unshareContract } from "@/lib/api"
import { ProTag } from "@/components/brand"

interface ReportActionsProps {
  sessionId: string
  isPro: boolean
  /** The report's current share token, if it's shared. */
  shareToken: string | null
}

const btn: React.CSSProperties = {
  font: "500 13px var(--sans)", background: "var(--bg2)", border: 0, color: "var(--t0)", padding: "8px 14px",
  borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap", flex: "none", display: "flex", alignItems: "center", gap: 7,
}

const shareUrl = (token: string) => `${window.location.origin}/shared/${token}`

/** Export and Share in the dashboard header. Both are Pro; on Free they lead to the upgrade page. */
export default function ReportActions({ sessionId, isPro, shareToken }: ReportActionsProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState(shareToken)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!popRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])

  const upgrade = (feature: string) => router.push(`/billing?feature=${feature}`)

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      if (needsPro(err)) return upgrade("share")
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const openShare = () => {
    if (!isPro) return upgrade("share")
    setOpen((o) => !o)
    setCopied(false)
    if (!token) run(async () => setToken(await shareContract(sessionId)))
  }

  const copy = async () => {
    if (!token) return
    await navigator.clipboard.writeText(shareUrl(token)).catch(() => {})
    setCopied(true)
  }

  return (
    <>
      <button type="button" onClick={() => (isPro ? window.print() : upgrade("export"))} style={btn}>
        Export{!isPro && <ProTag />}
      </button>
      <div ref={popRef} style={{ position: "relative", flex: "none" }}>
        <button type="button" onClick={openShare} aria-expanded={open} style={btn}>
          {token ? "Shared" : "Share"}{!isPro && <ProTag />}
        </button>
        {open && (
          <div style={{ position: "absolute", right: 0, top: 44, width: 340, maxWidth: "calc(100vw - 32px)", background: "var(--bg0)", borderRadius: 14, boxShadow: "var(--sh)", padding: 18, zIndex: 30, display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Share this report</div>
              <div style={{ fontSize: 13, color: "var(--t1)", marginTop: 2 }}>Anyone with the link can read the report. They can’t see your chat or your other contracts.</div>
            </div>
            {token ? (
              <>
                <div style={{ display: "flex", gap: 8 }}>
                  <input readOnly value={shareUrl(token)} aria-label="Share link" onFocus={(e) => e.target.select()} style={{ flex: 1, minWidth: 0, font: "400 12px var(--mono)", color: "var(--t1)", background: "var(--bg1)", border: 0, borderRadius: 999, padding: "9px 14px", outline: "none" }} />
                  <button type="button" onClick={copy} style={{ ...btn, background: "var(--t0)", color: "var(--bg0)" }}>{copied ? "Copied" : "Copy"}</button>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(async () => { await unshareContract(sessionId); setToken(null); setOpen(false) })}
                  style={{ alignSelf: "flex-start", font: "500 13px var(--sans)", background: "none", border: 0, padding: 0, color: "var(--acctx)", cursor: "pointer" }}
                >
                  Stop sharing
                </button>
              </>
            ) : (
              <div style={{ fontSize: 13, color: "var(--t2)" }}>{busy ? "Creating link…" : ""}</div>
            )}
            {error && <div role="alert" style={{ fontSize: 13, color: "var(--acctx)" }}>{error}</div>}
          </div>
        )}
      </div>
    </>
  )
}
