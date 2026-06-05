import asyncio
import json
import logging
import re

from config import (
    GROQ_API_KEY,
    GROQ_MODEL,
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

# Lazy-loaded client — avoids crash on import if key is invalid
_client = None


def _get_client():
    """Lazy-load Groq client. Raises clear error if key is missing."""
    global _client
    if _client is None:
        if DEMO_MODE:
            return None
        import groq
        if not GROQ_API_KEY or GROQ_API_KEY == "demo-key-not-used":
            raise ValueError(
                "GROQ_API_KEY is not set. Add it to backend/.env"
            )
        _client = groq.Groq(api_key=GROQ_API_KEY)
    return _client


def _strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    return text.strip()


def _clean_json(text: str) -> str:
    """Fix common Gemini JSON quirks before parsing."""
    text = _strip_fences(text)
    text = re.sub(r",\s*([}\]])", r"\1", text)
    return text.strip()


def _normalize_enum_fields(data: dict) -> dict:
    """
    Normalize enum values that Gemini might return in unexpected formats.
    e.g. 'non-compete' -> 'non_compete', 'HIGH' -> 'high'
    """
    if isinstance(data, dict):
        # Normalize category
        if "category" in data:
            cat = str(data["category"]).lower().replace("-", "_").replace(" ", "_")
            valid_cats = {"employment", "ip", "privacy", "liability", "arbitration",
                         "payment", "termination", "non_compete", "data", "other"}
            data["category"] = cat if cat in valid_cats else "other"

        # Normalize severity
        if "severity" in data:
            sev = str(data["severity"]).lower()
            valid_sevs = {"critical", "high", "medium", "low"}
            data["severity"] = sev if sev in valid_sevs else "medium"

        # Normalize overall_risk
        if "overall_risk" in data:
            sev = str(data["overall_risk"]).lower()
            valid_sevs = {"critical", "high", "medium", "low"}
            data["overall_risk"] = sev if sev in valid_sevs else "medium"

        # Recurse into lists
        if "clauses" in data and isinstance(data["clauses"], list):
            data["clauses"] = [_normalize_enum_fields(c) for c in data["clauses"]]

    return data


async def _call_groq(
    system: str,
    user: str,
    max_tokens: int,
) -> str:
    """Call Groq with retry on rate-limit (429) or transient errors."""
    client = _get_client()

    for attempt, delay in enumerate([0] + RETRY_DELAYS):
        if delay:
            logger.info(f"Waiting {delay}s before retry (attempt {attempt + 1})...")
            await asyncio.sleep(delay)
        try:
            response = await asyncio.to_thread(
                client.chat.completions.create,
                model=GROQ_MODEL,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=max_tokens,
            )
            cleaned_text = _clean_json(response.choices[0].message.content)
            logger.debug("Groq response (first 300 chars): %s", cleaned_text[:300])
            json.loads(cleaned_text)  # Validate JSON before returning
            return cleaned_text

        except Exception as e:
            err_str = str(e).lower()
            is_rate_limit = "429" in err_str or "quota" in err_str or "rate limit" in err_str
            is_server_error = "500" in err_str or "503" in err_str or "unavailable" in err_str
            is_json_error = isinstance(e, json.JSONDecodeError)
            is_network_error = "name resolution" in err_str or "connection" in err_str or "errno" in err_str
            is_retryable = is_rate_limit or is_server_error or is_json_error or is_network_error

            if is_retryable and attempt < len(RETRY_DELAYS):
                logger.warning(
                    f"Retryable Groq error ({type(e).__name__}: {str(e)[:100]}), "
                    f"retrying in {RETRY_DELAYS[attempt]}s..."
                )
                continue

            logger.error(f"Groq call failed (non-retryable): {e}")
            raise


# ─── Pass 1: Structural Extraction ───────────────────────────────────────────

async def run_pass1(raw_text: str) -> Pass1Result:
    if DEMO_MODE:
        from mock_data import MOCK_PASS1
        await asyncio.sleep(1.5)
        logger.info("DEMO_MODE: returning mock Pass 1 result")
        return MOCK_PASS1

    doc_text = raw_text[:MAX_CONTEXT_CHARS]
    raw_json = await _call_groq(
        system=PASS1_SYSTEM,
        user=PASS1_USER.format(document_text=doc_text),
        max_tokens=MAX_TOKENS_PASS1,
    )

    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError as e:
        logger.error(f"Pass 1 JSON parse error: {e}\nRaw: {raw_json[:500]}")
        raise ValueError(f"Pass 1 returned invalid JSON: {e}")

    data = _normalize_enum_fields(data)
    data["clauses"] = sorted(
        data.get("clauses", []),
        key=lambda x: x.get("suspicion_score", 0),
        reverse=True,
    )[:15]

    try:
        return Pass1Result(**data)
    except Exception as e:
        logger.error(f"Pass1Result validation failed: {e}\nData: {str(data)[:500]}")
        raise ValueError(f"Pass 1 schema validation failed: {e}")


# ─── Pass 2: Per-Clause Risk Analysis ────────────────────────────────────────

async def _analyze_single_clause(
    clause: dict,
    doc_type: str,
    semaphore: asyncio.Semaphore,
) -> RiskAnalysis | None:
    async with semaphore:
        try:
            raw_json = await _call_groq(
                system=PASS2_SYSTEM,
                user=PASS2_USER.format(
                    document_type=doc_type,
                    clause_id=clause["id"],
                    heading=clause["heading"],
                    category=clause.get("category", "other"),
                    clause_text=clause["text"],
                ),
                max_tokens=MAX_TOKENS_PASS2,
            )
            data = json.loads(raw_json)
            data = _normalize_enum_fields(data)
            return RiskAnalysis(**data)
        except Exception as e:
            logger.error(f"Pass 2 failed for clause {clause.get('id')}: {e}")
            return None


async def run_pass2(pass1_result: Pass1Result) -> list[RiskAnalysis]:
    if DEMO_MODE:
        from mock_data import MOCK_RISK_REPORT
        await asyncio.sleep(3.0)
        logger.info("DEMO_MODE: returning mock risk report")
        return MOCK_RISK_REPORT

    semaphore = asyncio.Semaphore(PASS2_CONCURRENCY)
    clauses = [c.model_dump() for c in pass1_result.clauses[:MAX_CLAUSES_PASS2]]

    tasks = [
        _analyze_single_clause(clause, pass1_result.document_type, semaphore)
        for clause in clauses
    ]
    results = await asyncio.gather(*tasks)
    valid = [r for r in results if r is not None]
    failed_count = len(results) - len(valid)

    if failed_count > 0:
        logger.error(f"Pass 2: {failed_count}/{len(results)} clause analyses failed")

    if not valid:
        raise ValueError(
            "All clause analyses failed. Check your GROQ_API_KEY and model quota. "
            "Try setting DEMO_MODE=true to test without an API key."
        )

    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    return sorted(valid, key=lambda x: severity_order.get(str(x.severity), 4))


# ─── Pass 3: Risk Aggregation ─────────────────────────────────────────────────

async def run_aggregation(
    risk_report: list[RiskAnalysis],
    doc_type: str,
) -> AggregationResult:
    if DEMO_MODE:
        from mock_data import MOCK_AGGREGATION
        await asyncio.sleep(0.5)
        logger.info("DEMO_MODE: returning mock aggregation")
        return MOCK_AGGREGATION

    clauses_summary = [
        {
            "severity": str(r.severity),
            "risk_type": r.risk_type,
            "affects": r.affects,
            "plain_english": r.plain_english,
        }
        for r in risk_report
    ]

    raw_json = await _call_groq(
        system=AGGREGATION_SYSTEM,
        user=AGGREGATION_USER.format(
            document_type=doc_type,
            clauses_json=json.dumps(clauses_summary, indent=2),
        ),
        max_tokens=MAX_TOKENS_AGGREGATION,
    )

    try:
        data = json.loads(raw_json)
        data = _normalize_enum_fields(data)
    except json.JSONDecodeError as e:
        logger.error(f"Aggregation JSON parse error: {e}")
        raise ValueError(f"Aggregation returned invalid JSON: {e}")

    try:
        return AggregationResult(**data)
    except Exception as e:
        logger.error(f"AggregationResult validation failed: {e}")
        raise ValueError(f"Aggregation schema validation failed: {e}")
