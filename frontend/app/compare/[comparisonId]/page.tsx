"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { getComparison, needsPro } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { severityLabel, severityStyle } from "@/lib/utils"
import AppShell from "@/components/AppShell"
import { verdictLabel, verdictStyle } from "@/components/compare/verdict"
import type { ClauseChange, Comparison, Severity } from "@/lib/types"

const KIND: Record<ClauseChange["kind"], string> = { added: "Added", removed: "Removed", changed: "Changed" }
const IMPACT: Record<NonNullable<ClauseChange["impact"]>, { label: string; style: React.CSSProperties } | null> = {
  better: { label: "Better for you", style: { color: "var(--t0)", border: "1px solid var(--t0)" } },
  worse: { label: "Worse for you", style: { color: "var(--onacc)", background: "var(--acc)", border: "1px solid var(--acc)" } },
  neutral: null,
}
// Riskier changes first, then everything else in document order.
const IMPACT_ORDER = { worse: 0, better: 1, neutral: 2 }

const pill: React.CSSProperties = { font: "500 11px/1 var(--sans)", padding: "4px 9px", borderRadius: 999, whiteSpace: "nowrap", flex: "none" }

function SeverityPill({ s }: { s: Severity | null }) {
  if (!s) return <span style={{ ...pill, color: "var(--t2)", border: "1px dashed var(--bd1)" }}>Not flagged</span>
  const L = severityStyle[s]
  return <span style={{ ...pill, color: L.ltx, background: L.lbg, border: `1px solid ${L.lbd}` }}>{severityLabel[s]}</span>
}

function ScoreBlock({ label, score, risk }: { label: string; score: number; risk: Severity | null }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ font: "500 12px/1 var(--mono)", letterSpacing: ".08em", color: "var(--t2)" }}>{label}</span>
      <span style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontFamily: "var(--serif)", fontSize: "clamp(44px,5vw,64px)", lineHeight: 0.9, letterSpacing: "-0.04em" }}>{score.toFixed(1)}</span>
        {risk && <span style={{ fontSize: 14, color: "var(--t1)" }}>{severityLabel[risk]} risk</span>}
      </span>
    </div>
  )
}

