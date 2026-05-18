import asyncio
import logging
from typing import Optional

from config import FIREBASE_STORAGE_BUCKET, DEMO_MODE, USE_FIREBASE

logger = logging.getLogger(__name__)

_initialized = False


def _init_firebase():
    global _initialized
    if _initialized:
        return
    if DEMO_MODE or not USE_FIREBASE or not FIREBASE_STORAGE_BUCKET:
        _initialized = True
        return
    import firebase_admin
    from firebase_admin import credentials
    try:
        firebase_admin.get_app()
    except ValueError:
        firebase_admin.initialize_app(
            credential=credentials.ApplicationDefault(),
            options={"storageBucket": FIREBASE_STORAGE_BUCKET}
        )
    _initialized = True


async def upload_contract(
    session_id: str,
    filename: str,
    file_bytes: bytes,
    content_type: str = "application/pdf",
) -> Optional[str]:
    """
    Upload contract to Firebase Storage.
    Returns None if Firebase is not configured — upload still succeeds,
    the file just isn't persisted to cloud storage.
    """
    if DEMO_MODE:
        return f"demo://contracts/{session_id}/{filename}"

    if not USE_FIREBASE or not FIREBASE_STORAGE_BUCKET:
        logger.info("Firebase Storage not configured — skipping upload")
        return None

    try:
        _init_firebase()
        from firebase_admin import storage
        bucket = storage.bucket()
        blob = bucket.blob(f"contracts/{session_id}/{filename}")
        await asyncio.to_thread(blob.upload_from_string, file_bytes, content_type=content_type)

        # Use public URL instead of signed URL — avoids iam.serviceAccounts.signBlob requirement.
        # If your bucket has uniform bucket-level access, use signed URLs with a service account key.
        # For development: make the blob public after upload.
        try:
            await asyncio.to_thread(blob.make_public)
            url = blob.public_url
        except Exception:
            # If make_public fails (bucket policy blocks it), return the GCS URI
            url = f"gs://{FIREBASE_STORAGE_BUCKET}/contracts/{session_id}/{filename}"

        logger.info(f"Uploaded contract to Firebase Storage: {session_id}/{filename}")
        return url

    except Exception as e:
        logger.warning(f"Firebase Storage upload failed (non-fatal): {e}")
        return None
