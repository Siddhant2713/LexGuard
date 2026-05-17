"use client"

import type { RawClause } from "@/lib/types"
import { severityColors } from "@/lib/utils"

interface AnalysisProgressProps {
  filename: string
  clauses: RawClause[]
  analyzedCount: number
  total: number
}

export default function AnalysisProgress({
  filename,
  clauses,
  analyzedCount,
  total,
}: AnalysisProgressProps) {
  const progress = total > 0 ? analyzedCount / total : 0

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--bg-0)",
      }}
    >
      {/* Scanline Progress Bar */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "2px",
          backgroundColor: "var(--border-0)",
          zIndex: 100,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress * 100}%`,
            backgroundColor: "#D4933E",
            transition: "width 600ms cubic-bezier(0.19, 1, 0.22, 1)",
            boxShadow: "0 0 8px rgba(212, 147, 62, 0.5)",
          }}
        />
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "64px 32px",
          gap: "32px",
        }}
      >
        {/* Status */}
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "28px",
              color: "var(--text-0)",
              marginBottom: "8px",
            }}
          >
            Analyzing contract
          </p>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              color: "var(--text-2)",
              letterSpacing: "0.08em",
            }}
          >
            {filename}
          </p>
        </div>

        {/* Progress counter */}
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--text-2)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {analyzedCount} / {total} clauses analyzed
        </p>

        {/* Clause List */}
        <div
          style={{
            width: "100%",
            maxWidth: "480px",
            display: "flex",
            flexDirection: "column",
            gap: "0",
            border: "1px solid var(--border-0)",
          }}
        >
          {clauses.map((clause, i) => {
            const isDone = i < analyzedCount
            const isActive = i === analyzedCount
            const sev = clause.suspicion_score >= 8 ? "critical"
              : clause.suspicion_score >= 6 ? "high"
              : clause.suspicion_score >= 4 ? "medium"
              : "low"
            const color = severityColors[sev as keyof typeof severityColors]

            return (
              <div
                key={clause.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--border-0)",
                  backgroundColor: isActive ? "var(--bg-2)" : "transparent",
                  transition: "background 240ms",
                }}
              >
                {/* Status indicator */}
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    color: isDone ? color.text : isActive ? "var(--text-1)" : "var(--text-2)",
                    width: "12px",
                    flexShrink: 0,
                  }}
                >
                  {isDone ? "✓" : isActive ? "●" : "○"}
                </span>

                {/* Clause heading */}
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                    color: isDone ? "var(--text-1)" : isActive ? "var(--text-0)" : "var(--text-2)",
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {clause.heading}
                </span>

                {/* Score */}
                {isDone && (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "10px",
                      color: color.text,
                    }}
                  >
                    {clause.suspicion_score.toFixed(1)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
