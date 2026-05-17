# LexGuard — Antigravity Agent PRD
### Model: `claude-sonnet-4-6` · 4-Hour Sprint · $5 GCP Budget · Zero Ambiguity Build

---

## AGENT OPERATING CONTRACT

> This PRD is written for an **autonomous coding agent**, not a human developer. Every section is written to eliminate decision fatigue. When you see a choice, one option is already chosen. When you see a command, run it exactly. When you see a schema, implement it exactly. Do not improvise structure — improvise only within marked `[CREATIVE LATITUDE]` zones.

**Agent Behavior Rules:**
- Read each Wave completely before starting it
- Never skip ahead — each Wave's output is the next Wave's input
- If a shell command fails, retry once with `--no-cache`, then log the error and continue
- Prefer `# TODO` comments over stopping — mark blockers and move forward
- Test each Wave with its defined Acceptance Criteria before proceeding
- The final output is a live URL + a 2-min demo video script

---

## 0. Tech Stack — Final, Non-Negotiable

| Layer | Choice | Reason |
|---|---|---|
| LLM | `claude-sonnet-4-6` via Anthropic API | Superior legal reasoning, structured JSON output, 200k context |
| PDF Parse | `PyMuPDF` (fitz) | Free, fast, no API calls |
| Embeddings | `sentence-transformers/all-MiniLM-L6-v2` (local) | Zero API cost, runs in 512MB RAM |
| Vector Store | `FAISS` in-memory | No managed DB cost |
| Backend | `FastAPI` + `uvicorn` | Async, SSE streaming, minimal overhead |
| Deploy | `Cloud Run` (single container) | $0.30–0.80 total for 4hrs |
| Frontend | Single-file React (`index.html` with Vite CDN) | Ship in 45 min |
| Session State | Python `dict` in-process | No DB needed for demo |
| Streaming | SSE via `sse-starlette` | Real-time chat |

**Why `claude-sonnet-4-6` over Gemini Flash:**
- Anthropic API structured output (`response_format`) guarantees valid JSON — no regex fallback needed
- Superior instruction-following on complex legal schemas
- 200k token context window handles full contracts in Pass 1 without chunking
- More predictable JSON schemas = less error handling code = faster build

**API Rate Limits (Anthropic free/starter tier):**
- ~60 RPM on Sonnet — no `time.sleep()` needed between clause calls
- This eliminates the 60-second wait in the original PRD entirely

---

## 1. Problem & Win Conditions

### The Problem
People sign contracts without understanding them. Not because they're careless — because legal language is deliberately opaque. LexGuard makes the risk visible, in plain English, grounded in the actual document.

### Judge Scoring Dimensions (Weight Each Decision Against These)
| Dimension | What Wins | LexGuard's Answer |
|---|---|---|
| Legal Reasoning Quality | Clause-level precision, correct risk taxonomy | Pass 2 per-clause deep analysis |
| Risk Identification | Finds non-obvious risks, not just flagged boilerplate | Red flag phrase extraction from clause text |
| Explainability | Plain English + consequence + what to do | `plain_english` + `consequence` + `negotiation_tip` |
| UX | Clarity at a glance, no friction | Severity dashboard → drill-down pattern |
| Architecture | Coherent, defensible choices | 2-pass pipeline + RAG chat, explained in pitch |
| Innovation | Something others won't have | Grounded citations in chat + negotiation tips |

---

## 2. Complete Architecture — Deep Dive

```
┌─────────────────────────────────────────────────────────────┐
│                        USER BROWSER                         │
│                                                             │
│  [Upload Zone] ──► [Progress Bar] ──► [Risk Dashboard]      │
│                                           │                 │
│                                    [Clause Detail]          │
│                                           │                 │
│                                    [Chat Interface]         │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTPS
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              FastAPI Backend (Cloud Run)                     │
│                                                             │
│  POST /upload                                               │
│    └─ parser.py: PyMuPDF → raw_text, page_map               │
│    └─ chunker.py: clause splitter → chunks[]                │
│    └─ embedder.py: MiniLM → FAISS index                     │
│    └─ analyzer.py: PASS 1 → structural JSON                 │
│    └─ sessions[uuid] = SessionState(...)                    │
│    └─ return: {session_id, clauses[], document_meta}        │
│                                                             │
│  POST /analyze                                              │
│    └─ analyzer.py: PASS 2 per clause (parallel async)       │
│    └─ sessions[sid].risk_report = results                   │
│    └─ return: {risk_report[]}                               │
│                                                             │
│  POST /chat (SSE stream)                                    │
│    └─ embedder.py: embed query → FAISS top-3 chunks         │
│    └─ chat.py: build grounded prompt → stream Anthropic     │
│    └─ yield: SSE tokens                                     │
│                                                             │
│  GET /report/{sid}                                          │
│    └─ return: full SessionState as JSON                     │
│                                                             │
│  GET /health                                                │
│    └─ return: {"status": "ok"}                              │
└───────────────────┬─────────────────────────────────────────┘
                    │ Anthropic API
                    ▼
         claude-sonnet-4-6
         (Pass 1 + Pass 2 + Chat)
```

### Data Flow — End to End

```
PDF Upload
  │
  ▼
PyMuPDF.open(pdf_bytes)
  │ → extract text per page
  │ → preserve page numbers for citation
  ▼
raw_text: str  (full document)
page_map: dict[int, str]  (page_num → text)
  │
  ▼
clause_splitter(raw_text)
  │ → regex: split on ALL CAPS headings, numbered sections, "Article X", "Section X"
  │ → min_chunk_len = 50 chars (skip boilerplate fragments)
  │ → max_chunk_len = 2000 chars (split oversized clauses at paragraph boundaries)
  ▼
chunks: list[Chunk]  (id, heading, text, page_ref)
  │
  ├──► MiniLM embed each chunk → FAISS IndexFlatL2 → store in session
  │
  └──► PASS 1: send top 8000 tokens of raw_text to claude-sonnet-4-6
           → returns: {document_type, parties, clauses[{id,heading,text,category,suspicion_score}]}
           → sort by suspicion_score DESC
           → take top 15
           │
           └──► PASS 2: for each clause in top 10 (parallel async, 5 concurrent)
                    → returns: {severity, risk_type, affects, plain_english,
                                consequence, red_flags, negotiation_tip}
                    → merge into risk_report[]
                    │
                    └──► assemble final report
                         store in sessions[sid]
                         return to frontend

Chat Query
  │
  ▼
embed(query) → FAISS.search(k=3) → top_chunks[]
  │
  ▼
grounded_prompt = system + retrieved_context + user_query
  │
  ▼
anthropic.messages.stream(grounded_prompt)
  │
  └──► SSE yield tokens → frontend renders streamed response
```

---

## 3. Project File Structure — Exact

```
lexguard/
├── backend/
│   ├── main.py              # FastAPI app + all route handlers
│   ├── parser.py            # PDF text extraction (PyMuPDF)
│   ├── chunker.py           # Clause splitting logic
│   ├── embedder.py          # MiniLM embeddings + FAISS
│   ├── analyzer.py          # Pass 1 + Pass 2 Claude calls
│   ├── chat.py              # RAG chat + SSE streaming
│   ├── schemas.py           # All Pydantic models
│   ├── prompts.py           # All prompt templates (centralized)
│   ├── config.py            # Env vars, constants
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/
│   └── index.html           # Single file: React + Tailwind CDN + all JS
│
├── test_contracts/
│   ├── employment_agreement.pdf    # Pre-loaded test fixture
│   ├── freelance_contract.pdf      # Pre-loaded test fixture
│   └── cached_reports/
│       ├── employment_report.json  # Pre-cached for demo mode
│       └── freelance_report.json
│
├── tests/
│   ├── test_parser.py
│   ├── test_chunker.py
│   ├── test_analyzer.py
│   └── test_chat.py
│
└── deploy.sh                # One-command deploy to Cloud Run
```

---

## 4. Complete Schema Definitions

### `schemas.py` — Implement Exactly