/** The clause text with deletions struck through and additions shaded. */
function ClauseText({ change }: { change: ClauseChange }) {
  const body: React.CSSProperties = { fontSize: 14.5, lineHeight: 1.7, color: "var(--t1)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }
  if (change.kind === "added") return <div style={{ ...body, background: "var(--th)", borderRadius: 8, padding: "10px 14px", color: "var(--t0)" }}>{change.after}</div>
  if (change.kind === "removed") return <div style={{ ...body, textDecoration: "line-through", textDecorationColor: "var(--t2)", color: "var(--t2)" }}>{change.before}</div>
  return (
    <div style={body}>
      {(change.diff ?? []).map((r, i) =>
        r.op === "same" ? <span key={i}>{r.text}</span>
        : r.op === "del" ? <del key={i} style={{ color: "var(--t2)", textDecorationColor: "var(--t2)" }}>{r.text}</del>
        : <ins key={i} style={{ textDecoration: "none", background: "var(--tc)", color: "var(--t0)", borderRadius: 3, padding: "1px 0" }}>{r.text}</ins>,
      )}
    </div>
  )
}

export default function ComparisonPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { comparisonId } = useParams<{ comparisonId: string }>()
  const [c, setC] = useState<Comparison | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    getComparison(comparisonId).then(setC).catch((e) => {
      if (needsPro(e)) router.replace("/billing?feature=compare")
      else setError((e as Error).message)
    })
  }, [user, comparisonId, router])

  const counts = c && (["changed", "added", "removed"] as const).map((k) => `${c.changes.filter((x) => x.kind === k).length} ${k}`)
  const ordered = c ? [...c.changes].sort((a, b) => IMPACT_ORDER[a.impact ?? "neutral"] - IMPACT_ORDER[b.impact ?? "neutral"]) : []
  const riskMoves = c ? c.risks.filter((r) => r.before !== r.after) : []

  return (
    <AppShell>
      <main style={{ flex: 1, minHeight: 0, overflowY: "auto", background: "var(--bg1)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "clamp(40px,6vw,72px) clamp(20px,4vw,48px) 80px", display: "flex", flexDirection: "column", gap: 40 }}>
          {error && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start" }}>
              <h1 style={{ margin: 0, fontFamily: "var(--serif)", fontWeight: 400, fontSize: 44, letterSpacing: "-0.035em" }}>Comparison not found</h1>
              <p style={{ margin: 0, color: "var(--t1)" }}>{error}</p>
              <Link href="/compare" style={{ font: "500 15px var(--sans)", background: "var(--t0)", color: "var(--bg0)", padding: "13px 22px", borderRadius: 999 }}>Back to Compare</Link>
            </div>
          )}

          {c && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <div style={{ font: "400 13px var(--mono)", color: "var(--t2)", overflowWrap: "anywhere" }}>
                  <Link href={`/analyze/${c.base.session_id}`} style={{ color: "var(--t1)" }}>{c.base.filename}</Link>
                  <span style={{ margin: "0 10px" }}>→</span>
                  <Link href={`/analyze/${c.revised.session_id}`} style={{ color: "var(--t1)" }}>{c.revised.filename}</Link>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
                  <h1 style={{ margin: 0, fontFamily: "var(--serif)", fontWeight: 400, fontSize: "clamp(44px,6vw,76px)", lineHeight: 0.95, letterSpacing: "-0.04em" }}>{verdictLabel[c.verdict]}</h1>
                  <span style={{ ...pill, font: "500 12px/1 var(--sans)", padding: "6px 11px", ...verdictStyle[c.verdict] }}>Revised version</span>
                </div>
                <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: "var(--t1)", maxWidth: 680, textWrap: "pretty" } as React.CSSProperties}>{c.summary}</p>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "24px clamp(28px,5vw,64px)", borderTop: "1px solid var(--bd1)", paddingTop: 28 }}>
                <ScoreBlock label="ORIGINAL" score={c.before.risk_score} risk={c.before.overall_risk} />
                <span aria-hidden="true" style={{ font: "400 28px var(--sans)", color: "var(--t2)", paddingBottom: 8 }}>→</span>
                <ScoreBlock label="REVISED" score={c.after.risk_score} risk={c.after.overall_risk} />
                <div style={{ flex: "1 1 200px", textAlign: "right", font: "400 13px var(--mono)", color: "var(--t2)", paddingBottom: 8 }}>
                  {counts!.join(" · ")} · {c.unchanged} unchanged
                </div>
              </div>

              {riskMoves.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ font: "500 12px/1 var(--mono)", letterSpacing: ".08em", color: "var(--t2)", paddingBottom: 14, borderBottom: "1px solid var(--bd1)" }}>FLAGGED RISKS</div>
                  {riskMoves.map((r, i) => (
                    <div key={i} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 16px", padding: "16px 4px", borderBottom: "1px solid var(--bd0)" }}>
                      <span style={{ flex: "1 1 240px", fontSize: 15, minWidth: 0 }}>{r.risk_type}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <SeverityPill s={r.before} />
                        <span aria-hidden="true" style={{ color: "var(--t2)" }}>→</span>
                        {r.after ? <SeverityPill s={r.after} /> : <span style={{ ...pill, color: "var(--t1)", border: "1px solid var(--bd1)" }}>Gone</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {ordered.map((ch) => {
                  const impact = ch.impact ? IMPACT[ch.impact] : null
                  return (
                    <article key={ch.key} style={{ background: "var(--bg0)", borderRadius: 16, padding: "clamp(20px,3vw,32px)", display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                        <span style={{ ...pill, color: "var(--t1)", background: "var(--bg2)" }}>{KIND[ch.kind]}</span>
                        {impact && <span style={{ ...pill, ...impact.style }}>{impact.label}</span>}
                        <span style={{ flex: 1 }} />
                        {(ch.severity_before || ch.severity_after) && (
                          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {ch.kind !== "added" && <SeverityPill s={ch.severity_before} />}
                            {ch.kind === "changed" && <span aria-hidden="true" style={{ color: "var(--t2)" }}>→</span>}
                            {ch.kind !== "removed" && <SeverityPill s={ch.severity_after} />}
                          </span>
                        )}
                      </div>
                      <div style={{ fontFamily: "var(--serif)", fontSize: 24, lineHeight: 1.1, letterSpacing: "-0.02em" }}>{ch.heading}</div>
                      {ch.note && <div style={{ borderLeft: "2px solid var(--acc)", paddingLeft: 14, fontSize: 15, lineHeight: 1.6 }}>{ch.note}</div>}
                      <ClauseText change={ch} />
                    </article>
                  )
                })}
                {c.changes.length === 0 && <div style={{ padding: "48px 0", textAlign: "center", color: "var(--t2)" }}>The two versions have the same clauses.</div>}
              </div>

              <p style={{ margin: 0, fontSize: 12, color: "var(--t2)" }}>LexGuard is not a law firm and does not give legal advice.</p>
            </>
          )}
        </div>
      </main>
    </AppShell>
  )
}
