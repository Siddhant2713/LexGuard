"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { compareContracts, listComparisons, listContracts, needsPro } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { formatDate } from "@/lib/utils"
import AppShell from "@/components/AppShell"
import { verdictLabel, verdictStyle } from "@/components/compare/verdict"
import type { ComparisonSummary, ContractSummary } from "@/lib/types"

const selectStyle: React.CSSProperties = {
  width: "100%", font: "15px var(--sans)", color: "var(--t0)", background: "var(--bg1)", border: "1.5px solid transparent",
  borderRadius: 14, padding: "16px 18px", outline: "none", appearance: "none", cursor: "pointer",
}

function Picker({ label, value, onChange, contracts, exclude }: { label: string; value: string; onChange: (v: string) => void; contracts: ContractSummary[]; exclude: string }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 10, flex: "1 1 300px", minWidth: 0 }}>
      <span style={{ font: "500 12px/1 var(--mono)", letterSpacing: ".08em", color: "var(--t2)" }}>{label}</span>
      <select className="lg-input" value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
        <option value="">Choose a contract</option>
        {contracts.filter((c) => c.session_id !== exclude).map((c) => (
          <option key={c.session_id} value={c.session_id}>{c.filename} · {formatDate(c.created_at)}</option>
        ))}
      </select>
    </label>
  )
}

export default function ComparePage() {
  const { user } = useAuth()
  const router = useRouter()
  const isPro = user?.plan === "pro"
  const [contracts, setContracts] = useState<ContractSummary[] | null>(null)
  const [history, setHistory] = useState<ComparisonSummary[]>([])
  const [baseId, setBaseId] = useState("")
  const [revisedId, setRevisedId] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user || !isPro) return
    listContracts().then((cs) => setContracts(cs.filter((c) => c.analyzed))).catch((e) => setError((e as Error).message))
    listComparisons().then(setHistory).catch(() => {})
  }, [user, isPro])

  async function run() {
    if (!baseId || !revisedId) return setError("Pick the original and the revised version.")
    setBusy(true)
    setError(null)
    try {
      router.push(`/compare/${await compareContracts(baseId, revisedId)}`)
    } catch (e) {
      if (needsPro(e)) return router.push("/billing?feature=compare")
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <AppShell>
      <main style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "clamp(40px,6vw,80px) clamp(20px,4vw,48px) 80px", display: "flex", flexDirection: "column", gap: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h1 style={{ margin: 0, fontFamily: "var(--serif)", fontWeight: 400, fontSize: "clamp(48px,6vw,80px)", lineHeight: 0.95, letterSpacing: "-0.04em" }}>Compare</h1>
            <p style={{ margin: 0, fontSize: 17, color: "var(--t1)", maxWidth: 560, textWrap: "pretty" } as React.CSSProperties}>
              Got a revised version back? See every clause that changed, and whether the changes help you or hurt you.
            </p>
          </div>

          {!isPro ? (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "clamp(28px,4vw,48px)", borderRadius: 24, background: "var(--bg1)" }}>
              <div style={{ fontFamily: "var(--serif)", fontSize: "clamp(28px,3vw,40px)", lineHeight: 1.05, letterSpacing: "-0.03em", maxWidth: 560 }}>Comparing versions is part of Pro.</div>
              <Link href="/billing?feature=compare" className="lg-btn-acc" style={{ font: "500 15px var(--sans)", background: "var(--acc)", color: "var(--onacc)", padding: "14px 26px", borderRadius: 999, whiteSpace: "nowrap" }}>Get Pro</Link>
            </div>
          ) : contracts && contracts.length < 2 ? (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "clamp(28px,4vw,48px)", borderRadius: 24, border: "1.5px dashed var(--bd1)" }}>
              <div style={{ fontSize: 17, color: "var(--t1)", maxWidth: 520 }}>Analyze both versions first. You have {contracts.length === 0 ? "no" : "one"} analyzed contract so far.</div>
              <Link href="/new" style={{ font: "500 15px var(--sans)", background: "var(--t0)", color: "var(--bg0)", padding: "13px 22px", borderRadius: 999, whiteSpace: "nowrap" }}>New analysis</Link>
            </div>
          ) : contracts && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 16 }}>
                <Picker label="ORIGINAL" value={baseId} onChange={setBaseId} contracts={contracts} exclude={revisedId} />
                <span aria-hidden="true" style={{ font: "400 20px var(--sans)", color: "var(--t2)", padding: "0 4px 16px" }}>→</span>
                <Picker label="REVISED" value={revisedId} onChange={setRevisedId} contracts={contracts} exclude={baseId} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
                <button
                  type="button"
                  className="lg-btn-acc"
                  onClick={run}
                  disabled={busy}
                  style={{ font: "500 15px var(--sans)", background: "var(--acc)", color: "var(--onacc)", border: 0, padding: "14px 26px", borderRadius: 999, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1 }}
                >
                  {busy ? "Comparing…" : "Compare"}
                </button>
                {busy && <span style={{ fontSize: 14, color: "var(--t2)" }}>Reading both versions. This takes a few seconds.</span>}
              </div>
            </div>
          )}

          {error && <div role="alert" style={{ marginTop: -16, fontSize: 14, color: "var(--acctx)" }}>{error}</div>}

          {isPro && history.length > 0 && (
            <div>
              <div style={{ font: "500 12px/1 var(--mono)", letterSpacing: ".08em", color: "var(--t2)", paddingBottom: 14, borderBottom: "1px solid var(--bd1)" }}>PAST COMPARISONS</div>
              {history.map((h) => (
                <Link
                  key={h.comparison_id}
                  href={`/compare/${h.comparison_id}`}
                  className="lg-row"
                  style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 24, alignItems: "center", padding: "22px 8px", borderBottom: "1px solid var(--bd0)", borderRadius: 4 }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {h.base_filename} <span style={{ color: "var(--t2)", fontWeight: 400 }}>→</span> {h.revised_filename}
                    </div>
                    <div style={{ fontSize: 14, color: "var(--t2)", marginTop: 2 }}>{formatDate(h.created_at)}</div>
                  </div>
                  {h.verdict && (
                    <span style={{ font: "500 12px/1 var(--sans)", padding: "6px 11px", borderRadius: 999, whiteSpace: "nowrap", ...verdictStyle[h.verdict] }}>{verdictLabel[h.verdict]}</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </AppShell>
  )
}