```python
from pydantic import BaseModel
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

# --- Pass 1 Output ---
class RawClause(BaseModel):
    id: str                    # "clause_01", "clause_02" ...
    heading: str               # Detected or inferred heading
    text: str                  # Verbatim clause text
    category: Category
    suspicion_score: float     # 0.0–10.0

class Pass1Result(BaseModel):
    document_type: str
    parties: list[str]
    governing_law: Optional[str] = None
    clauses: list[RawClause]   # Sorted desc by suspicion_score

# --- Pass 2 Output ---
class RiskAnalysis(BaseModel):
    clause_id: str
    severity: Severity
    risk_type: str             # "non-compete", "broad IP transfer", etc.
    affects: list[str]         # ["employment flexibility", "future income"]
    plain_english: str         # 2-3 sentences, no legalese
    consequence: str           # "If you sign this, X could happen."
    red_flags: list[str]       # Exact phrases from clause text (3-5 words each)
    negotiation_tip: str       # 1 actionable tip

# --- Session State ---
class SessionState(BaseModel):
    session_id: str
    filename: str
    raw_text: str
    page_map: dict             # {page_num: text}
    pass1_result: Optional[Pass1Result] = None
    risk_report: list[RiskAnalysis] = []
    # FAISS index stored separately (not serializable) — use sessions_faiss dict

# --- API Request/Response ---
class UploadResponse(BaseModel):
    session_id: str
    document_type: str
    parties: list[str]
    clause_count: int
    pass1_clauses: list[RawClause]

class AnalyzeResponse(BaseModel):
    session_id: str
    risk_report: list[RiskAnalysis]
    summary: dict              # {critical: int, high: int, medium: int, low: int}

class ChatRequest(BaseModel):
    session_id: str
    query: str

class ReportResponse(BaseModel):
    session_id: str
    filename: str
    pass1_result: Pass1Result
    risk_report: list[RiskAnalysis]
    summary: dict
```

---

## 5. Prompt Library — `prompts.py`

### Pass 1 Prompt

```python
PASS1_SYSTEM = """You are a senior legal analyst specializing in contract risk assessment.
Your task: extract and categorize all clauses from the provided legal document.

CRITICAL RULES:
- Return ONLY valid JSON. No markdown fences. No explanation. No preamble.
- Assign suspicion_score 0-10 where 10 = extremely risky to the signee
- Sort clauses by suspicion_score DESCENDING
- Return maximum 15 clauses
- Use verbatim text for the "text" field — do not paraphrase
- If a heading is not explicit in the document, infer one from context

Categories: employment | ip | privacy | liability | arbitration | payment | termination | non_compete | data | other

JSON Schema to return:
{
  "document_type": "Employment Agreement | Freelance Contract | SaaS ToS | NDA | Other",
  "parties": ["Party A Name", "Party B Name"],
  "governing_law": "State/Country or null",
  "clauses": [
    {
      "id": "clause_01",
      "heading": "Clause heading",
      "text": "Verbatim clause text here...",
      "category": "non_compete",
      "suspicion_score": 9.2
    }
  ]
}"""

PASS1_USER = """Analyze this legal document and extract all clauses:

---DOCUMENT START---
{document_text}
---DOCUMENT END---

Return the JSON schema described. No other text."""
```

### Pass 2 Prompt

```python
PASS2_SYSTEM = """You are a legal risk analyst working FOR the person who must sign this agreement — not the drafter.
Your job: analyze a single clause and explain its risks clearly and actionably.

CRITICAL RULES:
- Return ONLY valid JSON. No markdown fences. No explanation. No preamble.
- plain_english: 2-3 sentences, written for a non-lawyer. No legal jargon.
- consequence: exactly 1 sentence starting with "If you sign this,"
- red_flags: extract 3-5 word phrases VERBATIM from the clause text that are most risky
- negotiation_tip: 1 concrete, actionable tip. Be specific (mention time limits, scope limits, etc.)
- severity: critical | high | medium | low

JSON Schema to return:
{
  "clause_id": "clause_01",
  "severity": "high",
  "risk_type": "Broad IP Assignment",
  "affects": ["intellectual property rights", "side projects", "future income"],
  "plain_english": "This clause claims ownership of everything you create...",
  "consequence": "If you sign this, your employer could own all code you write...",
  "red_flags": ["any and all inventions", "solely or jointly", "during employment"],
  "negotiation_tip": "Request a carve-out: add 'excluding inventions made entirely...' "
}"""

PASS2_USER = """Analyze this specific clause from a {document_type}:

Clause ID: {clause_id}
Clause Heading: {heading}
Category: {category}

CLAUSE TEXT:
{clause_text}

Return the JSON schema described. No other text."""
```

### Chat Prompt

```python
CHAT_SYSTEM = """You are a legal assistant helping a user understand their specific contract.

RULES:
- Answer ONLY from the provided contract excerpts below
- If the answer isn't in the excerpts, say: "This isn't addressed in the sections I can see."
- Cite clause headings in your answer using format: [Clause: Heading Name]
- Be concise — 3-5 sentences max unless the user asks for more detail
- Never give legal advice. End complex answers with: "Consider consulting a lawyer before signing."

CONTRACT EXCERPTS:
{retrieved_context}"""

CHAT_USER = """{query}"""
```

---

## 6. Implementation — Module by Module

### `config.py`
```python
import os

ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
MODEL = "claude-sonnet-4-6"
MAX_TOKENS_PASS1 = 4000
MAX_TOKENS_PASS2 = 1000
MAX_TOKENS_CHAT = 800
MAX_CLAUSES_PASS2 = 10
PASS2_CONCURRENCY = 5        # Async semaphore limit
FAISS_TOP_K = 3
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
MAX_CONTEXT_CHARS = 32000    # ~8k tokens — truncate if document larger
```

### `parser.py`
```python
import fitz  # PyMuPDF
from typing import Tuple

def extract_pdf(pdf_bytes: bytes) -> Tuple[str, dict]:
    """
    Returns:
        raw_text: full document text, pages joined with \n\n
        page_map: {page_num: page_text}
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page_map = {}
    pages = []
    for i, page in enumerate(doc):
        text = page.get_text("text")
        page_map[i + 1] = text
        pages.append(text)
    raw_text = "\n\n".join(pages)
    return raw_text, page_map
```

### `chunker.py`
```python
import re
from dataclasses import dataclass

@dataclass
class Chunk:
    id: str
    heading: str
    text: str
    page_ref: int = 0

def split_clauses(raw_text: str) -> list[Chunk]:
    """
    Split document into clause chunks using regex patterns.
    Handles: numbered sections, ALL CAPS headings, "Article X", "Section X"
    """
    # Pattern matches: "1.", "1.1", "Article 1", "Section 1", "HEADING"
    pattern = r'(?m)^(?:(?:Article|Section|Clause)\s+\d+[\.\d]*|(?:\d+\.)+\d*\s+[A-Z]|[A-Z][A-Z\s]{4,}(?=\n))'
    
    splits = list(re.finditer(pattern, raw_text))
    
    chunks = []
    for i, match in enumerate(splits):
        start = match.start()
        end = splits[i + 1].start() if i + 1 < len(splits) else len(raw_text)
        chunk_text = raw_text[start:end].strip()
        
        # Skip trivially short chunks
        if len(chunk_text) < 50:
            continue
        
        # Truncate oversized chunks at paragraph boundary
        if len(chunk_text) > 2000:
            truncate_at = chunk_text.rfind('\n\n', 0, 2000)
            chunk_text = chunk_text[:truncate_at if truncate_at > 0 else 2000]
        
        heading = match.group(0).strip()[:80]
        chunks.append(Chunk(
            id=f"chunk_{i:02d}",
            heading=heading,
            text=chunk_text
        ))
    
    # Fallback: if regex found <3 chunks, split by paragraph
    if len(chunks) < 3:
        paragraphs = [p.strip() for p in raw_text.split('\n\n') if len(p.strip()) > 50]
        chunks = [
            Chunk(id=f"para_{i:02d}", heading=f"Section {i+1}", text=p)
            for i, p in enumerate(paragraphs[:30])
        ]
    
    return chunks
```

### `embedder.py`
```python
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
from chunker import Chunk

_model = None

def get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model

def build_index(chunks: list[Chunk]) -> tuple[faiss.Index, list[Chunk]]:
    """Build FAISS index from chunks. Returns (index, ordered_chunks)."""
    model = get_model()
    texts = [f"{c.heading}\n{c.text}" for c in chunks]
    embeddings = model.encode(texts, normalize_embeddings=True)
    
    dim = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)  # Inner product = cosine sim (normalized)
    index.add(embeddings.astype(np.float32))
    
    return index, chunks

def search(query: str, index: faiss.Index, chunks: list[Chunk], k: int = 3) -> list[Chunk]:
    """Search FAISS index, return top-k chunks."""
    model = get_model()
    q_emb = model.encode([query], normalize_embeddings=True).astype(np.float32)
    _, indices = index.search(q_emb, k)
    return [chunks[i] for i in indices[0] if i < len(chunks)]
```

