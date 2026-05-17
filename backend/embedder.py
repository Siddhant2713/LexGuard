from __future__ import annotations  # Makes all type hints lazy — never evaluated at runtime

import logging
from sentence_transformers import SentenceTransformer
import chromadb

from config import EMBEDDING_MODEL, CHROMA_PERSIST_DIR, DEMO_MODE
from chunker import Chunk

logger = logging.getLogger(__name__)

# Lazy-load singleton model
_model = None  # type: SentenceTransformer | None

# ChromaDB persistent client (one instance for the process)
_chroma_client = None  # type: ignore



def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        logger.info(f"Loading embedding model: {EMBEDDING_MODEL}")
        _model = SentenceTransformer(EMBEDDING_MODEL)
    return _model


def _get_chroma() -> chromadb.PersistentClient:
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(
            path=CHROMA_PERSIST_DIR,
            settings=chromadb.Settings(anonymized_telemetry=False)
        )
    return _chroma_client


def build_index(session_id: str, chunks: list[Chunk]) -> None:
    """
    Embed all chunks and store them in a ChromaDB collection namespaced
    by session_id. Idempotent — safe to call multiple times.
    """
    if DEMO_MODE:
        logger.info("DEMO_MODE: skipping ChromaDB index build")
        return
    model = _get_model()
    client = _get_chroma()

    # Delete existing collection for this session if it exists
    try:
        client.delete_collection(name=session_id)
    except Exception:
        pass

    collection = client.create_collection(
        name=session_id,
        metadata={"hnsw:space": "cosine"},
    )

    texts = [f"{c.heading}\n{c.text}" for c in chunks]
    embeddings = model.encode(texts, normalize_embeddings=True).tolist()

    collection.add(
        documents=texts,
        embeddings=embeddings,
        ids=[c.id for c in chunks],
        metadatas=[
            {"heading": c.heading, "chunk_id": c.id, "page_ref": c.page_ref}
            for c in chunks
        ],
    )
    logger.info(f"Built ChromaDB index for session {session_id}: {len(chunks)} chunks")


def search_chunks(session_id: str, query: str, k: int = 3) -> list[dict]:
    """
    Search the ChromaDB collection for the given session.

    Returns:
        List of dicts with keys: heading, text, chunk_id
    """
    if DEMO_MODE:
        # Return mock chunks so chat grounding always has context
        from mock_data import MOCK_PASS1
        clauses = MOCK_PASS1.clauses[:k]
        return [
            {"heading": c.heading, "text": c.text, "chunk_id": c.id}
            for c in clauses
        ]
    model = _get_model()
    client = _get_chroma()

    try:
        collection = client.get_collection(name=session_id)
    except Exception:
        logger.warning(f"ChromaDB collection not found for session: {session_id}")
        return []

    q_emb = model.encode([query], normalize_embeddings=True).tolist()
    results = collection.query(
        query_embeddings=q_emb,
        n_results=min(k, collection.count()),
    )

    if not results["documents"] or not results["documents"][0]:
        return []

    return [
        {
            "heading": meta["heading"],
            "text": doc,
            "chunk_id": meta["chunk_id"],
        }
        for meta, doc in zip(
            results["metadatas"][0],
            results["documents"][0],
        )
    ]


def delete_index(session_id: str) -> None:
    """Remove ChromaDB collection for a session (cleanup)."""
    client = _get_chroma()
    try:
        client.delete_collection(name=session_id)
    except Exception:
        pass
