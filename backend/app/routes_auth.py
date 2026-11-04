import re

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import delete, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from .config import settings
from .db import get_db
from .deps import current_user, redis
from .models import AuthSession, User
from .security import (
    DUMMY_HASH, expiry, hash_password, new_session_token, norm_email, norm_phone, token_hash, verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(max_length=25)
    password: str = Field(min_length=8, max_length=72)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = " ".join(v.split())
        if len(v) < 2:
            raise ValueError("Enter your full name.")
        return v

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        d = norm_phone(v)
        if not 10 <= len(d) <= 15:
            raise ValueError("Enter a valid phone number (10–15 digits).")
        return d

    @field_validator("password")
    @classmethod
    def _password(cls, v: str) -> str:
        if len(v.encode()) > 72:
            raise ValueError("Password is too long.")
        classes = sum([bool(re.search(r"[a-z]", v) and re.search(r"[A-Z]", v)), bool(re.search(r"\d", v)),
                       bool(re.search(r"[^A-Za-z0-9]", v))])
        if classes < 1:
            raise ValueError("Add upper and lower case letters, a number or a symbol.")
        return v


class LoginIn(BaseModel):
    identifier: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=200)
    remember: bool = True


def user_out(u: User) -> dict:
    return {"id": str(u.id), "name": u.name, "email": u.email, "phone": u.phone, "created_at": u.created_at}


async def _start_session(db: AsyncSession, resp: Response, user: User, remember: bool) -> None:
    token, hashed = new_session_token()
    db.add(AuthSession(token_hash=hashed, user_id=user.id,
                       expires_at=expiry(remember, settings.session_days, settings.session_hours_short)))
    await db.commit()
    resp.set_cookie(
        settings.session_cookie, token,
        httponly=True, samesite="lax", secure=settings.cookie_secure, path="/",
        max_age=settings.session_days * 86400 if remember else None,
    )


@router.post("/register", status_code=201)
async def register(body: RegisterIn, resp: Response, db: AsyncSession = Depends(get_db)):
    email = norm_email(body.email)
    clash = (await db.execute(select(User.email, User.phone).where(or_(User.email == email, User.phone == body.phone)))).first()
    if clash:
        field = "email" if clash.email == email else "phone number"
        raise HTTPException(409, f"An account with this {field} already exists.")
    user = User(name=body.name, email=email, phone=body.phone, password_hash=hash_password(body.password))
    db.add(user)
    try:
        await db.flush()
    except IntegrityError:
        raise HTTPException(409, "An account with this email or phone number already exists.")
    await _start_session(db, resp, user, remember=True)
    return user_out(user)


@router.post("/login")
async def login(body: LoginIn, request: Request, resp: Response, db: AsyncSession = Depends(get_db)):
    ident = body.identifier.strip()
    by_email = "@" in ident
    key = norm_email(ident) if by_email else norm_phone(ident)
    fail_key = f"loginfail:{key}"
    if int(await redis.get(fail_key) or 0) >= settings.login_max_failures:
        raise HTTPException(429, "Too many failed attempts. Try again in 15 minutes.")

    user = (await db.execute(select(User).where(User.email == key if by_email else User.phone == key))).scalar_one_or_none()
    ok = verify_password(body.password, user.password_hash if user else DUMMY_HASH) and user is not None
    if not ok:
        n = await redis.incr(fail_key)
        if n == 1:
            await redis.expire(fail_key, settings.login_lock_seconds)
        # Same message for unknown account and wrong password, so accounts can't be probed.
        raise HTTPException(401, "Email/phone or password is incorrect.")

    await redis.delete(fail_key)
    await _start_session(db, resp, user, body.remember)
    return user_out(user)


@router.post("/logout", status_code=204)
async def logout(request: Request, resp: Response, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get(settings.session_cookie)
    if token:
        await db.execute(delete(AuthSession).where(AuthSession.token_hash == token_hash(token)))
        await db.commit()
    resp.delete_cookie(settings.session_cookie, path="/")


@router.get("/me")
async def me(user: User = Depends(current_user)):
    return user_out(user)