### `analyzer.py`
```python
import asyncio
import json
import anthropic
from config import *
from prompts import PASS1_SYSTEM, PASS1_USER, PASS2_SYSTEM, PASS2_USER
from schemas import Pass1Result, RiskAnalysis

client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)

async def run_pass1(raw_text: str) -> Pass1Result:
    """Structural extraction — 1 API call, full document."""
    doc_text = raw_text[:MAX_CONTEXT_CHARS]  # Truncate if needed
    
    response = await client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS_PASS1,
        system=PASS1_SYSTEM,
        messages=[{"role": "user", "content": PASS1_USER.format(document_text=doc_text)}]
    )
    
    raw_json = response.content[0].text
    data = json.loads(raw_json)
    
    # Sort by suspicion_score desc, take top 15
    data["clauses"] = sorted(data["clauses"], key=lambda x: x["suspicion_score"], reverse=True)[:15]
    
    return Pass1Result(**data)

async def analyze_single_clause(clause: dict, doc_type: str, semaphore: asyncio.Semaphore) -> RiskAnalysis:
    """Pass 2 for a single clause, respects semaphore concurrency limit."""
    async with semaphore:
        response = await client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS_PASS2,
            system=PASS2_SYSTEM,
            messages=[{"role": "user", "content": PASS2_USER.format(
                document_type=doc_type,
                clause_id=clause["id"],
                heading=clause["heading"],
                category=clause["category"],
                clause_text=clause["text"]
            )}]
        )
        raw_json = response.content[0].text
        data = json.loads(raw_json)
        return RiskAnalysis(**data)

async def run_pass2(pass1_result: Pass1Result) -> list[RiskAnalysis]:
    """Pass 2 for top 10 clauses — runs concurrently (5 at a time)."""
    semaphore = asyncio.Semaphore(PASS2_CONCURRENCY)
    clauses = [c.model_dump() for c in pass1_result.clauses[:MAX_CLAUSES_PASS2]]
    
    tasks = [
        analyze_single_clause(clause, pass1_result.document_type, semaphore)
        for clause in clauses
    ]
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Filter out failed analyses
    valid = [r for r in results if isinstance(r, RiskAnalysis)]
    
    # Sort by severity weight
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    return sorted(valid, key=lambda x: severity_order.get(x.severity, 4))
```

### `chat.py`
```python
import anthropic
from config import *
from prompts import CHAT_SYSTEM, CHAT_USER
from embedder import search
from schemas import SessionState
import faiss

client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)

async def stream_chat(
    query: str,
    session: SessionState,
    faiss_index: faiss.Index,
    chunks: list
):
    """Yields SSE-formatted tokens."""
    top_chunks = search(query, faiss_index, chunks, k=FAISS_TOP_K)
    
    context_parts = []
    for chunk in top_chunks:
        context_parts.append(f"[{chunk.heading}]\n{chunk.text}")
    retrieved_context = "\n\n---\n\n".join(context_parts)
    
    async with client.messages.stream(
        model=MODEL,
        max_tokens=MAX_TOKENS_CHAT,
        system=CHAT_SYSTEM.format(retrieved_context=retrieved_context),
        messages=[{"role": "user", "content": query}]
    ) as stream:
        async for text in stream.text_stream:
            yield f"data: {text}\n\n"
    
    yield "data: [DONE]\n\n"
```

### `main.py`
```python
import uuid
import json
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse

from parser import extract_pdf
from chunker import split_clauses
from embedder import build_index
from analyzer import run_pass1, run_pass2
from chat import stream_chat
from schemas import *

app = FastAPI(title="LexGuard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session stores
sessions: dict[str, SessionState] = {}
sessions_faiss: dict[str, tuple] = {}  # sid → (faiss_index, chunks)

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/upload", response_model=UploadResponse)
async def upload(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported")
    
    pdf_bytes = await file.read()
    raw_text, page_map = extract_pdf(pdf_bytes)
    chunks = split_clauses(raw_text)
    faiss_index, ordered_chunks = build_index(chunks)
    
    pass1 = await run_pass1(raw_text)
    
    sid = str(uuid.uuid4())
    sessions[sid] = SessionState(
        session_id=sid,
        filename=file.filename,
        raw_text=raw_text,
        page_map=page_map,
        pass1_result=pass1
    )
    sessions_faiss[sid] = (faiss_index, ordered_chunks)
    
    return UploadResponse(
        session_id=sid,
        document_type=pass1.document_type,
        parties=pass1.parties,
        clause_count=len(pass1.clauses),
        pass1_clauses=pass1.clauses
    )

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(session_id: str):
    if session_id not in sessions:
        raise HTTPException(404, "Session not found")
    
    session = sessions[session_id]
    risk_report = await run_pass2(session.pass1_result)
    sessions[session_id].risk_report = risk_report
    
    summary = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for r in risk_report:
        summary[r.severity] += 1
    
    return AnalyzeResponse(
        session_id=session_id,
        risk_report=risk_report,
        summary=summary
    )

@app.post("/chat")
async def chat(req: ChatRequest):
    if req.session_id not in sessions:
        raise HTTPException(404, "Session not found")
    
    session = sessions[req.session_id]
    faiss_index, chunks = sessions_faiss[req.session_id]
    
    async def generator():
        async for chunk in stream_chat(req.query, session, faiss_index, chunks):
            yield chunk
    
    return StreamingResponse(generator(), media_type="text/event-stream")

@app.get("/report/{session_id}", response_model=ReportResponse)
async def get_report(session_id: str):
    if session_id not in sessions:
        raise HTTPException(404, "Session not found")
    
    session = sessions[session_id]
    summary = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for r in session.risk_report:
        summary[r.severity] += 1
    
    return ReportResponse(
        session_id=session_id,
        filename=session.filename,
        pass1_result=session.pass1_result,
        risk_report=session.risk_report,
        summary=summary
    )
```

### `Dockerfile`
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for PyMuPDF
RUN apt-get update && apt-get install -y \
    libmupdf-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the embedding model at build time
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

### `requirements.txt`
```
fastapi==0.115.0
uvicorn[standard]==0.32.0
python-multipart==0.0.12
pymupdf==1.24.11
sentence-transformers==3.3.0
faiss-cpu==1.9.0
numpy==1.26.4
anthropic==0.40.0
pydantic==2.9.0
sse-starlette==2.1.3
```

---

## 7. Frontend — Premium UI System (GSAP + WebGL + React)

> **Design Philosophy:** Claude.ai-grade minimalism. No gradients trying to look "AI". No icon libraries. No card shadows. The UI is a precision instrument — like a Bloomberg terminal crossed with a surgeon's table. Information-dense but never cluttered. Every animation has a job. If an animation doesn't communicate state, it doesn't exist.

---

### 7.0 The Design Constraint Manifesto

Before any code, internalize these rules. They are enforced. No exceptions.

```
NEVER:
  ✗ Purple/blue AI gradients (Perplexity disease)
  ✗ Rounded pill buttons with drop shadows
  ✗ Heroicons, Lucide, FontAwesome, or any icon library
  ✗ Spinning loading circles
  ✗ Bounce/elastic easing on anything
  ✗ Card hover lift effects (translateY + box-shadow)
  ✗ Toast notifications that slide in from corner
  ✗ Gradient text (background-clip: text)
  ✗ Skeleton loaders with shimmer pulse

ALWAYS:
  ✓ Monochromatic with single surgical accent per severity
  ✓ 1px borders, never 2px or more
  ✓ Whitespace that breathes — minimum 24px gutters everywhere
  ✓ Text as the primary UI element — labels, not icons
  ✓ Animations that reveal information, not decorate it
  ✓ Every interactive element has a visible focus ring
  ✓ Motion reduced for users who prefer it (prefers-reduced-motion)
```

---

### 7.1 CDN Stack — Load Order Matters

```html
<!-- In <head>, load in this exact order -->

<!-- 1. Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist+Mono:wght@300;400;500&family=Geist:wght@300;400;500&display=swap" rel="stylesheet">

<!-- 2. React 18 (production) -->
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

<!-- 3. GSAP Core + plugins (CDN) -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/CustomEase.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/SplitText.min.js"></script>

<!-- 4. Three.js for WebGL -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>

<!-- Note: GSAP SplitText requires Club GreenSock license for production.
     For hackathon demo: use the CDN trial version which works for 24hrs.
     Alternative: implement manual char-splitting in JS (see Section 7.5) -->
```

---

### 7.2 Design Token System

Define all tokens as CSS custom properties. Never hardcode a color or spacing value anywhere else.

