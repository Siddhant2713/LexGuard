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
_raw_key = os.environ.get("GROQ_API_KEY", "")
if not DEMO_MODE and not _raw_key:
    raise EnvironmentError(
        "GROQ_API_KEY is required when DEMO_MODE=false. "
        "Get a free key at https://console.groq.com and set it in backend/.env"
    )
GROQ_API_KEY: str = _raw_key or "demo-key-not-used"

# Analysis passes — best JSON accuracy on free tier (~30 RPM)
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
# Chat streaming — fastest token output, sufficient for RAG chat
GROQ_CHAT_MODEL = os.environ.get("GROQ_CHAT_MODEL", "llama-3.1-8b-instant")

# --- Token Limits ---
MAX_TOKENS_PASS1 = 4096
MAX_TOKENS_PASS2 = 1024
MAX_TOKENS_AGGREGATION = 1024
MAX_TOKENS_CHAT = 1024

# --- Pipeline ---
MAX_CLAUSES_PASS2 = 10

# Groq free tier: ~30 RPM. PASS2_CONCURRENCY=3 is safe; raise to 5 on paid tier.
PASS2_CONCURRENCY = int(os.environ.get("PASS2_CONCURRENCY", "3"))

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
RETRY_DELAYS = [5, 15, 30]  # seconds

# --- Firebase ---
FIREBASE_STORAGE_BUCKET = os.environ.get("FIREBASE_STORAGE_BUCKET", "")
GOOGLE_CLOUD_PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT", "")
