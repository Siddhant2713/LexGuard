import uuid
import json
import logging

from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from parser import extract_document
from chunker import split_clauses
from embedder import build_index
from analyzer import run_pass1, run_pass2, run_aggregation
from chat import stream_chat
from schemas import (
    UploadResponse,
    AnalyzeResponse,
    ReportResponse,
    ChatRequest,
    SessionState,
)
from firestore_client import (
    save_session,
    get_session,
    update_risk_report,
    save_chat_message,
    get_chat_history,
)
from storage_client import upload_contract

class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        return json.dumps({
            "severity": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
            "time": self.formatTime(record),
        })

handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logging.root.handlers = [handler]
logging.root.setLevel(logging.INFO)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="LexGuard API",
    description="AI-powered contract intelligence platform",
    version="1.0.0",
)

from config import ALLOWED_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

MAGIC_BYTES = {
    b"%PDF": "application/pdf",
    b"PK\x03\x04": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

def _validate_file_magic(data: bytes, filename: str) -> None:
    for magic, _ in MAGIC_BYTES.items():
        if data[:len(magic)] == magic:
            return
    raise HTTPException(415, f"File content does not match declared type: {filename}")

SUPPORTED_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
}


import os
import asyncio
from config import DEMO_MODE

@app.on_event("startup")
async def startup_event():
    # Pre-load sentence transformer for health checks
    if not DEMO_MODE:
        logger.info("Pre-loading sentence transformer model...")
        from embedder import _get_model
        await asyncio.to_thread(_get_model)
        logger.info("Model loaded")
        
    # Validate Google credentials
    if not DEMO_MODE:
        creds_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")
        if creds_path and not os.path.exists(creds_path):
            logger.error(f"GOOGLE_APPLICATION_CREDENTIALS path does not exist: {creds_path}")
            raise RuntimeError(f"Invalid GOOGLE_APPLICATION_CREDENTIALS: {creds_path}")
        logger.info("Google credentials validated")

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


# ─── Upload ───────────────────────────────────────────────────────────────────

@app.post("/upload", response_model=UploadResponse)
@limiter.limit("10/minute")
async def upload(request: Request, file: UploadFile = File(...)):
    """
    Upload and parse a contract (PDF or DOCX).
    Runs Pass 1 (structural extraction) and returns clauses sorted by suspicion score.
    """
    filename = file.filename or "contract"
    lower = filename.lower()
    if not (lower.endswith(".pdf") or lower.endswith(".docx") or lower.endswith(".doc")):
        raise HTTPException(400, "Only PDF and DOCX files are supported.")

    file_bytes = await file.read()
    if len(file_bytes) > 20 * 1024 * 1024:  # 20 MB limit
        raise HTTPException(413, "File too large. Maximum size is 20MB.")
        
    _validate_file_magic(file_bytes, filename)

    # Parse document
    try:
        raw_text, page_map = extract_document(file_bytes, filename)
    except ValueError as e:
        raise HTTPException(422, str(e))

    # Chunk and build ChromaDB index
    chunks = split_clauses(raw_text)
    session_id = str(uuid.uuid4())
    build_index(session_id, chunks)

    # Run Pass 1
    try:
        pass1 = await run_pass1(raw_text)
    except Exception as e:
        logger.error(f"Pass 1 failed: {e}")
        raise HTTPException(500, f"AI analysis failed during structural extraction: {e}")

    # Determine content type for storage
    content_type = (
        "application/pdf" if lower.endswith(".pdf")
        else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )

    # Upload to Firebase Storage (best-effort — don't fail if storage unavailable)
    storage_url = None
    try:
        storage_url = await upload_contract(session_id, filename, file_bytes, content_type)
    except Exception as e:
        logger.warning(f"Firebase Storage upload failed (non-fatal): {e}")

    # Persist session to Firestore
    session = SessionState(
        session_id=session_id,
        filename=filename,
        storage_url=storage_url,
        document_type=pass1.document_type,
        parties=pass1.parties,
        governing_law=pass1.governing_law,
        pass1_result=pass1,
    )
    try:
        await save_session(session)
    except Exception as e:
        logger.warning(f"Firestore save failed (non-fatal): {e}")

    return UploadResponse(
        session_id=session_id,
        document_type=pass1.document_type,
        parties=pass1.parties,
        governing_law=pass1.governing_law,
        clause_count=len(pass1.clauses),
        pass1_clauses=pass1.clauses,
    )


