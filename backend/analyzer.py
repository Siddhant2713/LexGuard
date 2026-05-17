import asyncio
import json
import time
import logging

from google import genai
from google.genai import types

from config import (
    GEMINI_API_KEY,
    GEMINI_MODEL,
    DEMO_MODE,
    MAX_TOKENS_PASS1,
    MAX_TOKENS_PASS2,
    MAX_TOKENS_AGGREGATION,
    MAX_CLAUSES_PASS2,
    PASS2_CONCURRENCY,
    MAX_CONTEXT_CHARS,
    RETRY_DELAYS,
)
from prompts.v1.pass1 import PASS1_SYSTEM, PASS1_USER
from prompts.v1.pass2 import PASS2_SYSTEM, PASS2_USER
from prompts.v1.aggregation import AGGREGATION_SYSTEM, AGGREGATION_USER
from schemas import Pass1Result, RiskAnalysis, AggregationResult

logger = logging.getLogger(__name__)

# Only initialise the real client when not in demo mode
_client = None if DEMO_MODE else genai.Client(api_key=GEMINI_API_KEY)



def _json_config(max_tokens: int) -> types.GenerateContentConfig:
    return types.GenerateContentConfig(
        response_mime_type="application/json",
        temperature=0.1,
        max_output_tokens=max_tokens,
    )


