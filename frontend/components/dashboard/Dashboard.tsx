"use client"

import { useMemo, useRef, useState } from "react"
import type { AggregationResult, RawClause, RiskAnalysis, Severity } from "@/lib/types"
import { clauseNumber, documentTitle, SEVERITIES, severityLabel, severityStyle, severityWeight } from "@/lib/utils"
import ErrorBoundary from "@/components/ErrorBoundary"
import ChatPanel, { type ChatItem } from "./ChatPanel"

export interface DashboardProps {
  sessionId: string
  filename: string
  documentType: string
  parties: string[]
  governingLaw: string | null
  /** In document order. */
  clauses: RawClause[]
  riskReport: RiskAnalysis[]
  aggregation: AggregationResult
  summary: Record<Severity, number>
  /** Renders the export layout that window.print() uses (Pro). */
  printable?: boolean
  /** Shared reports: no chat composer, nothing that calls the owner-only API. */
  readOnly?: boolean
}

const legendSwatch: Record<Severity, React.CSSProperties> = {
  critical: { background: "var(--tc)" },
  high: { background: "var(--th)" },
  medium: { background: "var(--tm)" },
  low: { background: "var(--tl)", outline: "1px solid var(--bd1)" },
}

const sectionLabel = (color: string): React.CSSProperties => ({ font: "500 11px var(--mono)", letterSpacing: ".06em", color, marginBottom: 4 })