# ─── Analyze ──────────────────────────────────────────────────────────────────

@app.post("/analyze", response_model=AnalyzeResponse)
@limiter.limit("5/minute")
async def analyze(request: Request, session_id: str = Query(...)):
    """
    Run Pass 2 (per-clause risk analysis) and Pass 3 (aggregation).
    Returns the full risk report and overall contract risk profile.
    """
    session = await get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found. Please re-upload the contract.")

    if not session.pass1_result:
        raise HTTPException(400, "Pass 1 has not completed for this session.")

    # Pass 2 — concurrent per-clause analysis
    try:
        risk_report = await run_pass2(session.pass1_result)
    except Exception as e:
        logger.error(f"Pass 2 failed for session {session_id}: {e}")
        raise HTTPException(500, f"Risk analysis failed: {e}")

    # Pass 3 — overall aggregation
    try:
        aggregation = await run_aggregation(risk_report, session.pass1_result.document_type)
    except Exception as e:
        logger.error(f"Aggregation failed for session {session_id}: {e}")
        raise HTTPException(500, f"Risk aggregation failed: {e}")

    # Build severity summary
    summary = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for clause in risk_report:
        sev = clause.severity.value if hasattr(clause.severity, "value") else clause.severity
        if sev in summary:
            summary[sev] += 1
            
    session.risk_report = risk_report
    session.aggregation = aggregation
    session.summary = summary

    try:
        await update_risk_report(session_id, risk_report, aggregation, summary)
    except Exception as e:
        logger.warning(f"Failed to persist risk report (non-fatal): {e}")

    return AnalyzeResponse(
        session_id=session_id,
        risk_report=risk_report,
        aggregation=aggregation,
        summary=summary,
    )


# ─── Chat ─────────────────────────────────────────────────────────────────────

@app.post("/chat")
async def chat(req: ChatRequest):
    """
    SSE-streamed chat endpoint. Retrieves relevant contract chunks from ChromaDB
    and streams a grounded Gemini response.
    """
    session = await get_session(req.session_id)
    if not session:
        raise HTTPException(404, "Session not found. Please re-upload the contract.")

    # Save user message (best-effort)
    try:
        await save_chat_message(req.session_id, "user", req.query)
    except Exception:
        pass

    # Collect the full response for Firestore (while streaming to client)
    response_buffer: list[str] = []

    async def generator():
        async for token in stream_chat(req.query, req.session_id):
            if token != "data: [DONE]\n\n":
                # Extract text from SSE format for buffering
                text = token.removeprefix("data: ").removesuffix("\n\n")
                response_buffer.append(text)
            yield token

        # Save assistant response to Firestore after stream completes
        if response_buffer:
            full_response = "".join(response_buffer).replace("\\n", "\n")
            try:
                await save_chat_message(req.session_id, "assistant", full_response)
            except Exception:
                pass

    return StreamingResponse(generator(), media_type="text/event-stream")


# ─── Report ───────────────────────────────────────────────────────────────────

@app.get("/report/{session_id}", response_model=ReportResponse)
async def get_report(session_id: str):
    """Retrieve the full analysis report for a session from Firestore."""
    session = await get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found.")

    if not session.pass1_result:
        raise HTTPException(400, "Analysis not yet completed for this session.")

    return ReportResponse(
        session_id=session_id,
        filename=session.filename,
        storage_url=session.storage_url,
        pass1_result=session.pass1_result,
        risk_report=session.risk_report,
        aggregation=session.aggregation,
        summary=session.summary,
    )


# ─── Chat History ─────────────────────────────────────────────────────────────

@app.get("/chat/{session_id}/history")
async def chat_history(session_id: str, limit: int = Query(20, le=100)):
    """Retrieve chat message history for a session."""
    session = await get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found.")

    history = await get_chat_history(session_id, limit=limit)
    return {"session_id": session_id, "messages": history}
