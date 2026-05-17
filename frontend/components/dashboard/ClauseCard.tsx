"use client"

import type { RiskAnalysis, Severity } from "@/lib/types"
import { severityColors } from "@/lib/utils"

interface ClauseCardProps {
  clause: RiskAnalysis
  isActive: boolean
  onClick: () => void
}

// Sentence-case severity labels
const sevLabel: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
}

export default function ClauseCard({ clause, isActive, onClick }: ClauseCardProps) {
  const colors = severityColors[clause.severity]

  return (
    <div
      className={`clause-card ${isActive ? "active" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      aria-selected={isActive}
    >
      {/* Left severity accent — soft, only on active */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: "2px",
          backgroundColor: isActive ? colors.border : "transparent",
          transition: "background-color 200ms",
        }}
      />

      <div>
        {/* Clause title */}
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            fontWeight: 500,
            color: "var(--text-0)",
            marginBottom: "4px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {clause.risk_type}
        </p>

        {/* Clause ID — minimal mono, not uppercase */}
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: "var(--text-2)",
            letterSpacing: "0.03em",
            marginBottom: "8px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {clause.clause_id.replace("_", " ")}
        </p>

        {/* Severity — soft pill, sentence case, no harsh border */}
        <span
          style={{
            display: "inline-block",
            fontFamily: "var(--font-sans)",
            fontSize: "10px",
            fontWeight: 500,
            color: colors.text,
            backgroundColor: colors.bg,
            border: `1px solid ${colors.border}`,
            padding: "1px 8px",
            borderRadius: "20px",
          }}
        >
          {sevLabel[clause.severity]}
        </span>
      </div>
    </div>
  )
}
