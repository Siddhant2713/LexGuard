import type { RawClause, Severity } from "./types"

// ─── Severity helpers ───────────────────────────────────────────────────────

export const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"]

export const severityLabel: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
}

export interface SeverityStyle {
  lbg: string   // label background
  lbd: string   // label border
  ltx: string   // label text
  tint: string  // clause shading
  ring: string  // selected outline
}

// One accent, four strengths: critical is solid, the rest step down to a faint tint.
export const severityStyle: Record<Severity, SeverityStyle> = {
  critical: { lbg: "var(--acc)", lbd: "var(--acc)", ltx: "var(--onacc)", tint: "var(--tc)", ring: "var(--acc)" },
  high:     { lbg: "var(--bg0)", lbd: "var(--acc)", ltx: "var(--acctx)", tint: "var(--th)", ring: "var(--acc)" },
  medium:   { lbg: "var(--bg0)", lbd: "var(--bd1)", ltx: "var(--t1)", tint: "var(--tm)", ring: "var(--t1)" },
  low:      { lbg: "var(--bg0)", lbd: "var(--bd1)", ltx: "var(--t2)", tint: "var(--tl)", ring: "var(--t2)" },
}

export function severityWeight(s: Severity): number {
  return { critical: 0, high: 1, medium: 2, low: 3 }[s]
}

/** Provisional severity from the pass-1 suspicion score, used while pass 2 is running. */
export function severityFromScore(score: number): Severity {
  return score >= 8 ? "critical" : score >= 6 ? "high" : score >= 4 ? "medium" : "low"
}

// ─── Clauses ────────────────────────────────────────────────────────────────

/** "clause_04" → "4". Falls back to the raw id when it has no number. */
export function clauseNumber(id: string): string {
  const m = id.match(/(\d+)\s*$/)
  return m ? String(Number(m[1])) : id
}

/** Pass 1 returns clauses ranked by suspicion; this puts them back in document order. */
export function inDocumentOrder(clauses: RawClause[]): RawClause[] {
  const n = (c: RawClause) => Number(c.id.match(/(\d+)\s*$/)?.[1] ?? Infinity)
  return [...clauses].sort((a, b) => n(a) - n(b))
}

// ─── Citation parsing ───────────────────────────────────────────────────────

export interface Citation {
  clauseId: string
  heading: string
}

/**
 * Splits a chat answer into plain text and the [[CLAUSE:clause_id:Heading]] markers it cites.
 * An unfinished marker at the end of a streaming answer is hidden until it completes.
 */
export function parseCitations(text: string): { text: string; cites: Citation[] } {
  const cites: Citation[] = []
  const clean = text
    .replace(/\[\[CLAUSE:([\w-]+):([^\]]+)\]\]/g, (_, clauseId: string, heading: string) => {
      if (!cites.some((c) => c.clauseId === clauseId)) cites.push({ clauseId, heading: heading.trim() })
      return heading.trim()
    })
    .replace(/\[\[[^\]]*$/, "")
  return { text: clean, cites }
}

// ─── Formatting ─────────────────────────────────────────────────────────────

/** Pass 1 classifies unknown documents as "Other"; show those as a plain "Contract". */
export function documentTitle(type: string | null | undefined): string {
  const t = (type ?? "").trim()
  return !t || /^other$/i.test(t) ? "Contract" : t
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase()
}

/** 49900, "INR" → "₹499". Amounts from the API are in the smallest unit (paise). */
export function formatMoney(amount: number, currency: string): string {
  const value = amount / 100
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: Number.isInteger(value) ? 0 : 2 }).format(value)
}

/** Whole days from now until `iso`, never negative. */
export function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))
}
