"use client"

import type { RawClause } from "@/lib/types"
import { clauseNumber, documentTitle, severityFromScore, severityLabel, severityStyle, severityWeight } from "@/lib/utils"

interface AnalyzingProps {
  filename: string
  documentType: string
  parties: string[]
  /** In document order. */
  clauses: RawClause[]
  /** How many clauses have been read, scaled from the API's Pass 2 progress. */
  progress: number
}

export default function Analyzing({ filename, documentType, parties, clauses, progress }: AnalyzingProps) {
  const total = clauses.length
  const done = Math.min(progress, total)
  const current = clauses[Math.min(progress, total - 1)]
  // Provisional marks from the pass-1 suspicion score; the dashboard shows the real severities.
  const found = clauses
    .slice(0, done)
    .map((c) => ({ c, sev: severityFromScore(c.suspicion_score) }))
    .filter(({ sev }) => severityWeight(sev) <= severityWeight("medium"))
    .reverse()

  return (
    <main style={{ flex: 1, minHeight: 0, display: "flex", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, height: 2, width: `${total ? Math.round((done / total) * 100) : 0}%`, background: "var(--acc)", transition: "width .35s cubic-bezier(.19,1,.22,1)", zIndex: 3 }} />

      <div style={{ flex: "1 1 58%", minWidth: 0, background: "var(--bg1)", overflow: "hidden", padding: "clamp(24px,4vw,56px)", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 660, background: "var(--bg0)", borderRadius: 12, padding: "clamp(28px,4vw,56px)", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 30, letterSpacing: "-0.02em" }}>{documentTitle(documentType)}</div>
          <div style={{ font: "400 12px var(--mono)", color: "var(--t2)", marginBottom: 18 }}>{parties.join(" · ")}</div>
          {clauses.map((c, i) => {
            const isDone = i < done
            const isActive = i === progress
            const sev = severityFromScore(c.suspicion_score)
            const L = severityStyle[sev]
            const text = c.text.length > 110 ? c.text.slice(0, 110) + "…" : c.text
            return (
              <div
                key={c.id}
                style={{ position: "relative", padding: "10px 14px", borderRadius: 8, fontSize: 13.5, lineHeight: 1.6, color: "var(--t1)", background: isDone ? L.tint : "transparent", opacity: isDone || isActive ? 1 : 0.35, boxShadow: isActive ? "0 0 0 1px var(--acc)" : "none", transition: "background-color .5s, opacity .4s" }}
              >
                {isDone && (
                  <span style={{ position: "absolute", right: 10, top: -9, font: "500 10px/1 var(--sans)", background: L.lbg, color: L.ltx, border: `1px solid ${L.lbd}`, padding: "3px 8px", borderRadius: 999 }}>
                    {severityLabel[sev]}
                  </span>
                )}
                <b style={{ color: "var(--t0)", fontWeight: 500 }}>{clauseNumber(c.id)}. {c.heading}.</b> {text}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ flex: "1 1 42%", minWidth: 320, display: "flex", flexDirection: "column", justifyContent: "center", gap: 28, padding: "clamp(28px,4vw,64px)" }}>
        <div style={{ font: "400 13px var(--mono)", color: "var(--t2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{filename}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontFamily: "var(--serif)", fontSize: "clamp(88px,10vw,144px)", lineHeight: 0.8, letterSpacing: "-0.05em" }}>{done}</span>
          <span style={{ fontFamily: "var(--serif)", fontSize: "clamp(32px,3vw,44px)", color: "var(--t2)", letterSpacing: "-0.03em" }}>/ {total}</span>
        </div>
        <div style={{ fontSize: 17, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--acc)", animation: "lgPulse .9s ease-in-out infinite", flex: "none" }} />
          {progress >= total || !current ? "Preparing your report" : `Reading §${clauseNumber(current.id)} ${current.heading}`}
        </div>
        <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid var(--bd1)", minHeight: 180 }}>
          {found.map(({ c, sev }) => {
            const L = severityStyle[sev]
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: "1px solid var(--bd0)", animation: "lgUp .5s cubic-bezier(.19,1,.22,1) both" }}>
                <span style={{ font: "500 11px/1 var(--sans)", color: L.ltx, background: L.lbg, border: `1px solid ${L.lbd}`, padding: "4px 9px", borderRadius: 999, flex: "none" }}>{severityLabel[sev]}</span>
                <span style={{ fontSize: 15 }}>{c.heading}</span>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
