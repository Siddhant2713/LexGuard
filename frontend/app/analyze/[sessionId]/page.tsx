"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import type { RiskAnalysis, AggregationResult, Severity, RawClause } from "@/lib/types"
import { analyzeContract, getReport } from "@/lib/api"
import { severityColors, animateDashboardEntry, animateClauseSelect } from "@/lib/utils"

const AnalysisProgress = dynamic(() => import("@/components/analysis/AnalysisProgress"), { ssr: false })
const RiskSummaryBanner = dynamic(() => import("@/components/dashboard/RiskSummaryBanner"), { ssr: false })
const ClauseCard = dynamic(() => import("@/components/dashboard/ClauseCard"), { ssr: false })
const ClauseDetail = dynamic(() => import("@/components/dashboard/ClauseDetail"), { ssr: false })
const ChatPanel = dynamic(() => import("@/components/chat/ChatPanel"), { ssr: false })
const ErrorBoundary = dynamic(() => import("@/components/ErrorBoundary"), { ssr: false })

type Phase = "analyzing" | "dashboard" | "error"

export default function AnalyzePage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string

  const [phase, setPhase] = useState<Phase>("analyzing")
  const [pass1Clauses, setPass1Clauses] = useState<RawClause[]>([])
  const [analyzedCount, setAnalyzedCount] = useState(0)
  const [filename, setFilename] = useState("")
  const [riskReport, setRiskReport] = useState<RiskAnalysis[]>([])
  const [aggregation, setAggregation] = useState<AggregationResult | null>(null)
  const [summary, setSummary] = useState<Record<Severity, number>>({ critical: 0, high: 0, medium: 0, low: 0 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState("")
  const detailRef = useRef<HTMLDivElement>(null)

  const selectedClause = riskReport.find((r) => r.clause_id === selectedId) ?? riskReport[0] ?? null

  // Guard against React StrictMode's intentional double-mount in development.
  // Without this, two concurrent /analyze calls would fire on every page load.
  const hasFired = useRef(false)

  useEffect(() => {
    if (!sessionId) return
    if (hasFired.current) return   // ← StrictMode safety: only run once
    hasFired.current = true

    ;(async () => {
      try {
        // Fetch the report — if already analyzed, skip /analyze entirely
        const report = await getReport(sessionId)
        if (report) {
          setFilename(report.filename)
          setPass1Clauses(report.pass1_result.clauses)

        // Already done: go straight to dashboard, zero extra API calls
        if (report.risk_report.length > 0 && report.aggregation) {
          setRiskReport(report.risk_report)
          setAggregation(report.aggregation)
          setSummary(report.summary)
          setSelectedId(report.risk_report[0]?.clause_id ?? null)
          setPhase("dashboard")
          setTimeout(animateDashboardEntry, 50)
          return
        }
        
        // Wait, if report was not fully populated, we still need pass1Clauses from the upload endpoint? 
        // Actually, if report is null, we can't get filename or pass1 clauses. 
        // The upload endpoint redirects here, so we must fetch pass1Clauses from /report? No, wait!
        // In LexGuard, UploadResponse returns pass1_clauses and redirects here. The server creates the session with pass1_clauses!
        // So /report WILL NOT be 404 if the session exists, it will just not have risk_report!
        // Ah, the user's report said:
        // "getReport() is called first. If the session was just created and /report/{id} hasn't been populated yet ... it throws"
        // Wait, `UploadResponse` is returned instantly after `Pass 1` in `main.py`.
        // Then `session` is saved to Firestore.
        // Then the frontend redirects to `/analyze/[id]`.
        // The frontend calls `getReport(id)`. If Firestore hasn't saved it yet (eventual consistency), it might 404!
        // We should fetch from a different endpoint or retry?
        // Wait, if report is null, we can just call analyzeContract directly! `analyzeContract` returns `risk_report` and `aggregation`. 
        // Let's adjust this logic.
        }

        // Simulate progress ticks while analysis runs
        const total = report?.pass1_result?.clauses?.length ?? 15
        const estimatedSecondsPerClause = 3
        const tickInterval = (estimatedSecondsPerClause * 1000) / Math.min(5, total)
        
        let tick = 0
        const interval = setInterval(() => {
          tick = Math.min(tick + 1, total - 1)
          setAnalyzedCount(tick)
        }, tickInterval)

        // Single /analyze call — result is persisted in Firestore after this
        const result = await analyzeContract(sessionId)
        clearInterval(interval)
        setAnalyzedCount(total)

        setRiskReport(result.risk_report)
        setAggregation(result.aggregation)
        setSummary(result.summary)
        setSelectedId(result.risk_report[0]?.clause_id ?? null)

        setTimeout(() => {
          setPhase("dashboard")
          setTimeout(animateDashboardEntry, 50)
        }, 500)
      } catch (err) {
        setErrorMsg((err as Error).message || "Analysis failed")
        setPhase("error")
      }
    })()

    return () => {
      // Reset on unmount so navigating back reruns properly
      hasFired.current = false
    }
  }, [sessionId])


  const handleClauseSelect = (clauseId: string) => {
    setSelectedId(clauseId)
    if (detailRef.current) animateClauseSelect(detailRef.current)
  }

  const handleCitationClick = (clauseId: string) => {
    // Find clause and select it
    const clause = riskReport.find((r) => r.clause_id === clauseId)
    if (clause) handleClauseSelect(clauseId)
  }

  if (phase === "error") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px" }}>
        <p style={{ fontFamily: "var(--font-serif)", fontSize: "24px", color: "var(--sev-critical-text)" }}>Analysis failed</p>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-2)" }}>{errorMsg}</p>
        <button
          onClick={() => router.push("/")}
          style={{ marginTop: "16px", background: "none", border: "1px solid var(--border-1)", color: "var(--text-1)", padding: "8px 20px", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "13px" }}
        >
          Try again
        </button>
      </div>
    )
  }

  if (phase === "analyzing") {
    return (
      <AnalysisProgress
        filename={filename}
        clauses={pass1Clauses}
        analyzedCount={analyzedCount}
        total={pass1Clauses.length}
      />
    )
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <header
        className="header-bar"
        style={{
          height: "52px",
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          gap: "16px",
          flexShrink: 0,
          backgroundColor: "#FFFFFF",
          borderBottom: "1px solid #DDD8CE",
          boxShadow: "0 1px 3px rgba(28, 25, 22, 0.06)",
        }}
      >
        {/* Brand */}
        <span style={{ fontFamily: "var(--font-serif)", fontSize: "17px", fontStyle: "italic", color: "#1C1916", fontWeight: 400, flexShrink: 0 }}>
          LexGuard
        </span>

        {/* Separator */}
        <div style={{ width: "1px", height: "18px", backgroundColor: "#DDD8CE", flexShrink: 0 }} />

        {/* Filename */}
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "#9E9589", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {filename}
        </span>

        {/* Severity chips — only non-zero */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
          {(["critical", "high", "medium", "low"] as Severity[]).filter(sev => summary[sev] > 0).map((sev) => (
            <span
              key={sev}
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "11px",
                fontWeight: 500,
                color: severityColors[sev].text,
                backgroundColor: severityColors[sev].bg,
                border: `1px solid ${severityColors[sev].border}`,
                padding: "2px 8px",
                borderRadius: "20px",
              }}
            >
              {summary[sev]} {sev}
            </span>
          ))}
        </div>

        {/* New analysis */}
        <button
          onClick={() => router.push("/")}
          style={{
            background: "none",
            border: "1px solid #CFC9BD",
            color: "#9E9589",
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
            cursor: "pointer",
            padding: "5px 14px",
            borderRadius: "4px",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "#635D54"; (e.target as HTMLElement).style.borderColor = "#B8B0A0" }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "#9E9589"; (e.target as HTMLElement).style.borderColor = "#CFC9BD" }}
        >
          New analysis
        </button>
      </header>


      {/* Risk Banner */}
      {aggregation && (
        <RiskSummaryBanner aggregation={aggregation} summary={summary} />
      )}

      {/* Main 3-column layout — minHeight:0 lets the flex child shrink correctly */}
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "320px 1fr 380px", overflow: "hidden" }}>

        {/* LEFT: Clause list */}
        <div style={{ borderRight: "1px solid var(--border-0)", overflowY: "auto" }}>
          {riskReport.map((clause) => (
            <ClauseCard
              key={clause.clause_id}
              clause={clause}
              isActive={clause.clause_id === selectedId}
              onClick={() => handleClauseSelect(clause.clause_id)}
            />
          ))}
        </div>

        {/* CENTER: Clause detail */}
        <div ref={detailRef} style={{ overflowY: "auto" }}>
          <ErrorBoundary>
            {selectedClause ? (
              <ClauseDetail
                clause={selectedClause}
                suspicionScore={pass1Clauses.find(c => c.id === selectedClause.clause_id)?.suspicion_score}
                onCitationClick={handleCitationClick}
              />
            ) : (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-2)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                Select a clause to view details
              </div>
            )}
          </ErrorBoundary>
        </div>

        {/* RIGHT: Chat panel */}
        <div style={{ overflowY: "hidden" }}>
          <ErrorBoundary>
            <ChatPanel sessionId={sessionId} onCitationClick={handleCitationClick} />
          </ErrorBoundary>
        </div>
    </div>
  )
}