```css
:root {
  /* ─── COLOR SYSTEM ─── */
  --bg-0: #080809;          /* page background — deepest */
  --bg-1: #0E0F11;          /* panel background */
  --bg-2: #141518;          /* card background */
  --bg-3: #1C1D21;          /* input/hover background */

  --border-0: #1F2024;      /* subtle dividers */
  --border-1: #2A2C31;      /* card borders */
  --border-2: #3D4047;      /* active/focus borders */

  --text-0: #F2EDE8;        /* primary — warm white */
  --text-1: #9A9BA4;        /* secondary — muted */
  --text-2: #5A5B63;        /* tertiary — ghost */
  --text-inv: #080809;      /* text on light bg */

  /* ─── SEVERITY PALETTE ─── */
  /* Critical: cold white-red, clinical not dramatic */
  --sev-critical-bg:     #100A0B;
  --sev-critical-border: #8B1A27;
  --sev-critical-text:   #E8646F;
  --sev-critical-glow:   rgba(139, 26, 39, 0.15);

  /* High: amber, not orange — warning, not alarm */
  --sev-high-bg:         #0F0C07;
  --sev-high-border:     #7A5410;
  --sev-high-text:       #D4933E;
  --sev-high-glow:       rgba(122, 84, 16, 0.12);

  /* Medium: desaturated yellow-green */
  --sev-medium-bg:       #0C0F07;
  --sev-medium-border:   #4A5E18;
  --sev-medium-text:     #8EAA48;
  --sev-medium-glow:     rgba(74, 94, 24, 0.10);

  /* Low: steel blue */
  --sev-low-bg:          #080C10;
  --sev-low-border:      #1C3E5A;
  --sev-low-text:        #4D88B8;
  --sev-low-glow:        rgba(28, 62, 90, 0.10);

  /* ─── TYPOGRAPHY SCALE ─── */
  --font-serif:    'Instrument Serif', Georgia, serif;
  --font-mono:     'Geist Mono', 'Fira Code', monospace;
  --font-sans:     'Geist', -apple-system, sans-serif;

  --text-xs:   11px;
  --text-sm:   13px;
  --text-base: 15px;
  --text-md:   17px;
  --text-lg:   22px;
  --text-xl:   32px;
  --text-2xl:  48px;

  --leading-tight:  1.2;
  --leading-normal: 1.5;
  --leading-loose:  1.8;

  /* ─── SPACING SCALE ─── */
  --sp-1:  4px;
  --sp-2:  8px;
  --sp-3:  12px;
  --sp-4:  16px;
  --sp-5:  24px;
  --sp-6:  32px;
  --sp-7:  48px;
  --sp-8:  64px;

  /* ─── ANIMATION ─── */
  --ease-out-expo: cubic-bezier(0.19, 1, 0.22, 1);
  --ease-in-expo:  cubic-bezier(0.95, 0.05, 0.795, 0.035);
  --ease-inout:    cubic-bezier(0.76, 0, 0.24, 1);
  --dur-fast:      120ms;
  --dur-base:      240ms;
  --dur-slow:      400ms;
  --dur-enter:     600ms;
}
```

---

### 7.3 Typography Rules — No Exceptions

```
Instrument Serif (serif)
  USE FOR: Wordmark "LexGuard", document title, clause headings in detail panel
  SIZE: 48px (wordmark), 28px (doc title), 20px (clause heading)
  STYLE: Use italic variant for emphasis — never bold

Geist Mono (monospace)
  USE FOR: All clause text, red flags, severity scores, code-like labels
  SIZE: 13px (clause text), 11px (badges/labels)
  WEIGHT: 300 for body text, 500 for highlighted phrases
  LETTER-SPACING: 0.02em

Geist (sans-serif)
  USE FOR: UI text only — button labels, descriptions, chat messages, metadata
  SIZE: 15px (body), 13px (secondary), 11px (caps labels)
  WEIGHT: 300 for descriptions, 400 for interactive elements
  CAPS LABELS: font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
```

---

### 7.4 WebGL Background — Upload Screen

The upload screen has a live WebGL canvas as background. It renders a field of slowly drifting particles that respond to mouse position — like documents floating in space. Extremely subtle. Never distracting.

```javascript
// WebGLBackground component — renders to a full-screen canvas behind all UI
// Implementation: Three.js BufferGeometry + ShaderMaterial

function WebGLBackground() {
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 5;

    // Particle field: 800 points, randomized in sphere
    const count = 800;
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 20;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8;
      speeds[i] = Math.random() * 0.3 + 0.05;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Custom shader: dots that fade by distance, pulse gently
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:  { value: 0 },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uColor: { value: new THREE.Color('#2A2C31') },  // matches --border-1
      },
      vertexShader: `
        uniform float uTime;
        uniform vec2 uMouse;
        void main() {
          vec3 pos = position;
          // Slow drift
          pos.y += sin(uTime * 0.2 + position.x * 0.5) * 0.05;
          pos.x += cos(uTime * 0.15 + position.z * 0.3) * 0.03;
          // Subtle mouse repulsion
          vec2 toMouse = uMouse - pos.xy;
          float dist = length(toMouse);
          if (dist < 2.0) {
            pos.xy -= normalize(toMouse) * (2.0 - dist) * 0.1;
          }
          gl_PointSize = 1.5;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          gl_FragColor = vec4(uColor, 0.4);
        }
      `,
      transparent: true,
    });

    const particles = new THREE.Points(geo, mat);
    scene.add(particles);

    // Mouse tracking
    const mouse = new THREE.Vector2();
    const onMouseMove = (e) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      mat.uniforms.uMouse.value.set(mouse.x * 10, mouse.y * 6);
    };
    window.addEventListener('mousemove', onMouseMove);

    // Animation loop
    let frameId;
    const tick = (t) => {
      mat.uniforms.uTime.value = t * 0.001;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);

    // Resize handler
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 0.6,
      }}
    />
  );
}
```

---

### 7.5 GSAP Animation System — All Defined Animations

Register custom eases once, globally, on app init:

```javascript
// Register at app mount — never inline
gsap.registerPlugin(ScrollTrigger, CustomEase);

CustomEase.create('lexOut',    '0.19, 1, 0.22, 1');   // smooth deceleration
CustomEase.create('lexIn',     '0.8, 0, 0.2, 1');     // sharp acceleration
CustomEase.create('lexReveal', '0.16, 1, 0.3, 1');    // content reveal
```

#### Animation 1 — Upload Screen Entry

Fires once on first paint. Staggered reveal of wordmark + tagline + dropzone.

```javascript
function animateUploadEntry() {
  const tl = gsap.timeline({ defaults: { ease: 'lexReveal' } });

  // Wordmark chars split and slide up
  tl.from('.wordmark-char', {
    y: 40,
    opacity: 0,
    duration: 0.8,
    stagger: 0.04,
  })
  .from('.tagline', {
    y: 16,
    opacity: 0,
    duration: 0.6,
  }, '-=0.4')
  .from('.dropzone', {
    y: 24,
    opacity: 0,
    duration: 0.5,
  }, '-=0.3')
  .from('.upload-meta', {
    opacity: 0,
    duration: 0.4,
  }, '-=0.2');
}

// Wordmark split — no SplitText lib needed:
function WordmarkSplit({ text }) {
  return (
    <span>
      {text.split('').map((char, i) => (
        <span key={i} className="wordmark-char" style={{ display: 'inline-block' }}>
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </span>
  );
}
```

#### Animation 2 — DropZone Drag State

Not a CSS transition. GSAP for precise control.

```javascript
function animateDragEnter(dropzoneEl) {
  gsap.to(dropzoneEl, {
    borderColor: 'var(--border-2)',
    backgroundColor: 'var(--bg-3)',
    duration: 0.2,
    ease: 'lexOut',
  });
  gsap.to(dropzoneEl.querySelector('.drop-label'), {
    y: -4,
    opacity: 0.6,
    duration: 0.2,
  });
}

function animateDragLeave(dropzoneEl) {
  gsap.to(dropzoneEl, {
    borderColor: 'var(--border-0)',
    backgroundColor: 'transparent',
    duration: 0.3,
    ease: 'lexOut',
  });
  gsap.to(dropzoneEl.querySelector('.drop-label'), {
    y: 0,
    opacity: 1,
    duration: 0.3,
  });
}
```

#### Animation 3 — Screen Transition: Upload → Analysis → Dashboard

Three distinct phases. Each has its own GSAP timeline.

