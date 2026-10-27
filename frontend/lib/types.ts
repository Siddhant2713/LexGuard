// Shared TypeScript types mirroring backend Pydantic schemas

export type Severity = "critical" | "high" | "medium" | "low"

export type Category =
  | "employment" | "ip" | "privacy" | "liability"
  | "arbitration" | "payment" | "termination"
  | "non_compete" | "data" | "other"

export interface RawClause {
  id: string
  heading: string
  text: string
  category: Category
  suspicion_score: number
}

export interface RiskAnalysis {
  clause_id: string
  severity: Severity
  risk_type: string
  affects: string[]
  plain_english: string
  consequence: string
  red_flags: string[]
  negotiation_tip: string
}

export interface AggregationResult {
  overall_risk: Severity
  risk_score: number
  major_concerns: string[]
  summary: string
  favors: string
}

export interface Pass1Result {
  document_type: string
  parties: string[]
  governing_law: string | null
  clauses: RawClause[]
}

export interface UploadResponse {
  session_id: string
  document_type: string
  parties: string[]
  governing_law: string | null
  clause_count: number
  pass1_clauses: RawClause[]
}

export interface AnalyzeResponse {
  session_id: string
  risk_report: RiskAnalysis[]
  aggregation: AggregationResult
  summary: Record<Severity, number>
}

export interface ReportResponse {
  session_id: string
  filename: string
  storage_url: string | null
  pass1_result: Pass1Result
  risk_report: RiskAnalysis[]
  aggregation: AggregationResult | null
  summary: Record<Severity, number>
  /** Set while the report has a public share link. */
  share_token: string | null
}

/** A report opened through a share link: no ids, no chat. */
export type SharedReport = Pick<ReportResponse, "filename" | "pass1_result" | "risk_report" | "aggregation" | "summary">

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  timestamp?: number
}

// Parsed citation from chat response
export interface ParsedCitation {
  clauseId: string
  heading: string
  raw: string
}

// ─── Auth / contracts list ─────────────────────────────────────────────────

export type Plan = "free" | "pro"

export interface User {
  id: string
  name: string
  email: string
  created_at: string
  plan: Plan
  /** ISO date Pro runs until; null on the free plan. */
  pro_until: string | null
}

export interface ContractSummary {
  session_id: string
  filename: string
  document_type: string
  created_at: string
  analyzed: boolean
  overall_risk: Severity | null
  risk_score: number | null
  summary: Partial<Record<Severity, number>>
  shared: boolean
}

// ─── Billing ───────────────────────────────────────────────────────────────

export interface Payment {
  order_id: string
  /** In paise. */
  amount: number
  currency: string
  days: number
  status: "paid" | "refunded"
  paid_at: string | null
  method: string | null
}

export interface BillingStatus {
  user: User
  price: { amount: number; currency: string; days: number }
  /** Free plan only. */
  usage: { used: number; limit: number; resets_at: string } | null
  payments: Payment[]
}

export interface CheckoutOrder {
  key_id: string
  order_id: string
  amount: number
  currency: string
  days: number
  prefill: { name: string; email: string }
}

// ─── Compare ───────────────────────────────────────────────────────────────

export type Verdict = "better" | "worse" | "mixed" | "same"

export interface DiffRun {
  op: "same" | "add" | "del"
  text: string
}

export interface ClauseChange {
  key: string
  kind: "added" | "removed" | "changed"
  heading: string
  before: string | null
  after: string | null
  diff: DiffRun[] | null
  severity_before: Severity | null
  severity_after: Severity | null
  impact: "better" | "worse" | "neutral" | null
  note: string | null
}

export interface ContractRef {
  session_id: string
  filename: string
  document_type: string
  created_at: string
}

export interface Comparison {
  comparison_id: string
  created_at: string
  base: ContractRef
  revised: ContractRef
  verdict: Verdict
  summary: string
  before: { overall_risk: Severity | null; risk_score: number }
  after: { overall_risk: Severity | null; risk_score: number }
  unchanged: number
  changes: ClauseChange[]
  risks: { heading: string; risk_type: string; before: Severity | null; after: Severity | null }[]
}

export interface ComparisonSummary {
  comparison_id: string
  created_at: string
  verdict: Verdict | null
  base_filename: string
  revised_filename: string
}
