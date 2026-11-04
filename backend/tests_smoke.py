"""End-to-end smoke test against a running backend (uvicorn on :8000) with seeded demo data.

    python -m app.seed --reset
    python tests_smoke.py
"""
import asyncio
import json

import httpx
import websockets

BASE = "http://127.0.0.1:8000"
ORIGIN = {"Origin": "http://localhost:5173"}


def check(label, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + label, extra)
    if not cond:
        raise SystemExit(1)


async def login(c, ident, pw="Demo@12345"):
    r = await c.post("/api/auth/login", json={"identifier": ident, "password": pw}, headers=ORIGIN)
    return r


async def main():
    async with httpx.AsyncClient(base_url=BASE) as uday, httpx.AsyncClient(base_url=BASE) as priya, \
            httpx.AsyncClient(base_url=BASE) as anon:
        check("health", (await anon.get("/api/health")).json()["ok"])
        check("me without login -> 401", (await anon.get("/api/auth/me")).status_code == 401)
        r = await login(anon, "uday@demo.com", "wrong")
        check("wrong password -> 401 generic", r.status_code == 401 and "incorrect" in r.json()["detail"])
        r = await anon.post("/api/auth/login", json={"identifier": "uday@demo.com", "password": "x"},
                            headers={"Origin": "https://evil.example"})
        check("foreign Origin -> 403", r.status_code == 403)
        r = await anon.post("/api/auth/register", headers=ORIGIN,
                            json={"name": "X", "email": "bad", "phone": "1", "password": "short"})
        check("register validation -> 422", r.status_code == 422, r.json())
        r = await anon.post("/api/auth/register", headers=ORIGIN,
                            json={"name": "Dup", "email": "UDAY@demo.com", "phone": "9111111111", "password": "Secret123!"})
        check("duplicate email -> 409", r.status_code == 409, r.json()["detail"])

        check("uday login", (await login(uday, "uday@demo.com")).status_code == 200)
        check("cookie is HttpOnly", "httponly" in (await login(uday, "+91 90000-00001")).headers["set-cookie"].lower())
        check("priya login", (await login(priya, "priya@demo.com")).status_code == 200)

        data = (await uday.get("/api/conversations")).json()
        items = data["items"]
        print("   smart order:", [(i["partner"]["name"], i["unread"], i["stats"]["score"]) for i in items])
        check("unread first", all(i["unread"] for i in items[:6]) and not any(i["unread"] for i in items[7:]))
        pr = next(i for i in items if i["partner"]["name"] == "Priya Sharma")
        check("priya score ~87", 80 <= pr["stats"]["score"] <= 92, pr["stats"])
        ext = next(i for i in items if i["partner"]["name"] == "XYZ Realty")
        check("stranger unscored + external", ext["stats"]["score"] is None and ext["category"] == "ext")
        recent = (await uday.get("/api/conversations?sort=recent")).json()["items"]
        check("recent order newest first", recent[0]["partner"]["name"] == "Priya Sharma", recent[0]["partner"]["name"])

        conv = pr["id"]
        msgs = (await uday.get(f"/api/conversations/{conv}/messages?limit=4")).json()
        check("message paging", len(msgs["items"]) == 4 and msgs["has_more"], msgs["items"][-1]["text"])

        # Live: Priya listens on WebSocket, Uday sends.
        cookie = priya.cookies.get("sm_session")
        async with websockets.connect("ws://127.0.0.1:8000/api/ws", origin="http://localhost:5173",
                                      additional_headers={"Cookie": f"sm_session={cookie}"}) as ws:
            await asyncio.sleep(0.3)
            sent = (await uday.post(f"/api/conversations/{conv}/messages", json={"text": "Sending the Q3 report now."},
                                    headers=ORIGIN)).json()
            evt = json.loads(await asyncio.wait_for(ws.recv(), 5))
            check("priya gets message.new live", evt["type"] == "message.new" and evt["message"]["text"] == sent["text"])
            await ws.send(json.dumps({"type": "ack", "ids": [sent["id"]]}))
            await asyncio.sleep(0.5)
            m = (await uday.get(f"/api/conversations/{conv}/messages?limit=1")).json()["items"][0]
            check("delivered_at set after ack", m["delivered_at"] is not None and m["read_at"] is None)
            r = (await priya.post(f"/api/conversations/{conv}/read", headers=ORIGIN)).json()
            check("priya marks read", sent["id"] in r["ids"])

        try:
            async with websockets.connect("ws://127.0.0.1:8000/api/ws", origin="https://evil.example",
                                          additional_headers={"Cookie": f"sm_session={cookie}"}) as ws:
                await ws.recv()
            check("ws foreign origin rejected", False)
        except Exception:
            check("ws foreign origin rejected", True)

        m = (await uday.get(f"/api/conversations/{conv}/messages?limit=1")).json()["items"][0]
        check("uday sees read_at", m["read_at"] is not None)

        # Uday reads Priya's chat -> unread drops to 0
        await uday.post(f"/api/conversations/{conv}/read", headers=ORIGIN)
        pr2 = next(i for i in (await uday.get("/api/conversations")).json()["items"] if i["id"] == conv)
        check("unread cleared", pr2["unread"] == 0)

        hb1 = (await uday.post(f"/api/conversations/{conv}/heartbeat", headers=ORIGIN)).json()
        hb2 = (await uday.post(f"/api/conversations/{conv}/heartbeat", headers=ORIGIN)).json()
        check("heartbeat counted once per window", hb1["counted"] and not hb2["counted"])

        r = await uday.patch(f"/api/contacts/{ext['partner']['id']}", json={"ai_allowed": True}, headers=ORIGIN)
        check("AI blocked for external", r.status_code == 400)
        r = await uday.patch(f"/api/contacts/{ext['partner']['id']}", json={"category": "pro"}, headers=ORIGIN)
        check("save external as Professional", r.json()["category"] == "pro")

        r = await priya.get(f"/api/conversations/{ext['id']}/messages")
        check("other users' chat -> 404", r.status_code == 404)

        r = await uday.post("/api/conversations", json={"identifier": "+91 98765 43210"}, headers=ORIGIN)
        check("start chat by phone returns existing", r.json()["id"] == ext["id"])
        r = await uday.post("/api/conversations", json={"identifier": "nobody@demo.com"}, headers=ORIGIN)
        check("unknown user -> 404", r.status_code == 404)

        await uday.post("/api/auth/logout", headers=ORIGIN)
        check("logout ends session", (await uday.get("/api/auth/me")).status_code == 401)

        for _ in range(5):
            await login(anon, "sneha@demo.com", "nope")
        r = await login(anon, "sneha@demo.com")
        check("lockout after 5 failures -> 429", r.status_code == 429)
    print("ALL PASSED")


asyncio.run(main())
