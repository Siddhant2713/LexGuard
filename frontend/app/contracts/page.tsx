"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { listContracts } from "@/lib/api"
import { useRequireAuth } from "@/lib/auth"
import AppNav from "@/components/AppNav"
import type { ContractSummary, Severity } from "@/lib/types"

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"]

export default function ContractsPage() {
  const { user } = useRequireAuth()
  const [contracts, setContracts] = useState<ContractSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    listContracts().then(setContracts).catch((e) => setError((e as Error).message))
  }, [user])

  if (!user) return null

  return (
    <main style={{ minHeight: "100vh", padding: "88px 24px 48px", maxWidth: "860px", margin: "0 auto" }}>
      <AppNav />
      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "36px", fontWeight: 400, color: "var(--text-0)", marginBottom: "24px" }}>
        My contracts
      </h1>

      {error && <p style={{ color: "var(--sev-critical-text)", fontFamily: "var(--font-sans)", fontSize: "13px" }}>{error}</p>}
      {!contracts && !error && <p style={{ color: "var(--text-2)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>Loading…</p>}
      {contracts?.length === 0 && (
        <p style={{ color: "var(--text-1)", fontFamily: "var(--font-sans)", fontSize: "14px" }}>
          Nothing here yet. <Link href="/" style={{ color: "var(--text-0)" }}>Analyze your first contract</Link>.
        </p>
      )}

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
        {contracts?.map((c) => {
          const risk = c.overall_risk
          return (
            <li key={c.session_id}>
              <Link
                href={`/analyze/${c.session_id}`}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", padding: "14px 16px", border: "1px solid var(--border-1)", background: "var(--bg-1)", textDecoration: "none" }}
              >
                <span>
                  <span style={{ display: "block", fontFamily: "var(--font-sans)", fontSize: "15px", color: "var(--text-0)" }}>{c.filename}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-2)" }}>
                    {c.document_type || "Document"} · {new Date(c.created_at).toLocaleDateString()}
                  </span>
                </span>
                {risk ? (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: `var(--sev-${risk}-text)`, background: `var(--sev-${risk}-bg)`, border: `1px solid var(--sev-${risk}-border)`, padding: "4px 10px" }}>
                    {risk}
                    {c.risk_score != null && ` · ${c.risk_score.toFixed(1)}`}
                    {" "}
                    <span style={{ opacity: 0.7 }}>
                      ({SEVERITIES.map((s) => c.summary?.[s] ?? 0).join("/")})
                    </span>
                  </span>
                ) : (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-2)" }}>Not analyzed</span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
