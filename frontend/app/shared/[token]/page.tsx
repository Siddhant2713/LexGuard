"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { getSharedReport } from "@/lib/api"
import { inDocumentOrder } from "@/lib/utils"
import { Logo, ThemeToggle } from "@/components/brand"
import Dashboard from "@/components/dashboard/Dashboard"
import type { SharedReport } from "@/lib/types"

// Public, read-only view of a report someone shared. No account needed.
export default function SharedReportPage() {
  const { token } = useParams<{ token: string }>()
  const [report, setReport] = useState<SharedReport | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSharedReport(token).then(setReport).catch((e) => setError((e as Error).message))
  }, [token])

  const ready = report && report.aggregation

  return (
    <div className="lg-shell" style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <header className="lg-no-print" style={{ flex: "none", height: 60, borderBottom: "1px solid var(--bd0)", background: "var(--bg0)", display: "flex", alignItems: "center", gap: "clamp(12px,2vw,28px)", padding: "0 20px" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, flex: "none", color: "var(--t0)" }}>
          <Logo size={24} fontSize={18} />
        </Link>
        {ready && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
            <span style={{ color: "var(--bd1)" }}>/</span>
            <span style={{ font: "400 13px var(--mono)", color: "var(--t1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{report.filename}</span>
            <span style={{ font: "500 11px/1 var(--sans)", color: "var(--t2)", border: "1px solid var(--bd1)", padding: "5px 9px", borderRadius: 999, flex: "none" }}>Shared report</span>
          </div>
        )}
        <div style={{ flex: 1 }} />
        <ThemeToggle size={34} />
        <Link href="/register" style={{ font: "500 13px var(--sans)", background: "var(--t0)", color: "var(--bg0)", padding: "9px 16px", borderRadius: 999, whiteSpace: "nowrap", flex: "none" }}>Try LexGuard</Link>
      </header>

      {ready && (
        <Dashboard
          sessionId=""
          readOnly
          filename={report.filename}
          documentType={report.pass1_result.document_type}
          parties={report.pass1_result.parties ?? []}
          governingLaw={report.pass1_result.governing_law}
          clauses={inDocumentOrder(report.pass1_result.clauses)}
          riskReport={report.risk_report}
          aggregation={report.aggregation!}
          summary={report.summary}
        />
      )}

      {(report === null || error) && (
        <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
          <h1 style={{ margin: 0, fontFamily: "var(--serif)", fontWeight: 400, fontSize: 44, letterSpacing: "-0.035em" }}>Link not active</h1>
          <p style={{ margin: 0, fontSize: 15, color: "var(--t1)", maxWidth: 440 }}>
            {error ?? "This report is no longer shared. Ask the person who sent it for a new link."}
          </p>
          <Link href="/" style={{ marginTop: 12, font: "500 15px var(--sans)", background: "var(--t0)", color: "var(--bg0)", padding: "13px 22px", borderRadius: 999 }}>About LexGuard</Link>
        </main>
      )}
    </div>
  )
}
