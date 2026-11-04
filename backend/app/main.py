import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import text

from . import scheduler
from .config import settings
from .db import SessionLocal, create_tables
from .deps import redis
from .main_origins import origin_allowed
from .routes_assist import router as assist_router
from .routes_auth import router as auth_router
from .routes_chats import router as chats_router
from .routes_pa import router as pa_router
from .routes_rank import router as rank_router
from .routes_memory import router as memory_router
from .routes_ws import router as ws_router

logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(name)s %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    await create_tables()
    stop = asyncio.Event()
    worker = asyncio.create_task(scheduler.run(stop)) if settings.run_scheduler else None
    yield
    stop.set()
    if worker:
        await worker
    await redis.aclose()


app = FastAPI(title="Smart Messenger API", version="0.3.0", lifespan=lifespan)


@app.middleware("http")
async def check_origin(request: Request, call_next):
    # CSRF defence on top of SameSite=Lax cookies: state-changing requests must come from our frontend.
    if request.method not in ("GET", "HEAD", "OPTIONS") and not origin_allowed(request.headers.get("origin")):
        return JSONResponse({"detail": "Origin not allowed."}, status_code=403)
    return await call_next(request)


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    # Return the first problem as a plain sentence the UI can show.
    err = exc.errors()[0] if exc.errors() else {}
    msg = str(err.get("msg", "Invalid input.")).removeprefix("Value error, ")
    field = err.get("loc", [None])[-1]
    return JSONResponse({"detail": msg, "field": field}, status_code=422)


@app.get("/api/health")
async def health():
    async with SessionLocal() as db:
        await db.execute(text("select 1"))
    await redis.ping()
    return {"ok": True}


app.include_router(auth_router)
app.include_router(chats_router)
app.include_router(assist_router)
app.include_router(pa_router)
app.include_router(rank_router)
app.include_router(memory_router)
app.include_router(ws_router)