```javascript
// PHASE 1: Upload screen exits as analysis begins
function transitionToAnalysis(uploadEl, analysisEl) {
  const tl = gsap.timeline();
  tl.to(uploadEl, {
    opacity: 0,
    scale: 0.97,
    duration: 0.4,
    ease: 'lexIn',
    onComplete: () => { uploadEl.style.display = 'none'; }
  })
  .from(analysisEl, {
    opacity: 0,
    duration: 0.4,
    ease: 'lexReveal',
    onStart: () => { analysisEl.style.display = 'flex'; }
  }, '-=0.1');
}

// PHASE 2: Analysis progress — each clause name "ticks" in
function animateClauseProgress(clauseEl, index) {
  gsap.from(clauseEl, {
    x: -12,
    opacity: 0,
    duration: 0.35,
    delay: index * 0.05,
    ease: 'lexOut',
  });
}

// PHASE 3: Dashboard enters — staggered column reveal
function animateDashboardEntry() {
  const tl = gsap.timeline({ defaults: { ease: 'lexReveal' } });

  tl.from('.header-bar', {
    y: -16,
    opacity: 0,
    duration: 0.5,
  })
  .from('.severity-summary span', {
    opacity: 0,
    y: 8,
    stagger: 0.08,
    duration: 0.4,
  }, '-=0.2')
  .from('.clause-card', {
    x: -20,
    opacity: 0,
    stagger: 0.06,
    duration: 0.45,
  }, '-=0.2')
  .from('.detail-panel', {
    x: 24,
    opacity: 0,
    duration: 0.5,
  }, '-=0.4');
}
```

#### Animation 4 — Clause Card Selection

When a user clicks a clause card, the detail panel content swaps with a clean crossfade. The selected card gets a left-border accent animation.

```javascript
function animateClauseSelect(prevDetailEl, nextDetailEl, cardEl) {
  // Fade out old detail
  gsap.to(prevDetailEl, {
    opacity: 0,
    x: 8,
    duration: 0.18,
    ease: 'lexIn',
    onComplete: () => {
      // Swap content (React state update happens here)
      // Then animate in new detail
      gsap.from(nextDetailEl, {
        opacity: 0,
        x: -8,
        duration: 0.28,
        ease: 'lexReveal',
      });
    }
  });

  // Left border accent: draw from top
  gsap.fromTo(cardEl.querySelector('.severity-accent-bar'), {
    scaleY: 0,
    transformOrigin: 'top center',
  }, {
    scaleY: 1,
    duration: 0.3,
    ease: 'lexReveal',
  });
}
```

#### Animation 5 — Risk Score Reveal (WebGL-adjacent: Canvas 2D)

When a clause detail opens, the suspicion score animates from 0 to its value on a circular arc drawn on a `<canvas>`. This is a 2D canvas animation, not WebGL — fast and lightweight.

```javascript
function RiskArc({ score }) {
  // score: 0.0 – 10.0
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const size = 64;
    canvas.width = size;
    canvas.height = size;
    const cx = size / 2, cy = size / 2, r = 26;
    const startAngle = Math.PI * 0.75;
    const fullAngle = Math.PI * 1.5;

    // Severity color from score
    const color = score >= 8 ? '#8B1A27'
                : score >= 6 ? '#7A5410'
                : score >= 4 ? '#4A5E18'
                : '#1C3E5A';

    let current = 0;
    const target = score / 10;

    const draw = (progress) => {
      ctx.clearRect(0, 0, size, size);
      // Track arc
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, startAngle + fullAngle);
      ctx.strokeStyle = 'rgba(42, 44, 49, 0.8)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();
      // Progress arc
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, startAngle + fullAngle * progress);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();
      // Score text
      ctx.fillStyle = '#F2EDE8';
      ctx.font = '500 13px Geist Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(score.toFixed(1), cx, cy);
    };

    gsap.to({ p: 0 }, {
      p: target,
      duration: 0.8,
      ease: 'lexOut',
      onUpdate: function() { draw(this.targets()[0].p); }
    });
  }, [score]);

  return <canvas ref={canvasRef} style={{ width: 64, height: 64 }} />;
}
```

#### Animation 6 — Analysis Progress Bar (WebGL Scanline)

During the 10–20 second analysis phase, show a horizontal progress bar with a scanline shader effect. Implemented as a small WebGL canvas strip — not CSS.

