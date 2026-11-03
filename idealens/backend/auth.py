import hashlib, hmac, os, datetime as dt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from . import config

bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 120_000)
    return salt.hex() + "$" + h.hex()


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, h_hex = stored.split("$")
        h = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), 120_000)
        return hmac.compare_digest(h.hex(), h_hex)
    except Exception:
        return False


def make_token(user_id: str) -> str:
    exp = dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=config.JWT_EXPIRE_HOURS)
    return jwt.encode({"sub": user_id, "exp": exp}, config.JWT_SECRET, algorithm="HS256")


def decode_token(token: str):
    try:
        return jwt.decode(token, config.JWT_SECRET, algorithms=["HS256"]).get("sub")
    except Exception:
        return None


def current_user_factory(store):
    def current_user(cred: HTTPAuthorizationCredentials = Depends(bearer)):
        uid = decode_token(cred.credentials) if cred else None
        user = store.user_by_id(uid) if uid else None
        if not user:
            raise HTTPException(status_code=401, detail="Please log in again.")
        return user
    return current_user
