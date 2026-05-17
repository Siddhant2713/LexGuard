import asyncio
import logging
from typing import Optional

from datetime import timedelta

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
    import google.auth
    import firebase_admin
    from firebase_admin import credentials

    try:
        firebase_admin.get_app()
    except ValueError:
        google_creds, project = google.auth.default()
        firebase_admin.initialize_app(
            credential=credentials.Certificate(google_creds) if hasattr(google_creds, 'service_account_email') else credentials.ApplicationDefault(),
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
    from firebase_admin import storage
    bucket = storage.bucket()
    blob = bucket.blob(f"contracts/{session_id}/{filename}")
    await asyncio.to_thread(blob.upload_from_string, file_bytes, content_type=content_type)
    
    signed_url = await asyncio.to_thread(
        blob.generate_signed_url,
        expiration=timedelta(hours=24),
        method="GET",
    )
    logger.info(f"Uploaded contract to Firebase Storage, signed URL generated.")
    return signed_url



async def upload_report(session_id: str, report_json: str) -> str:
    """
    Store a pre-generated JSON risk report in Firebase Storage.
    Used for demo mode cached reports.

    Returns:
        Public URL of the stored report.
    """
    _init_firebase()
    from firebase_admin import storage
    bucket = storage.bucket()
    blob = bucket.blob(f"reports/{session_id}/report.json")

    await asyncio.to_thread(
        blob.upload_from_string,
        report_json.encode("utf-8"),
        content_type="application/json",
    )
    
    signed_url = await asyncio.to_thread(
        blob.generate_signed_url,
        expiration=timedelta(hours=24),
        method="GET",
    )
    return signed_url
