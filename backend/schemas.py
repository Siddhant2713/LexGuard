from pydantic import BaseModel, field_validator
from typing import Optional
from enum import Enum


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class Category(str, Enum):
    EMPLOYMENT = "employment"
    IP = "ip"
    PRIVACY = "privacy"
    LIABILITY = "liability"
    ARBITRATION = "arbitration"
    PAYMENT = "payment"
    TERMINATION = "termination"
    NON_COMPETE = "non_compete"
    DATA = "data"
    OTHER = "other"


# ─── Pass 1 Output ────────────────────────────────────────────────────────────

class RawClause(BaseModel):
    id: str                     # "clause_01", "clause_02" ...
    heading: str                # Detected or inferred heading
    text: str                   # Verbatim clause text
    category: Category
    suspicion_score: float      # 0.0–10.0


class Pass1Result(BaseModel):
    document_type: str
    parties: list[str]
    governing_law: Optional[str] = None
    clauses: list[RawClause]    # Sorted desc by suspicion_score


# ─── Pass 2 Output ────────────────────────────────────────────────────────────

class RiskAnalysis(BaseModel):
    clause_id: str
    severity: Severity
    risk_type: str              # "non-compete", "broad IP transfer", etc.
    affects: list[str]          # ["employment flexibility", "future income"]
    plain_english: str          # 2–3 sentences, no legalese
    consequence: str            # "If you sign this, X could happen."
    red_flags: list[str]        # Exact phrases from clause text (3–5 words each)
    negotiation_tip: str        # 1 actionable tip

    @field_validator("consequence")
    @classmethod
    def consequence_must_start_correctly(cls, v: str) -> str:
        if not v.startswith("If you sign this"):
            # Gracefully prepend rather than crash
            v = f"If you sign this, {v}"
        return v


# ─── Pass 3 (Aggregation) Output ─────────────────────────────────────────────

class AggregationResult(BaseModel):
    overall_risk: Severity
    risk_score: float           # 0.0–10.0
    major_concerns: list[str]   # 3–5 plain-English concerns
    summary: str                # 2–3 sentence plain-English overview
    favors: str                 # "employer" | "employee" | "balanced" | etc.


# ─── Session State ────────────────────────────────────────────────────────────

class SessionState(BaseModel):
    session_id: str
    filename: str
    storage_url: Optional[str] = None   # Firebase Storage URL
    document_type: str = ""
    parties: list[str] = []
    governing_law: Optional[str] = None
    pass1_result: Optional[Pass1Result] = None
    risk_report: list[RiskAnalysis] = []
    aggregation: Optional[AggregationResult] = None
    summary: dict = {}          # {critical: int, high: int, medium: int, low: int}
    chat_history: list[dict] = []


# ─── API Request / Response Models ───────────────────────────────────────────

class UploadResponse(BaseModel):
    session_id: str
    document_type: str
    parties: list[str]
    governing_law: Optional[str] = None
    clause_count: int
    pass1_clauses: list[RawClause]


class AnalyzeResponse(BaseModel):
    session_id: str
    risk_report: list[RiskAnalysis]
    aggregation: AggregationResult
    summary: dict


class ChatRequest(BaseModel):
    session_id: str
    query: str


class ReportResponse(BaseModel):
    session_id: str
    filename: str
    storage_url: Optional[str] = None
    pass1_result: Pass1Result
    risk_report: list[RiskAnalysis]
    aggregation: Optional[AggregationResult] = None
    summary: dict
