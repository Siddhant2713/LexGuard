import asyncio
import logging
from typing import Optional

from config import DEMO_MODE
from schemas import SessionState, RiskAnalysis, AggregationResult

logger = logging.getLogger(__name__)

# ─── In-memory fallback (used when DEMO_MODE=true) ────────────────────────────
_memory_sessions: dict[str, dict] = {}
_memory_chat: dict[str, list[dict]] = {}

# ─── Firestore client (lazy-loaded, only when not in demo mode) ───────────────
_db = None


def _get_db():
    global _db
    if _db is None:
        from google.cloud import firestore
        _db = firestore.AsyncClient()
    return _db


# ─── Session ──────────────────────────────────────────────────────────────────

async def save_session(session: SessionState) -> None:
    """Persist session metadata to Firestore (or in-memory in demo mode)."""
    if DEMO_MODE:
        _memory_sessions[session.session_id] = session.model_dump(
            exclude={"raw_text", "chat_history"}
        )
        return
    db = _get_db()
    doc_ref = db.collection("sessions").document(session.session_id)
    data = session.model_dump(exclude={"raw_text", "chat_history"})
    await doc_ref.set(data)
    logger.info(f"Saved session {session.session_id} to Firestore")


async def get_session(session_id: str) -> Optional[SessionState]:
    """Retrieve a session from Firestore (or in-memory in demo mode)."""
    if DEMO_MODE:
        data = _memory_sessions.get(session_id)
        if not data:
            return None
        data = dict(data)
        data.setdefault("raw_text", "")
        return SessionState(**data)
    db = _get_db()
    doc_ref = db.collection("sessions").document(session_id)
    snap = await doc_ref.get()
    if not snap.exists:
        return None
    data = snap.to_dict()
    data.setdefault("raw_text", "")
    return SessionState(**data)


async def update_risk_report(
    session_id: str,
    risk_report: list[RiskAnalysis],
    aggregation: AggregationResult,
    summary: dict,
) -> None:
    """Update the risk report on an existing session."""
    if DEMO_MODE:
        if session_id in _memory_sessions:
            _memory_sessions[session_id]["risk_report"] = [r.model_dump() for r in risk_report]
            _memory_sessions[session_id]["aggregation"] = aggregation.model_dump()
            _memory_sessions[session_id]["summary"] = summary
        return
    db = _get_db()
    doc_ref = db.collection("sessions").document(session_id)
    await doc_ref.update({
        "risk_report": [r if isinstance(r, dict) else r.model_dump() for r in risk_report],
        "aggregation": aggregation if isinstance(aggregation, dict) else aggregation.model_dump(),
        "summary": summary,
    })


# ─── Chat History ─────────────────────────────────────────────────────────────

async def save_chat_message(session_id: str, role: str, content: str) -> None:
    """Append a chat message (in-memory in demo mode)."""
    if DEMO_MODE:
        _memory_chat.setdefault(session_id, []).append({"role": role, "content": content})
        return
    db = _get_db()
    from google.cloud import firestore
    chat_ref = (
        db.collection("sessions")
        .document(session_id)
        .collection("chat")
    )
    await chat_ref.add(
        {"role": role, "content": content, "timestamp": firestore.SERVER_TIMESTAMP}
    )


async def get_chat_history(session_id: str, limit: int = 20) -> list[dict]:
    """Retrieve chat history (in-memory in demo mode)."""
    if DEMO_MODE:
        return _memory_chat.get(session_id, [])[-limit:]
    db = _get_db()
    chat_ref = (
        db.collection("sessions")
        .document(session_id)
        .collection("chat")
        .order_by("timestamp")
        .limit(limit)
    )
    docs = []
    async for d in chat_ref.stream():
        docs.append(d)
    return [
        {"role": d.to_dict()["role"], "content": d.to_dict()["content"]}
        for d in docs
    ]
