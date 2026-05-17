import asyncio
import logging
from typing import Optional

import firebase_admin
from firebase_admin import credentials, storage

from config import FIREBASE_STORAGE_BUCKET, DEMO_MODE

logger = logging.getLogger(__name__)

_initialized = False


def _init_firebase():
    global _initialized
    if _initialized:
        return
    if DEMO_MODE:
        _initialized = True
        return
    try:
        firebase_admin.get_app()
    except ValueError:
        firebase_admin.initialize_app(
            options={"storageBucket": FIREBASE_STORAGE_BUCKET}
        )
    _initialized = True


async def upload_contract(
    session_id: str,
    filename: str,
    file_bytes: bytes,
    content_type: str = "application/pdf",
) -> str:
    """Upload a contract file to Firebase Storage (no-op in demo mode)."""
    if DEMO_MODE:
        logger.info("DEMO_MODE: skipping Firebase Storage upload")
        return f"demo://contracts/{session_id}/{filename}"

    _init_firebase()
    bucket = storage.bucket()
    blob = bucket.blob(f"contracts/{session_id}/{filename}")
    await asyncio.to_thread(blob.upload_from_string, file_bytes, content_type=content_type)
    await asyncio.to_thread(blob.make_public)
    logger.info(f"Uploaded contract to Firebase Storage: {blob.public_url}")
    return blob.public_url



async def upload_report(session_id: str, report_json: str) -> str:
    """
    Store a pre-generated JSON risk report in Firebase Storage.
    Used for demo mode cached reports.

    Returns:
        Public URL of the stored report.
    """
    _init_firebase()
    bucket = storage.bucket()
    blob = bucket.blob(f"reports/{session_id}/report.json")

    await asyncio.to_thread(
        blob.upload_from_string,
        report_json.encode("utf-8"),
        content_type="application/json",
    )
    await asyncio.to_thread(blob.make_public)
    return blob.public_url
