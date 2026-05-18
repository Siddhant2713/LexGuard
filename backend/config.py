import os
from dotenv import load_dotenv

load_dotenv()

# --- Demo Mode ---
# Set DEMO_MODE=true to bypass all Gemini/Firebase calls.
# Returns realistic hardcoded data. No API key required.
DEMO_MODE: bool = os.environ.get("DEMO_MODE", "false").lower() == "true"

# --- Firebase optional ---
# Set USE_FIREBASE=false to skip all Firestore/Storage calls and use in-memory sessions.
# This lets you run the full app with only a Gemini API key.
USE_FIREBASE: bool = os.environ.get("USE_FIREBASE", "true").lower() == "true"

ALLOWED_ORIGINS: list[str] = os.environ.get(
    "ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001"
).split(",")

# --- AI ---
_raw_key = os.environ.get("GEMINI_API_KEY", "")
if not DEMO_MODE and not _raw_key:
    raise EnvironmentError(
        "GEMINI_API_KEY is required when DEMO_MODE=false. "
        "Set it in backend/.env"
    )
GEMINI_API_KEY: str = _raw_key or "demo-key-not-used"

# gemini-2.5-flash is the correct GA model name as of 2025.
# If you get a 404 model error, try: gemini-1.5-flash (always available on free tier)
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_CHAT_MODEL = os.environ.get("GEMINI_CHAT_MODEL", "gemini-2.5-flash")

# --- Token Limits ---
MAX_TOKENS_PASS1 = 4096
MAX_TOKENS_PASS2 = 1024
MAX_TOKENS_AGGREGATION = 1024
MAX_TOKENS_CHAT = 1024

# --- Pipeline ---
MAX_CLAUSES_PASS2 = 10

# FREE TIER: gemini-2.5-flash allows ~10 RPM on free tier.
# Running 5 concurrent Pass 2 calls for 10 clauses will hit this limit.
# Set PASS2_CONCURRENCY=2 for free tier. Set to 5 only if on paid tier.
PASS2_CONCURRENCY = int(os.environ.get("PASS2_CONCURRENCY", "2"))

FAISS_TOP_K = 3
# Cap at 100k chars — enough for ~120 page contracts without memory spikes.
MAX_CONTEXT_CHARS = 100_000

# --- Embeddings ---
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

# --- ChromaDB ---
_here = os.path.dirname(os.path.abspath(__file__))
CHROMA_PERSIST_DIR = os.environ.get("CHROMA_PERSIST_DIR", os.path.join(_here, "chroma_data"))
os.environ["ANONYMIZED_TELEMETRY"] = "False"
os.environ["CHROMA_TELEMETRY"] = "False"

# --- Retry ---
# Increase delays for free tier rate limiting
RETRY_DELAYS = [5, 15, 30]  # seconds — longer backoff for free tier 429s

# --- Firebase ---
FIREBASE_STORAGE_BUCKET = os.environ.get("FIREBASE_STORAGE_BUCKET", "")
GOOGLE_CLOUD_PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT", "")
