import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
_env = ROOT / ".env"
if _env.exists():  # tiny .env loader, no extra dependency
    for line in _env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip("\"'"))

JWT_SECRET = os.getenv("JWT_SECRET") or "dev-secret-change-me"
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS") or 24)

# Sign-up codes. Reviewer code has a default for easy demos; admin sign-up stays OFF until ADMIN_CODE is set.
TEACHER_CODE = os.getenv("TEACHER_CODE") or "teacher123"
ADMIN_CODE = os.getenv("ADMIN_CODE") or ""

MONGO_URL = os.getenv("MONGO_URL") or ""
MONGO_DB = os.getenv("MONGO_DB") or "idealens"

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY") or ""
LLM_MODEL = os.getenv("LLM_MODEL") or "claude-sonnet-5-5"
USE_EMBEDDINGS = (os.getenv("USE_EMBEDDINGS") or "0") == "1"

APP_URL = (os.getenv("APP_URL") or os.getenv("BASE_URL") or "http://localhost:8000").rstrip("/")
SMTP_HOST = os.getenv("SMTP_HOST") or ""
SMTP_PORT = int(os.getenv("SMTP_PORT") or 587)
SMTP_USER = os.getenv("SMTP_USER") or ""
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD") or os.getenv("SMTP_PASS") or ""
SMTP_FROM = os.getenv("SMTP_FROM") or SMTP_USER or "idealens@localhost"

RATE_LIMIT_ENABLED = (os.getenv("RATE_LIMIT") or "on").lower() not in ("off", "0", "false")

DATA_DIR = ROOT / "backend" / "data"
STORE_PATH = Path(os.getenv("STORE_PATH") or (DATA_DIR / "store.json"))
FRONTEND_DIR = ROOT / "frontend"