```javascript
function ScanlineProgressBar({ progress }) {
  // progress: 0.0 – 1.0
  const canvasRef = React.useRef(null);
  const rendererRef = React.useRef(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
    renderer.setSize(canvas.parentElement.clientWidth, 2);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    const geo = new THREE.PlaneGeometry(2, 2);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uProgress: { value: 0 },
        uTime:     { value: 0 },
      },
      vertexShader: `void main() { gl_Position = vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uProgress;
        uniform float uTime;
        void main() {
          float x = gl_FragCoord.x / ${canvas.parentElement.clientWidth}.0;
          // Fill up to progress
          float fill = step(x, uProgress);
          // Scanline shimmer — moves right to left
          float shimmer = sin((x - uTime * 0.4) * 30.0) * 0.15 + 0.85;
          vec3 baseColor = mix(
            vec3(0.1, 0.11, 0.13),       // unfilled track
            vec3(0.55, 0.4, 0.24) * shimmer,  // filled — warm amber
            fill
          );
          gl_FragColor = vec4(baseColor, fill > 0.0 ? 0.9 : 0.3);
        }
      `,
      transparent: true,
    });

    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    rendererRef.current = { renderer, mat, scene, camera };

    let frameId;
    const tick = (t) => {
      mat.uniforms.uTime.value = t * 0.001;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);

    return () => { cancelAnimationFrame(frameId); renderer.dispose(); };
  }, []);

  React.useEffect(() => {
    if (!rendererRef.current) return;
    gsap.to(rendererRef.current.mat.uniforms.uProgress, {
      value: progress,
      duration: 0.6,
      ease: 'lexOut',
    });
  }, [progress]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: 2, display: 'block' }}
    />
  );
}
```

#### Animation 7 — Chat Message Stream

As tokens stream in, they appear character by character with a subtle fade. The cursor blinks using CSS only.

```css
/* Streaming cursor — CSS only, no JS */
.streaming-cursor::after {
  content: '▋';
  font-family: var(--font-mono);
  color: var(--text-2);
  animation: blink 0.9s step-end infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
```

```javascript
// Token append — each token fades in
function appendToken(containerEl, token) {
  const span = document.createElement('span');
  span.textContent = token;
  span.style.opacity = '0';
  containerEl.appendChild(span);
  gsap.to(span, { opacity: 1, duration: 0.12, ease: 'none' });
}
```

---

### 7.6 Component Architecture — Precise

```
App
├── <WebGLBackground />               — Three.js particle field, always rendered, z-index 0
│
├── <UploadScreen />                   — z-index 1, shown when view === 'upload'
│   ├── <WordmarkSplit text="LexGuard" />   — Instrument Serif 48px, char-split for GSAP
│   ├── <Tagline />                    — "Read before you sign." — Geist 300 18px italic
│   ├── <DropZone />                   — 1px dashed border, no background
│   │   ├── Label: "Drop your contract here"  — Geist Mono 13px --text-2
│   │   ├── Subtext: "PDF · up to 20MB"       — Geist 11px --text-2
│   │   └── <input type="file" hidden />
│   └── [NO other elements on this screen]
│
├── <AnalysisScreen />                 — shown when view === 'analyzing'
│   ├── <ScanlineProgressBar progress={n/total} />    — 2px WebGL bar, top of screen
│   ├── DocumentMeta: filename + "Analyzing..."       — Geist 13px --text-1
│   └── <ClauseProgressList />         — clauses tick in as analyzed
│       └── ClauseProgressItem[]
│           ├── Status dot: ○ pending | ● analyzing | ✓ done  — Geist Mono
│           └── Clause heading — Geist Mono 13px
│
└── <Dashboard />                      — shown when view === 'dashboard'
    │
    ├── <Header />                     — height 52px, border-bottom 1px --border-0
    │   ├── "LexGuard" wordmark — Instrument Serif 18px
    │   ├── DocumentTitle — Geist 14px --text-1 truncated
    │   ├── <SeveritySummary />        — "3 critical · 4 high · 2 medium · 1 low"
    │   │   [each count in its severity color, dots as separators]
    │   └── <NewAnalysisButton />      — text-only: "New analysis" — Geist 13px --text-2
    │
    ├── <MainLayout />                 — CSS Grid: 340px | 1fr | 380px
    │   │
    │   ├── LEFT COLUMN: <ClauseList />   — border-right 1px --border-0, overflow-y scroll
    │   │   └── <ClauseCard /> × N       — 72px min-height, cursor pointer
    │   │       ├── Left accent bar      — 2px wide, full height, severity color
    │   │       ├── Heading              — Geist Mono 13px --text-0, line-clamp 1
    │   │       ├── Risk type            — Geist 11px uppercase --text-2 letter-spacing
    │   │       └── Severity badge       — "CRITICAL" — Geist Mono 10px severity color
    │   │
    │   ├── CENTER COLUMN: <ClauseDetail />  — padding 32px, overflow-y scroll
    │   │   ├── <RiskArc score={suspicion_score} />   — 64px canvas top-right
    │   │   ├── Heading                  — Instrument Serif 24px italic
    │   │   ├── Severity + category row  — pills, 1px border, severity color
    │   │   │
    │   │   ├── ── SECTION: Plain English ──────────────
    │   │   │   Label: "IN PLAIN ENGLISH"   — Geist 11px uppercase --text-2
    │   │   │   Text:  plain_english        — Geist 15px --text-0 leading-loose
    │   │   │
    │   │   ├── ── SECTION: Consequence ────────────────
    │   │   │   [left-border 2px var(--sev-*-border)]
    │   │   │   Label: "IF YOU SIGN THIS"  — Geist Mono 10px uppercase severity color
    │   │   │   Text:  consequence         — Geist 15px --text-0
    │   │   │
    │   │   ├── ── SECTION: Clause Text ────────────────
    │   │   │   Label: "CLAUSE TEXT"       — Geist 11px uppercase --text-2
    │   │   │   Text:  highlighted text    — Geist Mono 13px --text-1 leading-loose
    │   │   │   [red_flags highlighted: background rgba(139,26,39,0.2) no border-radius]
    │   │   │
    │   │   ├── ── SECTION: Red Flags ──────────────────
    │   │   │   Label: "RED FLAGS"         — Geist 11px uppercase --text-2
    │   │   │   Items: red_flags[]         — Geist Mono 12px, severity color, quoted
    │   │   │   ["any and all inventions"] ["solely or jointly"]
    │   │   │
    │   │   └── ── SECTION: Negotiation ────────────────
    │   │       Label: "NEGOTIATION TIP"   — Geist 11px uppercase --text-2
    │   │       Text:  negotiation_tip     — Geist 14px --text-0
    │   │       [no card, no border — just text with a thin top rule]
    │   │
    │   └── RIGHT COLUMN: <ChatPanel />    — border-left 1px --border-0
    │       ├── Header: "ASK THE CONTRACT" — Geist Mono 11px uppercase --text-2
    │       ├── <MessageList />            — flex-col, gap 16px, overflow-y scroll
    │       │   └── <Message />
    │       │       ├── User: right-aligned, Geist 14px --text-0, --bg-3 bg
    │       │       └── Assistant: left-aligned, Geist 14px --text-0, no bg
    │       │           └── <CitationTag /> — "[§ Non-Compete]" Geist Mono 11px --text-2
    │       └── <ChatInput />
    │           ├── <textarea /> — borderless, --bg-0, resize none, Geist 14px
    │           ├── 1px top border only
    │           └── Send: "↵" key or Shift+Enter submits — no button visible
    │
    └── [NO sidebar, NO nav, NO icons, NO tooltips, NO modals]
```

---

### 7.7 Micro-interaction Rules

Every interactive element must have an explicit hover and focus state. No exceptions. No icon buttons — ever.

```css
/* ─── BASE RESET ─── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: var(--bg-0);
  color: var(--text-0);
  font-family: var(--font-sans);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  -webkit-font-smoothing: antialiased;
}

/* ─── CLAUSE CARDS ─── */
.clause-card {
  position: relative;
  padding: var(--sp-4) var(--sp-5);
  border-bottom: 1px solid var(--border-0);
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease-out-expo);
}
.clause-card:hover { background: var(--bg-2); }
.clause-card.active { background: var(--bg-2); }

.severity-accent-bar {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 2px;
  /* Color set dynamically via JS based on severity */
}

/* ─── DROPZONE ─── */
.dropzone {
  border: 1px dashed var(--border-0);
  padding: var(--sp-8) var(--sp-7);
  cursor: pointer;
  transition:
    border-color var(--dur-base) var(--ease-out-expo),
    background  var(--dur-base) var(--ease-out-expo);
}
/* No hover styles — handled by GSAP for precision */

/* ─── CHAT INPUT ─── */
.chat-textarea {
  width: 100%;
  background: transparent;
  border: none;
  border-top: 1px solid var(--border-0);
  color: var(--text-0);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  padding: var(--sp-4) var(--sp-5);
  resize: none;
  outline: none;
  min-height: 52px;
  max-height: 120px;
}
.chat-textarea::placeholder { color: var(--text-2); }

/* ─── RED FLAG HIGHLIGHTS ─── */
mark.red-flag {
  background: rgba(139, 26, 39, 0.18);
  color: var(--sev-critical-text);
  padding: 1px 2px;
  border-radius: 0;  /* NEVER round — legal precision */
  font-weight: 500;
}

/* ─── FOCUS RINGS ─── */
:focus-visible {
  outline: 1px solid var(--border-2);
  outline-offset: 2px;
}

/* ─── SCROLLBARS ─── */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border-1); border-radius: 0; }

/* ─── REDUCED MOTION ─── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

### 7.8 What is Intentionally Absent

These are explicit decisions. Do not add them.

```
ABSENT                       WHY
─────────────────────────    ────────────────────────────────────────────
Dark mode toggle             It's always dark. That is the product.
Loading skeletons            The scanline progress bar is the loading state.
Success toast notifications  State change is communicated by view transition.
Modal/dialog overlays        All info is inline. Nothing blocks the view.
Hamburger/nav menu           Single-page — no navigation needed.
Breadcrumbs                  Header shows context without hierarchy.
Footer                       Judges look at the product, not the footer.
Emoji in UI                  Never.
Animated counter numbers     The severity summary is static text.
Confetti on analysis done    This is a legal tool, not a quiz app.
Share/export button          Out of scope. Cut ruthlessly.
Icon library (any)           Zero icons. Text labels only.
```

---

### 7.9 Performance Contracts

These must be true before demo. Test them.

```
Metric                           Target         How to Test
──────────────────────────────   ─────────      ──────────────────────────
Upload screen paint              < 800ms        Lighthouse → FCP
WebGL particle field FPS         > 55fps        Chrome DevTools → Rendering → FPS meter
GSAP dashboard entry animation   < 600ms total  Performance timeline
Clause card click → detail swap  < 200ms        Manual stopwatch
Chat first token visible         < 3s           Network tab SSE timing
Total JS (unminified)            < 400KB        Chrome Network tab
No layout shifts after load      CLS = 0        Lighthouse
```

---

### 7.10 File Output Structure

All frontend is a **single `index.html`** file. Internal `<style>` and `<script type="text/babel">` tags. No external files except CDN.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LexGuard — Read Before You Sign</title>

  <!-- Fonts -->
  <link href="..." rel="stylesheet">

  <!-- CDN Libraries (see Section 7.1 for exact URLs) -->
  <script src="...react..."></script>
  <script src="...react-dom..."></script>
  <script src="...babel..."></script>
  <script src="...gsap..."></script>
  <script src="...gsap-plugins..."></script>
  <script src="...three.js..."></script>

  <style>
    /* All CSS from Section 7.2 (tokens) + Section 7.7 (micro-interactions) */
    /* ~200 lines total */
  </style>
</head>
<body>
  <div id="root"></div>

  <script type="text/babel">
    // All React components
    // All GSAP animations
    // All WebGL setup
    // API calls
    // SSE chat handler
    // ~600–800 lines total
    
    ReactDOM.createRoot(document.getElementById('root')).render(<App />);
  </script>
</body>
</html>
```

**Line budget for `index.html`:**
```
CSS tokens + resets:         ~200 lines
React components:            ~450 lines
GSAP animation functions:    ~150 lines
WebGL (Three.js setup):      ~120 lines
API + SSE handlers:           ~80 lines
─────────────────────────────────────
Total:                      ~1000 lines  (single file, no build step)
```

---

## 8. Test Cases — Complete Suite

### `tests/test_parser.py`

```python
import pytest
from backend.parser import extract_pdf

def test_extract_real_pdf():
    with open("test_contracts/employment_agreement.pdf", "rb") as f:
        pdf_bytes = f.read()
    raw_text, page_map = extract_pdf(pdf_bytes)
    
    assert len(raw_text) > 500, "Should extract substantial text"
    assert len(page_map) > 0, "Should have at least 1 page"
    assert isinstance(page_map[1], str), "Page map should map int to str"

def test_empty_pdf_returns_empty():
    # Use a 1-page blank PDF for edge case
    raw_text, page_map = extract_pdf(b"")
    # Should not raise — return empty
    assert raw_text == "" or len(raw_text) == 0
```

### `tests/test_chunker.py`

```python
from backend.chunker import split_clauses

SAMPLE_CONTRACT = """
1. EMPLOYMENT RELATIONSHIP
The Company hereby employs Employee as a Software Engineer.
This is an at-will employment agreement.

2. INTELLECTUAL PROPERTY
Employee agrees that all inventions, discoveries, and works of authorship,
whether or not patentable, that Employee conceives or creates during employment
shall be the sole and exclusive property of the Company.

NON-COMPETE
During employment and for 24 months thereafter, Employee shall not engage
in any business activity that competes with the Company.
"""

def test_split_numbered_sections():
    chunks = split_clauses(SAMPLE_CONTRACT)
    assert len(chunks) >= 2, "Should find at least 2 numbered sections"

def test_split_all_caps_headings():
    chunks = split_clauses(SAMPLE_CONTRACT)
    headings = [c.heading for c in chunks]
    assert any("NON-COMPETE" in h for h in headings), "Should detect ALL CAPS heading"

def test_min_chunk_length():
    chunks = split_clauses(SAMPLE_CONTRACT)
    for chunk in chunks:
        assert len(chunk.text) >= 50, f"Chunk too short: {chunk.text}"

def test_fallback_paragraph_split():
    # Text with no structural markers
    plain_text = "This is sentence one.\n\nThis is sentence two.\n\nThis is sentence three."
    chunks = split_clauses(plain_text)
    assert len(chunks) >= 2, "Fallback should split into paragraphs"
```

### `tests/test_analyzer.py`

```python
import pytest
import asyncio
from backend.analyzer import run_pass1, run_pass2
from backend.schemas import Pass1Result, RiskAnalysis

EMPLOYMENT_TEXT = """
EMPLOYMENT AGREEMENT

This agreement is between Acme Corp ("Company") and John Doe ("Employee").

1. NON-COMPETE
Employee agrees not to engage in any competing business activity for 24 months
after termination, within 50 miles of any Company office.

2. INTELLECTUAL PROPERTY
All inventions conceived during or related to employment shall be assigned
to the Company, including work done on personal time.

3. ARBITRATION
Any disputes shall be resolved by binding arbitration. Employee waives the
right to jury trial or class action proceedings.
"""

@pytest.mark.asyncio
async def test_pass1_returns_valid_schema():
    result = await run_pass1(EMPLOYMENT_TEXT)
    assert isinstance(result, Pass1Result)
    assert result.document_type != ""
    assert len(result.clauses) > 0
    assert all(0 <= c.suspicion_score <= 10 for c in result.clauses)

@pytest.mark.asyncio
async def test_pass1_sorts_by_suspicion():
    result = await run_pass1(EMPLOYMENT_TEXT)
    scores = [c.suspicion_score for c in result.clauses]
    assert scores == sorted(scores, reverse=True), "Clauses must be sorted desc"

@pytest.mark.asyncio
async def test_pass2_returns_valid_risk_analysis():
    pass1 = await run_pass1(EMPLOYMENT_TEXT)
    results = await run_pass2(pass1)
    assert len(results) > 0
    assert all(isinstance(r, RiskAnalysis) for r in results)

@pytest.mark.asyncio
async def test_pass2_finds_non_compete():
    pass1 = await run_pass1(EMPLOYMENT_TEXT)
    results = await run_pass2(pass1)
    risk_types = [r.risk_type.lower() for r in results]
    assert any("non-compete" in rt or "noncompete" in rt for rt in risk_types)

@pytest.mark.asyncio
async def test_pass2_finds_arbitration():
    pass1 = await run_pass1(EMPLOYMENT_TEXT)
    results = await run_pass2(pass1)
    risk_types = [r.risk_type.lower() for r in results]
    assert any("arbitration" in rt for rt in risk_types)

@pytest.mark.asyncio
async def test_consequence_starts_with_if_you_sign():
    pass1 = await run_pass1(EMPLOYMENT_TEXT)
    results = await run_pass2(pass1)
    for r in results:
        assert r.consequence.startswith("If you sign this"), \
            f"Consequence must start with 'If you sign this': {r.consequence}"
```

### `tests/test_chat.py`

```python
import pytest
from backend.embedder import build_index, search
from backend.chunker import Chunk

CHUNKS = [
    Chunk("c1", "Non-Compete", "Employee shall not work for competitors for 24 months"),
    Chunk("c2", "IP Assignment", "All inventions belong to the Company"),
    Chunk("c3", "Arbitration", "Disputes resolved by binding arbitration, no jury trial"),
]

def test_faiss_returns_top_k():
    index, ordered = build_index(CHUNKS)
    results = search("can I work for a competitor", index, ordered, k=2)
    assert len(results) == 2

def test_faiss_finds_relevant_chunk():
    index, ordered = build_index(CHUNKS)
    results = search("can I work for a competitor", index, ordered, k=1)
    assert "Non-Compete" in results[0].heading, "Most relevant chunk should be non-compete"

def test_faiss_ip_query():
    index, ordered = build_index(CHUNKS)
    results = search("who owns code I write", index, ordered, k=1)
    assert "IP" in results[0].heading or "Inventions" in results[0].heading or "Assignment" in results[0].heading
```

### Integration Test — `tests/test_e2e.py`

```python
import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

def test_upload_pdf():
    with open("test_contracts/employment_agreement.pdf", "rb") as f:
        r = client.post("/upload", files={"file": ("test.pdf", f, "application/pdf")})
    assert r.status_code == 200
    data = r.json()
    assert "session_id" in data
    assert data["clause_count"] > 0

def test_analyze_after_upload():
    with open("test_contracts/employment_agreement.pdf", "rb") as f:
        upload_r = client.post("/upload", files={"file": ("test.pdf", f, "application/pdf")})
    sid = upload_r.json()["session_id"]
    
    analyze_r = client.post(f"/analyze?session_id={sid}")
    assert analyze_r.status_code == 200
    data = analyze_r.json()
    assert len(data["risk_report"]) > 0
    assert "summary" in data

def test_report_endpoint():
    with open("test_contracts/employment_agreement.pdf", "rb") as f:
        upload_r = client.post("/upload", files={"file": ("test.pdf", f, "application/pdf")})
    sid = upload_r.json()["session_id"]
    client.post(f"/analyze?session_id={sid}")
    
    r = client.get(f"/report/{sid}")
    assert r.status_code == 200
```

---

## 9. Build Waves — 4-Hour Sprint

Each Wave has: Goal · Steps · Acceptance Criteria · Time Budget

---

### WAVE 1 — Backend Foundation `[00:00 – 01:00]`

**Goal:** FastAPI app running locally, PDF parsing works, Pass 1 returns valid JSON

**Steps:**
```bash
# 1. Create project
mkdir lexguard && cd lexguard
mkdir backend frontend test_contracts tests

# 2. Create requirements.txt (paste from Section 6)
# 3. Create virtual environment
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 4. Implement files in this order:
#    config.py → schemas.py → prompts.py → parser.py → chunker.py → analyzer.py (Pass 1 only)

# 5. Quick smoke test:
python -c "
import asyncio
from backend.analyzer import run_pass1
sample = open('test_contracts/employment_agreement.pdf', 'rb').read()
from backend.parser import extract_pdf
text, _ = extract_pdf(sample)
result = asyncio.run(run_pass1(text))
print(result.document_type)
print(len(result.clauses), 'clauses found')
"

# 6. Stand up FastAPI with just /health and /upload
uvicorn backend.main:app --reload --port 8000

# 7. Test upload:
curl -X POST http://localhost:8000/upload \
  -F "file=@test_contracts/employment_agreement.pdf"
```

**Acceptance Criteria:**
- [ ] `/health` returns `{"status": "ok"}`
- [ ] `/upload` with PDF returns JSON with `session_id`, `clause_count > 0`, `document_type`
- [ ] Pass 1 JSON is valid (no JSON parse errors)
- [ ] At least 3 clauses detected in sample employment contract
- [ ] `suspicion_score` values between 0 and 10

**Failure Modes + Fixes:**
- `JSON parse error from Claude` → Check PASS1_SYSTEM prompt ends with "No other text". If still failing, add `response = response.strip().lstrip("```json").rstrip("```")`
- `PyMuPDF import error` → `pip install pymupdf` not `PyMuPDF` — exact casing matters on some platforms
- `ANTHROPIC_API_KEY not found` → `export ANTHROPIC_API_KEY=sk-...` in shell before running

---

### WAVE 2 — Risk Analysis + Vector Chat `[01:00 – 02:00]`

**Goal:** Pass 2 working, FAISS index built, chat endpoint streaming

**Steps:**
```bash
# 1. Implement embedder.py (MiniLM + FAISS)
# 2. Complete analyzer.py (add run_pass2)
# 3. Implement chat.py
# 4. Add /analyze and /chat routes to main.py
# 5. Deploy to Cloud Run (do this NOW — first deploy always has issues)

# Test Pass 2 locally first:
python -c "
import asyncio
from backend.analyzer import run_pass1, run_pass2
# ... load test PDF ... 
result = asyncio.run(run_pass2(pass1_result))
print(result[0].severity, result[0].consequence)
"

# Test chat streaming:
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"session_id": "YOUR_SID", "query": "Can they own code I write at home?"}' \
  --no-buffer

# Deploy to Cloud Run:
gcloud run deploy lexguard \
  --source ./backend \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 1 \
  --set-env-vars ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
```

**Acceptance Criteria:**
- [ ] `/analyze` returns `risk_report` with at least 3 items
- [ ] Each item has `severity`, `plain_english`, `consequence`, `red_flags[]`, `negotiation_tip`
- [ ] `consequence` starts with "If you sign this,"
- [ ] `red_flags` contains exact phrases that appear in clause text
- [ ] `/chat` streams tokens (verify with `--no-buffer` in curl)
- [ ] Cloud Run deploy succeeds: `gcloud run services list` shows `lexguard` READY

**Failure Modes + Fixes:**
- `asyncio.gather returns exceptions` → Check `return_exceptions=True` in `run_pass2`; filter with `isinstance(r, RiskAnalysis)`
- `FAISS import error on Cloud Run` → Use `faiss-cpu` not `faiss-gpu` in requirements.txt
- `sentence_transformers slow on cold start` → Pre-download model in Dockerfile (`RUN python -c "..."`)
- `Cloud Run OOM` → 512Mi is fine for MiniLM; if it dies, bump to 1Gi temporarily

---

### WAVE 3 — Frontend `[02:00 – 03:15]`

**Goal:** Full UI in `index.html` — upload, dashboard, clause detail, chat

**Steps:**
```
1. Build index.html structure (React CDN + Tailwind CDN + Google Fonts)
2. Implement UploadScreen with drag-and-drop
3. Implement Dashboard with severity summary bar
4. Implement ClauseCard list (severity colored)
5. Implement ClauseDetail panel (plain english, consequence, red flags, tip)
6. Implement ChatPanel with SSE streaming
7. Wire up API_URL to Cloud Run URL
8. Deploy to Vercel: `vercel deploy --prod` from frontend/
```

**Critical Implementation Notes:**
```javascript
const API_URL = "https://lexguard-XXXX-uc.a.run.app";  // Your Cloud Run URL

// Upload flow:
// 1. POST /upload → get session_id + pass1_clauses
// 2. Show pass1_clauses immediately (before analysis — gives instant feedback)
// 3. POST /analyze → loading spinner per clause
// 4. Merge risk_report with pass1_clauses by clause_id
// 5. Render dashboard

// Demo mode — add to UploadScreen:
const DEMO_MODE = new URLSearchParams(window.location.search).get('demo') === 'true';
if (DEMO_MODE) {
  // Load cached employment_report.json immediately
  const cached = await fetch('/cached_reports/employment_report.json');
  setRiskReport(await cached.json());
}
```

**Acceptance Criteria:**
- [ ] Drag + drop PDF → upload starts immediately
- [ ] Progress message shows during analysis ("Analyzing Non-Compete clause...")
- [ ] Severity summary bar visible at top: "3 Critical · 4 High ..."
- [ ] Clicking a clause card shows detail panel on right
- [ ] Red flag phrases are visually highlighted within clause text (amber background)
- [ ] Chat input sends query, response streams character by character
- [ ] `?demo=true` loads cached report without API call

---

### WAVE 4 — Polish + Demo Prep `[03:15 – 04:00]`

**Goal:** Demo-ready, cached reports, tested with 3 contracts, pitch scripted

**Steps:**
```
1. Pre-analyze 3 contracts, save cached JSON to test_contracts/cached_reports/
2. Run full test suite: pytest tests/ -v
3. Fix any failing tests
4. Test cold start: hit /health after 5min idle, time the response
5. Write demo script (below)
6. Record screen walkthrough video (optional but high-value for judges)
```

**Pre-Demo Checklist:**
```
□ Cloud Run container is awake (hit /health 30s before demo)
□ Demo contract is pre-selected in file picker (don't fumble)
□ 3 chat questions typed in notes app:
    Q1: "Can they own code I write at home on weekends?"
    Q2: "What happens if I quit before 1 year?"
    Q3: "Can I be sued if I join a startup after leaving?"
□ ?demo=true URL is bookmarked for fast fallback
□ Risk report screenshot saved as backup
□ Know your 3 "Critical" clauses by name for the live demo
```

**Acceptance Criteria:**
- [ ] All unit tests passing
- [ ] E2E test with real employment PDF passes
- [ ] Cold start is < 8 seconds (Cloud Run first request)
- [ ] Warm request (pass 1+2) completes in < 20 seconds
- [ ] Chat response starts streaming in < 3 seconds
- [ ] Demo mode (`?demo=true`) loads in < 1 second

---

## 10. Error Handling Map

Every component that can fail has a defined recovery strategy:

| Failure | Detection | Recovery |
|---|---|---|
| PDF has no extractable text (scanned) | `len(raw_text) < 100` | Return error: "This PDF appears to be scanned. Text extraction failed." |
| Pass 1 returns invalid JSON | `json.JSONDecodeError` | Retry once; if fails, return 5 default chunks from rule-based chunker |
| Pass 2 fails for single clause | `Exception` in `gather` | Skip that clause; continue; log clause_id |
| FAISS search returns empty | `len(results) == 0` | Return error in chat: "I couldn't find relevant sections." |
| Cloud Run OOM | Container restart | Add `--memory 1Gi` to deploy command |
| Anthropic rate limit | `anthropic.RateLimitError` | Retry with exponential backoff: `[1, 2, 4]` seconds |
| Claude returns non-JSON | Any non-JSON response | Strip fences: `text.strip().lstrip('```json').rstrip('```')` |
| Session not found | Missing `sid` in dict | Return 404 — frontend clears state and asks re-upload |

---

## 11. `deploy.sh` — One-Command Deploy

```bash
#!/bin/bash
set -e

echo "🚀 Deploying LexGuard to Cloud Run..."

# Build + push to Cloud Run
gcloud run deploy lexguard \
  --source ./backend \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 1 \
  --timeout 300 \
  --set-env-vars ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY

# Get the URL
SERVICE_URL=$(gcloud run services describe lexguard \
  --region us-central1 \
  --format "value(status.url)")

echo "✅ Backend live at: $SERVICE_URL"

# Update frontend API_URL
sed -i "s|http://localhost:8000|$SERVICE_URL|g" frontend/index.html

# Deploy frontend to Vercel
cd frontend
vercel deploy --prod --yes

echo "✅ Deploy complete!"
```

---

## 12. Pitch Script — 2 Minutes

```
[0:00] HOOK
"You're about to sign a 40-page employment contract. 
You have 24 hours and no lawyer. What do you do?"

[0:08] DEMO START — drag drop contract
"LexGuard. Upload any contract."

[0:12] PASS 1 VISIBLE (show clauses appearing)
"In seconds, it identifies every clause and ranks them by risk."

[0:18] ANALYSIS TICKING (if live mode)
"It's doing deep analysis on each clause — not summarizing.
Analyzing. Risk type. Severity. What it means for you."
[Point at architecture diagram if you have one on a second screen]
"Two-pass pipeline — structural extraction first, then clause-level risk analysis.
All powered by Claude Sonnet 4.6 — 200k context, structured JSON output."

[0:45] DASHBOARD APPEARS
"Three critical clauses. Four high. Here's what that means."

[0:50] CLICK NON-COMPETE CLAUSE
"This non-compete. Plain English: you cannot work for any competitor for 24 months.
The consequence?" [read the consequence card]
"The negotiation tip?" [read it]
"That's not a summary. That's actionable intelligence."

[1:10] RED FLAGS
"See these highlighted phrases? These are the exact words in the contract 
that triggered the risk. Not the whole clause — the specific language."

[1:20] CHAT
"Now I can interrogate it."
[Paste: "Can they own code I write at home on weekends?"]
"Watch it cite the exact clause. [Clause: IP Assignment, Section 4.2]
Grounded retrieval. Not hallucination."

[1:40] CLOSE
"Claude Sonnet for reasoning. MiniLM + FAISS for retrieval. 
Single Cloud Run container. Total cost for this demo: under $2."
"LexGuard. Read before you sign."
```

---

## 13. Cost Tracker

| Item | Est. Cost | Notes |
|---|---|---|
| Anthropic API —