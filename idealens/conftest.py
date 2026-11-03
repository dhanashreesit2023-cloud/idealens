"""pytest setup: use a throw-away database and predictable settings BEFORE the app is imported."""
import os, tempfile

os.environ["STORE_PATH"] = os.path.join(tempfile.mkdtemp(), "store.json")
os.environ.update({"RATE_LIMIT": "off", "MONGO_URL": "", "ANTHROPIC_API_KEY": "", "SMTP_HOST": "",
                   "TEACHER_CODE": "teach-test", "ADMIN_CODE": "adm-test", "USE_EMBEDDINGS": "0"})
