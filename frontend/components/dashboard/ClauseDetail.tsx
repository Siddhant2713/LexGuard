"use client"

import { useEffect, useRef } from "react"
import type { RiskAnalysis } from "@/lib/types"
import { severityColors, highlightRedFlags } from "@/lib/utils"

interface ClauseDetailProps {
  clause: RiskAnalysis
  onCitationClick?: (clauseId: string) => void
}

// Severity label in sentence case — not uppercase
const sevLabel: Record<string, string> = {
  critical: "Critical",
  high: "High risk",
  medium: "Medium concern",
  low: "Low risk",
}

function RiskArc({ score }: { score: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const size = 60
    canvas.width = size
    canvas.height = size
    const cx = size / 2, cy = size / 2, r = 24
    const startAngle = Math.PI * 0.75
    const fullAngle = Math.PI * 1.5

    // Warm muted arc colors
    const color =
      score >= 8 ? "#9B3B28"
      : score >= 6 ? "#8A5C10"
      : score >= 4 ? "#4D6E25"
      : "#2B6494"

    const draw = (progress: number) => {
      ctx.clearRect(0, 0, size, size)
      // Track
      ctx.beginPath()
      ctx.arc(cx, cy, r, startAngle, startAngle + fullAngle)
      ctx.strokeStyle = "rgba(180, 172, 158, 0.4)"
      ctx.lineWidth = 2.5
      ctx.lineCap = "round"
      ctx.stroke()
      // Progress
      ctx.beginPath()
      ctx.arc(cx, cy, r, startAngle, startAngle + fullAngle * progress)
      ctx.strokeStyle = color
      ctx.lineWidth = 2.5
      ctx.lineCap = "round"
      ctx.stroke()
      // Score text
      ctx.fillStyle = "#1C1916"
      ctx.font = "500 11px 'Geist Mono', monospace"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(score.toFixed(1), cx, cy)
    }

    const target = score / 10
    const duration = 800
    const start = performance.now()
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 4)
      draw(eased * target)
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [score])

  return <canvas ref={canvasRef} style={{ width: 60, height: 60, flexShrink: 0 }} />
}

export default function ClauseDetail({ clause }: ClauseDetailProps) {
  const colors = severityColors[clause.severity]

  return (
    <div
      className="detail-panel"
      style={{
        padding: "40px 36px",
        overflowY: "auto",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "32px",
      }}
    >
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
        <div style={{ flex: 1 }}>
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "26px",
              fontStyle: "italic",
              fontWeight: 400,
              color: "var(--text-0)",
              lineHeight: 1.3,
              marginBottom: "14px",
            }}
          >
            {clause.risk_type}
          </h2>

          {/* Severity pill + clause ID */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "11px",
                fontWeight: 500,
                color: colors.text,
                backgroundColor: colors.bg,
                border: `1px solid ${colors.border}`,
                padding: "2px 10px",
                borderRadius: "20px",
              }}
            >
              {sevLabel[clause.severity] ?? clause.severity}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                color: "var(--text-2)",
                letterSpacing: "0.04em",
              }}
            >
              {clause.clause_id.replace("_", " ")}
            </span>
          </div>
        </div>
        <RiskArc score={clause.affects.length * 1.5 + 5} />
      </div>

      {/* ── Affects ── */}
      <div>
        <p className="caps-label" style={{ marginBottom: "10px" }}>Affects</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {clause.affects.map((a, i) => (
            <span
              key={i}
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "12px",
                color: "var(--text-1)",
                backgroundColor: "var(--bg-1)",
                border: "1px solid var(--border-0)",
                padding: "3px 10px",
                borderRadius: "20px",
              }}
            >
              {a}
            </span>
          ))}
        </div>
      </div>

      {/* ── In plain English ── */}
      <div>
        <p className="caps-label" style={{ marginBottom: "12px" }}>In plain English</p>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "15px",
            color: "var(--text-0)",
            lineHeight: 1.85,
          }}
        >
          {clause.plain_english}
        </p>
      </div>

      {/* ── If you sign this ── */}
      <div
        style={{
          borderLeft: `2px solid ${colors.border}`,
          paddingLeft: "18px",
          paddingTop: "4px",
          paddingBottom: "4px",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "11px",
            fontWeight: 500,
            color: colors.text,
            marginBottom: "8px",
            letterSpacing: "0.02em",
          }}
        >
          If you sign this
        </p>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            color: "var(--text-0)",
            lineHeight: 1.7,
          }}
        >
          {clause.consequence}
        </p>
      </div>

      {/* ── Notable phrases ── */}
      {clause.red_flags.length > 0 && (
        <div>
          <p className="caps-label" style={{ marginBottom: "12px" }}>Notable phrases</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {clause.red_flags.map((flag, i) => (
              <span
                key={i}
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "12px",
                  color: colors.text,
                  backgroundColor: colors.bg,
                  border: `1px solid ${colors.border}`,
                  padding: "3px 10px",
                  borderRadius: "4px",
                }}
              >
                &ldquo;{flag}&rdquo;
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Negotiation tip ── */}
      <div
        style={{
          borderTop: "1px solid var(--border-0)",
          paddingTop: "24px",
        }}
      >
        <p className="caps-label" style={{ marginBottom: "10px" }}>Negotiation tip</p>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            color: "var(--text-1)",
            lineHeight: 1.7,
          }}
        >
          {clause.negotiation_tip}
        </p>
      </div>
    </div>
  )
}
