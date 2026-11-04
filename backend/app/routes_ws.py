import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from .db import SessionLocal
from .deps import redis, ws_user
from .main_origins import origin_allowed
from .realtime import channel
from .routes_chats import mark_delivered

router = APIRouter()


@router.websocket("/api/ws")
async def ws_endpoint(ws: WebSocket):
    # Browsers send cookies on cross-site WebSockets too, so check Origin (CSWSH protection).
    if not origin_allowed(ws.headers.get("origin")):
        await ws.close(code=1008)
        return
    async with SessionLocal() as db:
        user = await ws_user(ws, db)
    if not user:
        await ws.close(code=1008)
        return
    await ws.accept()

    pubsub = redis.pubsub()
    await pubsub.subscribe(channel(user.id))

    async def forward():
        async for msg in pubsub.listen():
            if msg["type"] == "message":
                await ws.send_text(msg["data"])

    async def receive():
        while True:
            data = await ws.receive_text()
            try:
                evt = json.loads(data)
            except ValueError:
                continue
            if evt.get("type") == "ack":  # client got message.new -> mark delivered
                ids = [i for i in evt.get("ids", []) if isinstance(i, int)]
                if ids:
                    async with SessionLocal() as db:
                        await mark_delivered(db, user.id, ids)
            elif evt.get("type") == "ping":
                await ws.send_text('{"type":"pong"}')

    tasks = [asyncio.create_task(forward()), asyncio.create_task(receive())]
    try:
        await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    except WebSocketDisconnect:
        pass
    finally:
        for t in tasks:
            t.cancel()
        await pubsub.unsubscribe()
        await pubsub.aclose()
