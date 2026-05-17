"use client"

import type { AggregationResult, Severity } from "@/lib/types"
import { severityColors } from "@/lib/utils"

interface RiskSummaryBannerProps {
  aggregation: AggregationResult
  summary: Record<Severity, number>
}

const sevLabel: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
}

const riskLabel: Record<Severity, string> = {
  critical: "Critical risk",
  high: "High risk",
  medium: "Medium risk",
  low: "Low risk",
}

export default function RiskSummaryBanner({ aggregation, summary }: RiskSummaryBannerProps) {
  const colors = severityColors[aggregation.overall_risk]

  return (
    <div
      className="risk-banner"
      style={{
        borderBottom: "1px solid var(--border-0)",
        borderLeft: `3px solid ${colors.border}`,
        backgroundColor: colors.bg,
        padding: "20px 28px",
        display: "flex",
        gap: "40px",
        alignItems: "flex-start",
      }}
    >
      {/* Overall Risk */}
      <div style={{ flexShrink: 0 }}>
        <p className="caps-label" style={{ marginBottom: "6px" }}>Overall risk</p>
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <span
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "22px",
              fontStyle: "italic",
              fontWeight: 400,
              color: colors.text,
            }}
          >
            {riskLabel[aggregation.overall_risk]}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--text-2)",
            }}
          >
            {aggregation.risk_score.toFixed(1)}/10
          </span>
        </div>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "11px",
            color: "var(--text-2)",
            marginTop: "4px",
          }}
        >
          Favors {aggregation.favors}
        </p>
      </div>

      {/* Soft divider */}
      <div style={{ width: "1px", alignSelf: "stretch", backgroundColor: "var(--border-0)", flexShrink: 0 }} />

      {/* Main concerns */}
      <div style={{ flex: 1 }}>
        <p className="caps-label" style={{ marginBottom: "10px" }}>Main concerns</p>
        <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "4px" }}>
          {aggregation.major_concerns.map((concern, i) => (
            <li
              key={i}
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                color: "var(--text-1)",
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
              }}
            >
              <span style={{ color: colors.border, flexShrink: 0, marginTop: "1px" }}>–</span>
              {concern}
            </li>
          ))}
        </ul>
      </div>

      {/* Soft divider */}
      <div style={{ width: "1px", alignSelf: "stretch", backgroundColor: "var(--border-0)", flexShrink: 0 }} />

      {/* Breakdown */}
      <div style={{ flexShrink: 0 }}>
        <p className="caps-label" style={{ marginBottom: "10px" }}>Breakdown</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          {(["critical", "high", "medium", "low"] as Severity[]).map((sev) => (
            <div key={sev} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "11px",
                  color: summary[sev] > 0 ? severityColors[sev].text : "var(--text-2)",
                  width: "58px",
                }}
              >
                {sevLabel[sev]}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "13px",
                  color: summary[sev] > 0 ? severityColors[sev].text : "var(--text-2)",
                  fontWeight: summary[sev] > 0 ? 500 : 300,
                }}
              >
                {summary[sev] ?? 0}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* AI Summary */}
      <div
        style={{
          maxWidth: "300px",
          borderLeft: "1px solid var(--border-0)",
          paddingLeft: "28px",
        }}
      >
        <p className="caps-label" style={{ marginBottom: "8px" }}>Summary</p>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            color: "var(--text-1)",
            lineHeight: 1.7,
          }}
        >
          {aggregation.summary}
        </p>
      </div>
    </div>
  )
}
