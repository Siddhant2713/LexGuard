"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { deleteContract, listContracts } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { documentTitle, formatDate, severityLabel, severityStyle } from "@/lib/utils"
import AppShell from "@/components/AppShell"
import type { ContractSummary, Severity } from "@/lib/types"

type Filter = "all" | Severity

const FILTERS: [Filter, string][] = [["all", "All"], ["critical", "Critical"], ["high", "High"], ["medium", "Medium"], ["low", "Low"]]

/** "1 critical · 2 high" — the serious counts only; "Nothing serious" when only low ones remain. */
function flagsText(c: ContractSummary): string {
  if (!c.analyzed) return ""
  const parts = (["critical", "high", "medium"] as Severity[])
    .filter((s) => (c.summary?.[s] ?? 0) > 0)
    .map((s) => `${c.summary[s]} ${s}`)
  return parts.length ? parts.join(" · ") : "Nothing serious"
}

export default function ContractsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [contracts, setContracts] = useState<ContractSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>("all")
  const [search, setSearch] = useState("")
  const [armed, setArmed] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    listContracts().then(setContracts).catch((e) => setError((e as Error).message))
  }, [user])

  async function remove(id: string) {
    if (armed !== id) return setArmed(id)
    setArmed(null)
    try {
      await deleteContract(id)
      setContracts((cs) => cs?.filter((c) => c.session_id !== id) ?? null)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const q = search.trim().toLowerCase()
  const rows = (contracts ?? []).filter(
    (c) => (filter === "all" || c.overall_risk === filter) && c.filename.toLowerCase().includes(q),
  )

  return (
    <AppShell>
      <main style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "clamp(40px,6vw,80px) clamp(20px,4vw,48px) 80px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 24, marginBottom: 40 }}>
            <h1 style={{ margin: 0, fontFamily: "var(--serif)", fontWeight: 400, fontSize: "clamp(48px,6vw,80px)", lineHeight: 0.95, letterSpacing: "-0.04em" }}>Contracts</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                aria-label="Search contracts"
                style={{ width: 220, font: "15px var(--sans)", color: "var(--t0)", background: "var(--bg1)", border: 0, borderRadius: 999, padding: "11px 18px", outline: "none" }}
              />
              <Link href="/new" style={{ font: "500 14px var(--sans)", background: "var(--t0)", color: "var(--bg0)", padding: "12px 20px", borderRadius: 999, whiteSpace: "nowrap" }}>New analysis</Link>
            </div>
          </div>

          <div role="tablist" style={{ display: "flex", flexWrap: "wrap", gap: 24, borderBottom: "1px solid var(--bd1)", fontSize: 14 }}>
            {FILTERS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
                style={{ padding: "0 0 14px", cursor: "pointer", whiteSpace: "nowrap", background: "none", border: 0, fontSize: 14, color: filter === key ? "var(--t0)" : "var(--t2)", borderBottom: `2px solid ${filter === key ? "var(--acc)" : "transparent"}`, marginBottom: -1 }}
              >
                {label}
              </button>
            ))}
          </div>

          {error && <div role="alert" style={{ padding: "16px 8px 0", fontSize: 14, color: "var(--acctx)" }}>{error}</div>}

          {rows.map((c) => {
            const sev = c.overall_risk
            const L = sev ? severityStyle[sev] : { lbg: "transparent", lbd: "var(--bd1)", ltx: "var(--t2)" }
            const isArmed = armed === c.session_id
            return (
              <div
                key={c.session_id}
                className="lg-row"
                role="link"
                tabIndex={0}
                onClick={() => router.push(`/analyze/${c.session_id}`)}
                onKeyDown={(e) => e.key === "Enter" && router.push(`/analyze/${c.session_id}`)}
                onMouseLeave={() => isArmed && setArmed(null)}
                style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto auto", gap: "clamp(16px,3vw,48px)", alignItems: "center", padding: "24px 8px", borderBottom: "1px solid var(--bd0)", cursor: "pointer", borderRadius: 4 }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.filename}</div>
                  <div style={{ fontSize: 14, color: "var(--t2)", marginTop: 2 }}>{documentTitle(c.document_type)} · {formatDate(c.created_at)}</div>
                </div>
                <div style={{ fontSize: 14, color: "var(--t1)", whiteSpace: "nowrap" }}>{flagsText(c)}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 14, justifyContent: "flex-end", minWidth: 150 }}>
                  <span style={{ font: "500 12px/1 var(--sans)", color: L.ltx, background: L.lbg, border: `1px solid ${L.lbd}`, padding: "6px 11px", borderRadius: 999, whiteSpace: "nowrap" }}>
                    {sev ? severityLabel[sev] : "Not analyzed"}
                  </span>
                  <span style={{ fontFamily: "var(--serif)", fontSize: 34, lineHeight: 1, letterSpacing: "-0.03em", width: 52, textAlign: "right" }}>
                    {c.risk_score != null ? c.risk_score.toFixed(1) : "–"}
                  </span>
                </div>
                <button
                  type="button"
                  className={`lg-row-del${isArmed ? " is-armed" : ""}`}
                  aria-label={isArmed ? `Confirm delete ${c.filename}` : `Delete ${c.filename}`}
                  title={isArmed ? "Click again to delete" : "Delete"}
                  onClick={(e) => { e.stopPropagation(); remove(c.session_id) }}
                  onKeyDown={(e) => e.stopPropagation()}
                  style={{ font: "500 12px var(--sans)", border: 0, borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap", padding: isArmed ? "6px 11px" : 0, width: isArmed ? "auto" : 28, height: 28, display: "grid", placeItems: "center", background: isArmed ? "var(--acc)" : "transparent", color: isArmed ? "var(--onacc)" : "var(--t2)" }}
                >
                  {isArmed ? "Delete" : (
                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                      <path d="M2.5 4h9M5.5 4V2.5h3V4M3.5 4l.6 8h5.8l.6-8" style={{ fill: "none", stroke: "currentColor", strokeWidth: 1.2 }} />
                    </svg>
                  )}
                </button>
              </div>
            )
          })}

          {contracts && rows.length === 0 && (
            <div style={{ padding: "64px 0", textAlign: "center", color: "var(--t2)" }}>
              {contracts.length === 0 ? "No contracts yet." : "No contracts match."}
            </div>
          )}
        </div>
      </main>
    </AppShell>
  )
}
