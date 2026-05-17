import os
from dotenv import load_dotenv

load_dotenv()

# --- Demo Mode ---
# Set DEMO_MODE=true to bypass all Gemini/Firebase calls.
# Returns realistic hardcoded data. No API key required.
DEMO_MODE: bool = os.environ.get("DEMO_MODE", "false").lower() == "true"

ALLOWED_ORIGINS: list[str] = os.environ.get(
    "ALLOWED_ORIGINS", "http://localhost:3000"
).split(",")

# --- AI ---
# Not required when DEMO_MODE=true
_raw_key = os.environ.get("GEMINI_API_KEY", "")
if not DEMO_MODE and not _raw_key:
    raise EnvironmentError(
        "GEMINI_API_KEY is required when DEMO_MODE=false. "
        "Set it in backend/.env or as an environment variable."
    )
GEMINI_API_KEY: str = _raw_key or "demo-key-not-used"
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_CHAT_MODEL = "gemini-2.5-flash"

# --- Token Limits ---
MAX_TOKENS_PASS1 = 4096
MAX_TOKENS_PASS2 = 1024
MAX_TOKENS_AGGREGATION = 1024
MAX_TOKENS_CHAT = 1024

# --- Pipeline ---
MAX_CLAUSES_PASS2 = 10
PASS2_CONCURRENCY = 5
FAISS_TOP_K = 3
# Cap characters to prevent massive payloads. Gemini 1.5+ supports 1M+ tokens, 
# but 100k chars is enough for typical contracts and prevents memory spikes.
MAX_CONTEXT_CHARS = 100_000

# --- Embeddings ---
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

# --- ChromaDB ---
# /app/chroma_data is the Docker path; fall back to a local dir when running outside Docker
_here = os.path.dirname(os.path.abspath(__file__))
CHROMA_PERSIST_DIR = os.environ.get("CHROMA_PERSIST_DIR", os.path.join(_here, "chroma_data"))
os.environ["ANONYMIZED_TELEMETRY"] = "False"
os.environ["CHROMA_TELEMETRY"] = "False"

# --- Retry ---
RETRY_DELAYS = [1, 2, 4]  # seconds — exponential backoff on 429

# --- Firebase ---
FIREBASE_STORAGE_BUCKET = os.environ.get("FIREBASE_STORAGE_BUCKET", "")
GOOGLE_CLOUD_PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT", "")
