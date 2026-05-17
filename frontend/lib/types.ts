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
}

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
