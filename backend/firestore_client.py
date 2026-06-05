import asyncio
import logging
from typing import Optional

from config import DEMO_MODE, USE_FIREBASE
from schemas import SessionState, RiskAnalysis, AggregationResult

logger = logging.getLogger(__name__)

# ─── In-memory store — PRIMARY store for ALL modes ───────────────────────────
# Firestore is secondary (async persistence). If it fails, in-memory still works.
# Note: in-memory is lost on server restart — use Firestore for production durability.
_memory_sessions: dict[str, dict] = {}
_memory_chat: dict[str, list[dict]] = {}

# ─── Firestore client (lazy-loaded) ──────────────────────────────────────────
_db = None
_db_lock = asyncio.Lock()


async def _get_db():
    """Lazy-load Firestore async client. Returns None if Firebase is disabled."""
    global _db
    if not USE_FIREBASE or DEMO_MODE:
        return None
    if _db is not None:
        return _db
    async with _db_lock:
        if _db is None:
            try:
                from google.cloud import firestore
                _db = firestore.AsyncClient()
                logger.info("Firestore AsyncClient initialized")
            except Exception as e:
                logger.warning(f"Firestore unavailable — using in-memory only: {e}")
                _db = None  # stay None; in-memory will handle it
    return _db


# ─── Session ──────────────────────────────────────────────────────────────────

async def save_session(session: SessionState) -> None:
    """Persist session to in-memory store (always) + Firestore (if available)."""
    data = session.model_dump(exclude={"raw_text", "chat_history"})
    # Always write to in-memory first — this is what get_session reads from
    _memory_sessions[session.session_id] = data

    # Best-effort Firestore persistence (for durability across restarts)
    db = await _get_db()
    if db is not None:
        try:
            doc_ref = db.collection("sessions").document(session.session_id)
            await doc_ref.set(data)
            logger.info(f"Saved session {session.session_id} to Firestore")
        except Exception as e:
            logger.warning(f"Firestore save failed (in-memory still works): {e}")


async def get_session(session_id: str) -> Optional[SessionState]:
    """Retrieve session from in-memory first, fall back to Firestore."""
    # Check in-memory first (fastest, always available)
    data = _memory_sessions.get(session_id)
    if data:
        data = dict(data)
        data.setdefault("raw_text", "")
        try:
            return SessionState(**data)
        except Exception as e:
            logger.warning(f"Failed to parse in-memory session {session_id}: {e}")

    # Fall back to Firestore (for sessions from previous server instances)
    db = await _get_db()
    if db is not None:
        try:
            doc_ref = db.collection("sessions").document(session_id)
            snap = await doc_ref.get()
            if snap.exists:
                data = snap.to_dict()
                data.setdefault("raw_text", "")
                session = SessionState(**data)
                # Re-populate in-memory so next call is fast
                _memory_sessions[session_id] = data
                return session
        except Exception as e:
            logger.warning(f"Firestore get failed for {session_id}: {e}")

    return None


async def update_risk_report(
    session_id: str,
    risk_report: list[RiskAnalysis],
    aggregation: AggregationResult,
    summary: dict,
) -> None:
    """Update risk report in in-memory store + Firestore."""
    if session_id in _memory_sessions:
        _memory_sessions[session_id]["risk_report"] = [
            r.model_dump() if hasattr(r, "model_dump") else r for r in risk_report
        ]
        agg_data = aggregation.model_dump() if hasattr(aggregation, "model_dump") else aggregation
        _memory_sessions[session_id]["aggregation"] = agg_data
        _memory_sessions[session_id]["summary"] = summary

    db = await _get_db()
    if db is not None:
        try:
            doc_ref = db.collection("sessions").document(session_id)
            await doc_ref.set({
                "risk_report": [
                    r.model_dump() if hasattr(r, "model_dump") else r for r in risk_report
                ],
                "aggregation": aggregation.model_dump() if hasattr(aggregation, "model_dump") else aggregation,
                "summary": summary,
            }, merge=True)
        except Exception as e:
            logger.warning(f"Firestore update failed (in-memory updated): {e}")


# ─── Chat History ─────────────────────────────────────────────────────────────

async def save_chat_message(session_id: str, role: str, content: str) -> None:
    """Append chat message to in-memory store + Firestore."""
    _memory_chat.setdefault(session_id, []).append({"role": role, "content": content})

    db = await _get_db()
    if db is not None:
        try:
            from google.cloud import firestore
            chat_ref = (
                db.collection("sessions")
                .document(session_id)
                .collection("chat")
            )
            await chat_ref.add(
                {"role": role, "content": content, "timestamp": firestore.SERVER_TIMESTAMP}
            )
        except Exception as e:
            logger.warning(f"Firestore chat save failed: {e}")


async def get_chat_history(session_id: str, limit: int = 20) -> list[dict]:
    """Retrieve chat history from in-memory store."""
    # In-memory is sufficient for chat history within a session
    history = _memory_chat.get(session_id, [])[-limit:]
    if history:
        return history

    # Try Firestore for history from previous instances
    db = await _get_db()
    if db is not None:
        try:
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
        except Exception as e:
            logger.warning(f"Firestore chat history failed: {e}")

    return []