export default function Dashboard(props: DashboardProps) {
  const { sessionId, filename, documentType, parties, governingLaw, clauses, riskReport, aggregation, summary, printable, readOnly } = props
  const docRef = useRef<HTMLElement>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [flash, setFlash] = useState(0)
  const [items, setItems] = useState<ChatItem[]>([{ kind: "summary" }])

  const analyses = useMemo(() => Object.fromEntries(riskReport.map((r) => [r.clause_id, r])), [riskReport])
  const headings = useMemo(() => Object.fromEntries(clauses.map((c) => [c.id, c.heading])), [clauses])
  const order = useMemo(() => Object.fromEntries(clauses.map((c, i) => [c.id, i])), [clauses])
  const flags = useMemo(
    () => [...riskReport].sort((a, b) => severityWeight(a.severity) - severityWeight(b.severity) || (order[a.clause_id] ?? 0) - (order[b.clause_id] ?? 0)),
    [riskReport, order],
  )

  const serious = (summary.critical ?? 0) + (summary.high ?? 0)
  const title = documentTitle(documentType)
  const docName = title.toLowerCase()
  const opening =
    `I read your ${docName} and flagged ${flags.length} clause${flags.length === 1 ? "" : "s"}. ` +
    (serious === 0 ? "None of them look serious." : `${serious === 1 ? "One is" : `${serious} are`} worth negotiating before you sign.`)
  const law = governingLaw ? `Governed by ${governingLaw}${/law/i.test(governingLaw) ? "" : " law"}` : null
  const meta = [...parties, law].filter(Boolean).join(" · ")

  function pickClause(id: string, fromChat = false) {
    setSel(id)
    setFlash((f) => f + 1)
    if (!fromChat && analyses[id]) {
      setItems((prev) => {
        const last = prev[prev.length - 1]
        return last?.kind === "clause" && last.cid === id ? prev : [...prev, { kind: "clause", cid: id }]
      })
    }
    const doc = docRef.current
    const el = doc?.querySelector<HTMLElement>(`[data-cid="${CSS.escape(id)}"]`)
    if (doc && el) doc.scrollTo({ top: el.offsetTop - 120, behavior: "smooth" })
  }

  return (
    <>
      <main className="lg-no-print" style={{ flex: 1, minHeight: 0, display: "flex" }}>
        {/* ── Flags ── */}
        <nav style={{ flex: "0 0 clamp(196px,18vw,248px)", borderRight: "1px solid var(--bd0)", display: "flex", flexDirection: "column", minHeight: 0, background: "var(--bg0)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "20px 20px 12px" }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Flags</span>
            <span style={{ font: "500 12px var(--mono)", color: "var(--t2)" }}>{flags.length}</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "0 10px 16px", display: "flex", flexDirection: "column", gap: 2 }}>
            {flags.map((f) => {
              const L = severityStyle[f.severity]
              const active = sel === f.clause_id
              return (
                <button
                  key={f.clause_id}
                  type="button"
                  className="lg-flag"
                  onClick={() => pickClause(f.clause_id)}
                  style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 10, borderRadius: 12, cursor: "pointer", background: active ? "var(--bg2)" : "transparent", border: 0, textAlign: "left", font: "inherit", color: "inherit" }}
                >
                  <span style={{ width: 9, height: 9, marginTop: 5, flex: "none", borderRadius: "50%", background: f.severity === "critical" ? "var(--acc)" : L.tint, border: `1.5px solid ${L.lbd}` }} />
                  <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1, lineHeight: 1.3, gap: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: f.severity === "critical" || f.severity === "high" ? "var(--acctx)" : "var(--t2)" }}>{severityLabel[f.severity]}</span>
                    <span style={{ fontSize: 14, color: active ? "var(--t0)" : "var(--t1)" }}>{f.risk_type}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </nav>

        {/* ── Document ── */}
        <section ref={docRef} style={{ flex: "1 1 0", minWidth: 420, background: "var(--bg1)", overflowY: "auto", overflowX: "hidden", position: "relative" }}>
          <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px clamp(16px,2.5vw,32px) 64px", display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "14px 32px", padding: "0 4px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, flex: "none" }}>
                <span style={{ fontFamily: "var(--serif)", fontSize: 40, lineHeight: 0.9, letterSpacing: "-0.035em" }}>{severityLabel[aggregation.overall_risk]} risk</span>
                <span style={{ font: "500 14px var(--mono)", color: "var(--t2)", whiteSpace: "nowrap" }}>{aggregation.risk_score.toFixed(1)} / 10</span>
              </div>
              <div style={{ flex: "1 1 260px", fontSize: 14, color: "var(--t1)", lineHeight: 1.5 }}>{aggregation.summary}</div>
              <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--t1)", flexWrap: "wrap", width: "100%" }}>
                {SEVERITIES.map((s) => (
                  <span key={s} style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                    <span style={{ width: 14, height: 10, borderRadius: 3, ...legendSwatch[s] }} />
                    {summary[s] ?? 0} {s}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ background: "var(--bg0)", borderRadius: 12, padding: "clamp(28px,4vw,56px)", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontFamily: "var(--serif)", fontSize: "clamp(26px,3vw,34px)", lineHeight: 1.05, letterSpacing: "-0.025em" }}>{title}</div>
              <div style={{ font: "400 12px var(--mono)", color: "var(--t2)", marginBottom: 20 }}>{meta}</div>
              {clauses.map((c) => {
                const a = analyses[c.id]
                const L = a ? severityStyle[a.severity] : null
                const selected = a && sel === c.id
                return (
                  <div
                    key={c.id}
                    data-cid={c.id}
                    onClick={() => a && pickClause(c.id)}
                    style={{
                      position: "relative", padding: "12px 16px", margin: "0 -16px", borderRadius: 10, fontSize: 14.5, lineHeight: 1.7, color: "var(--t1)",
                      background: L ? L.tint : "transparent",
                      boxShadow: selected && L ? `0 0 0 1.5px ${L.ring}` : "none",
                      animation: selected && flash ? `${flash % 2 ? "lgFlashA" : "lgFlashB"} 1.4s cubic-bezier(.19,1,.22,1)` : "none",
                      cursor: a ? "pointer" : "default",
                    }}
                  >
                    {a && L && (
                      <span style={{ position: "absolute", right: 12, top: -9, font: "500 10.5px/1 var(--sans)", background: L.lbg, color: L.ltx, border: `1px solid ${L.lbd}`, padding: "3px 8px", borderRadius: 999 }}>
                        {severityLabel[a.severity]}
                      </span>
                    )}
                    <b style={{ color: "var(--t0)", fontWeight: 500 }}>{clauseNumber(c.id)}. {c.heading}.</b> {c.text}
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <ErrorBoundary>
          <ChatPanel sessionId={sessionId} readOnly={readOnly} items={items} setItems={setItems} summary={opening} analyses={analyses} headings={headings} onCite={(id) => pickClause(id, true)} />
        </ErrorBoundary>
      </main>

      {/* ── Export: what window.print() renders ── */}
      {printable && <div className="lg-print-only" style={{ padding: "0 8px", color: "var(--t0)" }}>
        <div style={{ font: "400 11px var(--mono)", color: "var(--t2)" }}>LexGuard report · {filename}</div>
        <h1 style={{ margin: "12px 0 4px", fontFamily: "var(--serif)", fontWeight: 400, fontSize: 34, letterSpacing: "-0.025em" }}>{title}</h1>
        <div style={{ font: "400 12px var(--mono)", color: "var(--t2)" }}>{meta}</div>
        <div style={{ margin: "24px 0", display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontFamily: "var(--serif)", fontSize: 28 }}>{severityLabel[aggregation.overall_risk]} risk</span>
          <span style={{ font: "500 13px var(--mono)", color: "var(--t2)" }}>{aggregation.risk_score.toFixed(1)} / 10</span>
        </div>
        <p style={{ margin: "0 0 28px", fontSize: 14, lineHeight: 1.6 }}>{aggregation.summary}</p>
        {flags.map((f) => (
          <div key={f.clause_id} style={{ breakInside: "avoid", borderTop: "1px solid var(--bd1)", padding: "18px 0", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ font: "400 12px var(--mono)", color: "var(--t2)" }}>{severityLabel[f.severity]} · §{clauseNumber(f.clause_id)} {headings[f.clause_id] ?? ""}</div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 22 }}>{f.risk_type}</div>
            <div><div style={sectionLabel("var(--t2)")}>IN PLAIN ENGLISH</div><div style={{ fontSize: 13.5, lineHeight: 1.6 }}>{f.plain_english}</div></div>
            <div><div style={sectionLabel("var(--acctx)")}>IF YOU SIGN THIS</div><div style={{ fontSize: 13.5, lineHeight: 1.6 }}>{f.consequence}</div></div>
            <div><div style={sectionLabel("var(--t2)")}>WHAT TO ASK FOR</div><div style={{ fontSize: 13.5, lineHeight: 1.6 }}>{f.negotiation_tip}</div></div>
          </div>
        ))}
        <p style={{ marginTop: 24, fontSize: 11, color: "var(--t2)" }}>LexGuard is not a law firm and does not give legal advice.</p>
      </div>}
    </>
  )
}
