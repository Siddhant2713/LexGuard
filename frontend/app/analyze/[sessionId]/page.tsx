"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import type { AggregationResult, RawClause, RiskAnalysis, Severity } from "@/lib/types"
import { analyzeContract, getAnalyzeProgress, getReport } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { inDocumentOrder } from "@/lib/utils"
import AppShell from "@/components/AppShell"
import Analyzing from "@/components/analysis/Analyzing"
import Dashboard from "@/components/dashboard/Dashboard"
import ReportActions from "@/components/dashboard/ReportActions"

type Phase = "loading" | "analyzing" | "dashboard" | "error"

interface Doc {
  filename: string
  documentType: string
  parties: string[]
  governingLaw: string | null
  clauses: RawClause[]
  shareToken: string | null
}

interface Result {
  riskReport: RiskAnalysis[]
  aggregation: AggregationResult
  summary: Record<Severity, number>
}

// /analyze answers once, when everything is done; meanwhile the API records how many clauses
// Pass 2 has finished, and this page polls it.
const POLL_MS = 1000

export default function AnalyzePage() {
  const { user } = useAuth()
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string

  const [phase, setPhase] = useState<Phase>("loading")
  const [doc, setDoc] = useState<Doc | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState("")

  // Guard against React StrictMode's double-mount firing /analyze twice.
  const hasFired = useRef(false)

  useEffect(() => {
    if (!user || !sessionId || hasFired.current) return
    hasFired.current = true
    let interval: ReturnType<typeof setInterval> | undefined

    ;(async () => {
      try {
        const report = await getReport(sessionId)
        if (!report) throw new Error("This contract could not be found.")

        const clauses = inDocumentOrder(report.pass1_result.clauses)
        setDoc({
          filename: report.filename,
          documentType: report.pass1_result.document_type,
          parties: report.pass1_result.parties ?? [],
          governingLaw: report.pass1_result.governing_law,
          clauses,
          shareToken: report.share_token,
        })

        if (report.risk_report.length > 0 && report.aggregation) {
          setResult({ riskReport: report.risk_report, aggregation: report.aggregation, summary: report.summary })
          setPhase("dashboard")
          return
        }

        setPhase("analyzing")
        // Pass 2 analyzes a subset of the clauses shown, so scale its count onto the list. The
        // bar never moves backwards, and "Preparing your report" waits for the real answer.
        interval = setInterval(() => {
          getAnalyzeProgress(sessionId)
            .then(({ progress: p }) => {
              if (!p || !p.total) return
              // All clauses done: show "Preparing your report" while the summary is written.
              const shown = p.done >= p.total ? clauses.length : Math.min(Math.round((p.done / p.total) * clauses.length), clauses.length - 1)
              setProgress((prev) => Math.max(prev, shown))
            })
            .catch(() => {})
        }, POLL_MS)
        const analyzed = await analyzeContract(sessionId)
        clearInterval(interval)
        setProgress(clauses.length)
        setResult({ riskReport: analyzed.risk_report, aggregation: analyzed.aggregation, summary: analyzed.summary })
        setTimeout(() => setPhase("dashboard"), 900)
      } catch (err) {
        clearInterval(interval)
        setErrorMsg((err as Error).message || "Analysis failed")
        setPhase("error")
      }
    })()
  }, [user, sessionId])

  const ready = phase === "dashboard" && doc && result
  const isPro = user?.plan === "pro"

  return (
    <AppShell
      filename={ready ? doc.filename : undefined}
      actions={ready ? <ReportActions sessionId={sessionId} isPro={isPro} shareToken={doc.shareToken} /> : undefined}
    >
      {phase === "analyzing" && doc && (
        <Analyzing filename={doc.filename} documentType={doc.documentType} parties={doc.parties} clauses={doc.clauses} progress={progress} />
      )}

      {ready && (
        <Dashboard
          sessionId={sessionId}
          filename={doc.filename}
          documentType={doc.documentType}
          parties={doc.parties}
          governingLaw={doc.governingLaw}
          clauses={doc.clauses}
          riskReport={result.riskReport}
          aggregation={result.aggregation}
          summary={result.summary}
          printable={isPro}
        />
      )}

      {phase === "error" && (
        <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
          <h1 style={{ margin: 0, fontFamily: "var(--serif)", fontWeight: 400, fontSize: 44, letterSpacing: "-0.035em" }}>Analysis failed</h1>
          <p style={{ margin: 0, fontSize: 15, color: "var(--t1)", maxWidth: 480 }}>{errorMsg}</p>
          <button
            type="button"
            onClick={() => router.push("/new")}
            style={{ marginTop: 12, font: "500 15px var(--sans)", background: "var(--t0)", color: "var(--bg0)", border: 0, padding: "13px 22px", borderRadius: 999, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      )}
    </AppShell>
  )
}