def _strip_fences(text: str) -> str:
    """Remove markdown code fences if Gemini adds them despite JSON mode."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    return text.strip()


def _clean_json(text: str) -> str:
    """Fix common Gemini JSON quirks before parsing.
    - Strips markdown fences
    - Removes trailing commas before } or ] (invalid in strict JSON)
    """
    import re
    text = _strip_fences(text)
    # Remove trailing commas: ,<whitespace>} or ,<whitespace>]
    text = re.sub(r",\s*([}\]])", r"\1", text)
    return text


from typing import Any

async def _call_gemini(
    system: str,
    user: str,
    max_tokens: int,
    response_schema: Any = None,
) -> str:
    """
    Call Gemini with retry on rate-limit (429) or JSON parse errors.
    Runs synchronous SDK in a thread to avoid blocking the event loop.
    """
    for attempt, delay in enumerate([0] + RETRY_DELAYS):
        if delay:
            await asyncio.sleep(delay)
        try:
            response = await asyncio.to_thread(
                _client.models.generate_content,
                model=GEMINI_MODEL,
                contents=user,
                config=types.GenerateContentConfig(
                    system_instruction=system,
                    response_mime_type="application/json",
                    response_schema=response_schema,
                    temperature=0.1,
                    max_output_tokens=max_tokens,
                    safety_settings=[
                        types.SafetySetting(
                            category=types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                            threshold=types.HarmBlockThreshold.BLOCK_NONE,
                        ),
                        types.SafetySetting(
                            category=types.HarmCategory.HARM_CATEGORY_HARASSMENT,
                            threshold=types.HarmBlockThreshold.BLOCK_NONE,
                        ),
                        types.SafetySetting(
                            category=types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                            threshold=types.HarmBlockThreshold.BLOCK_NONE,
                        ),
                        types.SafetySetting(
                            category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                            threshold=types.HarmBlockThreshold.BLOCK_NONE,
                        ),
                    ],
                ),
            )
            cleaned_text = _clean_json(response.text)
            
            with open("debug_gemini.txt", "w") as f:
                f.write(cleaned_text)
                
            # Validate JSON before returning to trigger retry if malformed
            json.loads(cleaned_text)
            return cleaned_text
        except Exception as e:
            err_str = str(e).lower()
            is_rate_limit = "429" in err_str or "quota" in err_str or "resource exhausted" in err_str
            is_json_error = isinstance(e, json.JSONDecodeError)
            if (is_rate_limit or is_json_error) and attempt < len(RETRY_DELAYS):
                logger.warning(f"Gemini error ({type(e).__name__}), retrying in {RETRY_DELAYS[attempt]}s...")
                continue
            raise


# ─── Pass 1: Structural Extraction ───────────────────────────────────────────

async def run_pass1(raw_text: str) -> Pass1Result:
    """
    Send the full document to Gemini for structural clause extraction.
    Returns a sorted list of up to 15 clauses ranked by suspicion score.
    """
    if DEMO_MODE:
        from mock_data import MOCK_PASS1
        await asyncio.sleep(1.5)  # Simulate processing time
        logger.info("DEMO_MODE: returning mock Pass 1 result")
        return MOCK_PASS1

    doc_text = raw_text[:MAX_CONTEXT_CHARS]
    raw_json = await _call_gemini(
        system=PASS1_SYSTEM,
        user=PASS1_USER.format(document_text=doc_text),
        max_tokens=MAX_TOKENS_PASS1,
        response_schema=Pass1Result,
    )

    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError as e:
        logger.error(f"Pass 1 JSON parse error: {e}\nRaw: {raw_json[:500]}")
        raise ValueError(f"Pass 1 returned invalid JSON: {e}")

    # Sort descending by suspicion_score, cap at 15
    data["clauses"] = sorted(
        data.get("clauses", []),
        key=lambda x: x.get("suspicion_score", 0),
        reverse=True,
    )[:15]

    return Pass1Result(**data)


# ─── Pass 2: Per-Clause Risk Analysis ────────────────────────────────────────

async def _analyze_single_clause(
    clause: dict,
    doc_type: str,
    semaphore: asyncio.Semaphore,
) -> RiskAnalysis | None:
    """Analyze a single clause under the concurrency semaphore."""
    async with semaphore:
        try:
            raw_json = await _call_gemini(
                system=PASS2_SYSTEM,
                user=PASS2_USER.format(
                    document_type=doc_type,
                    clause_id=clause["id"],
                    heading=clause["heading"],
                    category=clause["category"],
                    clause_text=clause["text"],
                ),
                max_tokens=MAX_TOKENS_PASS2,
                response_schema=RiskAnalysis,
            )
            data = json.loads(raw_json)
            return RiskAnalysis(**data)
        except Exception as e:
            logger.error(f"Pass 2 failed for clause {clause.get('id')}: {e}")
            return None


async def run_pass2(pass1_result: Pass1Result) -> list[RiskAnalysis]:
    """
    Run Pass 2 on the top N clauses concurrently (semaphore-limited).
    Returns results sorted by severity weight.
    """
    if DEMO_MODE:
        from mock_data import MOCK_RISK_REPORT
        await asyncio.sleep(3.0)  # Simulate analysis time for progress UX
        logger.info("DEMO_MODE: returning mock risk report")
        return MOCK_RISK_REPORT

    semaphore = asyncio.Semaphore(PASS2_CONCURRENCY)
    clauses = [c.model_dump() for c in pass1_result.clauses[:MAX_CLAUSES_PASS2]]

    tasks = [
        _analyze_single_clause(clause, pass1_result.document_type, semaphore)
        for clause in clauses
    ]
    results = await asyncio.gather(*tasks)

    # Filter out failed analyses
    valid = [r for r in results if r is not None]

    # Sort by severity weight
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    return sorted(valid, key=lambda x: severity_order.get(x.severity, 4))


# ─── Pass 3: Risk Aggregation ─────────────────────────────────────────────────

async def run_aggregation(
    risk_report: list[RiskAnalysis],
    doc_type: str,
) -> AggregationResult:
    """
    Produce an overall contract risk profile from the full risk report.
    """
    if DEMO_MODE:
        from mock_data import MOCK_AGGREGATION
        await asyncio.sleep(0.5)
        logger.info("DEMO_MODE: returning mock aggregation")
        return MOCK_AGGREGATION
    clauses_summary = [
        {
            "severity": r.severity,
            "risk_type": r.risk_type,
            "affects": r.affects,
            "plain_english": r.plain_english,
        }
        for r in risk_report
    ]

    raw_json = await _call_gemini(
        system=AGGREGATION_SYSTEM,
        user=AGGREGATION_USER.format(
            document_type=doc_type,
            clauses_json=json.dumps(clauses_summary, indent=2),
        ),
        max_tokens=MAX_TOKENS_AGGREGATION,
        response_schema=AggregationResult,
    )

    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError as e:
        logger.error(f"Aggregation JSON parse error: {e}")
        raise ValueError(f"Aggregation returned invalid JSON: {e}")

    return AggregationResult(**data)
