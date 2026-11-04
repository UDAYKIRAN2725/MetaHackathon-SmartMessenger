import hashlib
import re
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt

PHONE_DIGITS = re.compile(r"\D")


def norm_email(e: str) -> str:
    return e.strip().lower()


def norm_phone(p: str) -> str:
    return PHONE_DIGITS.sub("", p or "")


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except ValueError:
        return False


# Compared against when the user doesn't exist, so a missing account takes as long as a wrong password.
DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


def new_session_token() -> tuple[str, str]:
    """Returns (token for the cookie, sha256 hex for the DB)."""
    token = secrets.token_urlsafe(32)
    return token, token_hash(token)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def expiry(remember: bool, days: int, hours: int) -> datetime:
    return utcnow() + (timedelta(days=days) if remember else timedelta(hours=hours))
