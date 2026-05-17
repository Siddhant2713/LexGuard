import asyncio
import logging
from typing import AsyncGenerator

from google import genai
from google.genai import types

from config import GEMINI_API_KEY, GEMINI_CHAT_MODEL, MAX_TOKENS_CHAT, FAISS_TOP_K, DEMO_MODE
from prompts.v1.chat import CHAT_SYSTEM, CHAT_USER
from embedder import search_chunks

logger = logging.getLogger(__name__)

_client = None if DEMO_MODE else genai.Client(api_key=GEMINI_API_KEY)


def _build_context(chunks: list[dict]) -> str:
    """Format retrieved chunks into a numbered context block."""
    parts = []
    for i, chunk in enumerate(chunks, 1):
        parts.append(f"[Excerpt {i} — {chunk['heading']}]\n{chunk['text']}")
    return "\n\n---\n\n".join(parts)


async def stream_chat(
    query: str,
    session_id: str,
) -> AsyncGenerator[str, None]:
    """
    Retrieve relevant chunks from ChromaDB, build a grounded prompt,
    and stream the Gemini response as SSE tokens.
    """
    if DEMO_MODE:
        # Simulate a realistic streamed response without calling Gemini
        mock_response = (
            f"Based on the contract, here is what I can tell you about your question.\n\n"
            f"The agreement contains a clause [[CLAUSE:clause_01:Intellectual Property Assignment]] "
            f"that broadly assigns all inventions to the employer, including work done on personal time. "
            f"This is one of the most aggressive clauses in this agreement.\n\n"
            f"Additionally, [[CLAUSE:clause_02:Non-Compete Restriction]] prevents you from working "
            f"for competitors for 24 months globally after leaving.\n\n"
            f"Consider consulting a qualified lawyer before signing."
        )
        # Stream word by word to simulate real token streaming
        words = mock_response.split(" ")
        for word in words:
            await asyncio.sleep(0.04)
            yield f"data: {word} \n\n"
        yield "data: [DONE]\n\n"
        return

    # Retrieve top-k relevant chunks from ChromaDB
    top_chunks = search_chunks(session_id=session_id, query=query, k=FAISS_TOP_K)

    if not top_chunks:
        yield "data: This specific point isn't addressed in the sections I can retrieve from your contract.\n\n"
        yield "data: [DONE]\n\n"
        return

    retrieved_context = _build_context(top_chunks)
    system_prompt = CHAT_SYSTEM.format(retrieved_context=retrieved_context)

    try:
        # Run streaming in a thread (google-genai is synchronous)
        response_iter = await asyncio.to_thread(
            lambda: _client.models.generate_content_stream(
                model=GEMINI_CHAT_MODEL,
                contents=CHAT_USER.format(query=query),
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.2,
                    max_output_tokens=MAX_TOKENS_CHAT,
                ),
            )
        )

        for chunk in response_iter:
            if chunk.text:
                # Escape newlines for SSE format
                safe_text = chunk.text.replace("\n", "\\n")
                yield f"data: {safe_text}\n\n"

    except Exception as e:
        logger.error(f"Chat streaming error for session {session_id}: {e}")
        yield "data: An error occurred while processing your question. Please try again.\n\n"

    yield "data: [DONE]\n\n"
