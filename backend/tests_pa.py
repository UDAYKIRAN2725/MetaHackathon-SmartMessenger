"""PA + reminders test against a running backend with freshly seeded data.
Uses the real scheduler and WebSocket, and calls the Meta Model API (about 6 requests).

    python -m app.seed --reset
    python tests_pa.py
"""
import asyncio
import json
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
import websockets

BASE = "http://127.0.0.1:8000"
H = {"Origin": "http://localhost:5173"}
TZ = "Asia/Kolkata"
Z = ZoneInfo(TZ)


def check(label, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + label, extra)
    if not cond:
        raise SystemExit(1)


def local_in(minutes):
    t = datetime.now(Z) + timedelta(minutes=minutes)
    return t.date().isoformat(), t.strftime("%H:%M")


async def main():
    c = httpx.AsyncClient(base_url=BASE, timeout=60)
    await c.post("/api/auth/login", json={"identifier": "uday@demo.com", "password": "Demo@12345"}, headers=H)
    other = httpx.AsyncClient(base_url=BASE, timeout=60)
    await other.post("/api/auth/login", json={"identifier": "priya@demo.com", "password": "Demo@12345"}, headers=H)

    items = (await c.get("/api/tasks")).json()["items"]
    titles = [t["title"] for t in items]
    print("     seeded:", titles)
    check("seeded tasks visible (decrypted)", "Submit timesheet" in titles and len(items) == 7)
    check("other user sees none of them", (await other.get("/api/tasks")).json()["items"] == [])
    ts = next(t for t in items if t["title"] == "Submit timesheet")
    check("weekly task due Tuesday 19:00", date.fromisoformat(ts["due_date"]).weekday() == 1 and ts["due_time"] == "19:00")

    # Validation
    d, tm = local_in(-60)
    r = await c.post("/api/tasks", headers=H, json={"title": "Past", "due_date": d, "due_time": tm, "tz": TZ})
    check("past time -> 400", r.status_code == 400, r.json()["detail"])
    r = await c.post("/api/tasks", headers=H, json={"title": "Weekly past", "due_date": d, "due_time": tm, "tz": TZ,
                                                     "repeat": "weekly"})
    check("repeating past -> moved to next week", r.status_code == 201 and r.json()["due_date"] > d, r.json().get("due_date"))
    r = await c.post("/api/tasks", headers=H, json={"title": "   ", "tz": TZ})
    check("blank title -> 422", r.status_code == 422)
    r = await c.post("/api/tasks", headers=H, json={"title": "Daily, no date", "repeat": "daily", "tz": TZ})
    check("repeat without date -> 400", r.status_code == 400)

    # Scheduler -> WebSocket alert
    cookie = c.cookies.get("sm_session")
    async with websockets.connect("ws://127.0.0.1:8000/api/ws", origin="http://localhost:5173",
                                  additional_headers={"Cookie": f"sm_session={cookie}"}) as ws:
        d, tm = local_in(3)
        t = (await c.post("/api/tasks", headers=H, json={
            "title": "Join the standup call", "due_date": d, "due_time": tm, "tz": TZ, "remind_offset_min": 10,
            "source": "typed"})).json()
        check("created with reminder firing now", t["reminder"]["status"] == "pending")
        got = None
        deadline = asyncio.get_event_loop().time() + 30
        while asyncio.get_event_loop().time() < deadline:
            evt = json.loads(await asyncio.wait_for(ws.recv(), 30))
            if evt["type"] == "reminder.due" and evt["task"]["id"] == t["id"]:
                got = evt["task"]
                break
        check("scheduler pushed reminder.due over WebSocket", got and got["reminder"]["status"] == "sent")

    r = (await c.post(f"/api/tasks/{t['id']}/snooze", headers=H, json={"minutes": 15})).json()
    check("snooze -> pending, count 1", r["reminder"]["status"] == "pending" and r["reminder"]["snooze_count"] == 1)
    r = (await c.post(f"/api/tasks/{t['id']}/snooze", headers=H, json={"minutes": 60})).json()
    check("snooze again -> count 2", r["reminder"]["snooze_count"] == 2)
    r = (await c.post(f"/api/tasks/{t['id']}/done", headers=H)).json()
    check("done -> status done, no reminder", r["status"] == "done" and r["reminder"] is None)
    r = (await c.post(f"/api/tasks/{t['id']}/reopen", headers=H)).json()
    check("reopen -> open again", r["status"] == "open")
    ev = (await c.get(f"/api/tasks/{t['id']}/events")).json()["items"]
    check("history recorded", [e["action"] for e in ev][::-1][:5] == ["created", "alerted", "snoozed", "snoozed", "done"],
          [e["action"] for e in ev])

    r = (await c.post(f"/api/tasks/{ts['id']}/done", headers=H)).json()
    check("recurring done -> next week, still open",
          r["status"] == "open" and (date.fromisoformat(r["due_date"]) - date.fromisoformat(ts["due_date"])).days == 7)

    r = (await c.patch(f"/api/tasks/{t['id']}", headers=H, json={"title": "Join the design call", "remind_offset_min": 60})).json()
    check("edit title + offset", r["title"] == "Join the design call" and r["remind_offset_min"] == 60)
    r = (await c.patch(f"/api/tasks/{t['id']}", headers=H, json={"due_date": None})).json()
    check("clear date -> to-do, no reminder", r["due_at"] is None and r["reminder"] is None)
    check("other user can't touch it", (await other.post(f"/api/tasks/{t['id']}/done", headers=H)).status_code == 404)
    check("delete", (await c.delete(f"/api/tasks/{t['id']}", headers=H)).status_code == 204)

    # LLM understanding
    async def parse(text):
        r = await c.post("/api/pa/parse", headers=H, json={"text": text, "tz": TZ, "source": "voice"})
        assert r.status_code == 200, r.text
        return r.json()

    p = await parse("Remind me to call the bank on Friday at 11 AM about the loan papers")
    dr = p.get("draft", {})
    print("     ", p)
    check("parse: create, Friday 11:00", p["action"] == "create" and dr["due_time"] == "11:00"
          and date.fromisoformat(dr["due_date"]).weekday() == 4 and "bank" in dr["title"].lower())
    check("parse: nothing saved yet", len((await c.get("/api/tasks")).json()["items"]) == 8)

    p = await parse("Every Tuesday at 7 PM remind me to submit the timesheet")
    print("     ", p)
    check("parse: weekly Tuesday 19:00", p["action"] == "create" and p["draft"]["repeat"] == "weekly"
          and p["draft"]["due_time"] == "19:00" and date.fromisoformat(p["draft"]["due_date"]).weekday() == 1)

    p = await parse("Remind me to pay rent next week")
    print("     ", p)
    check("parse: ambiguous -> asks", p["action"] == "ask" and p["options"])

    p = await parse("What do I have tomorrow?")
    print("     ", p["action"], [t["title"] for t in p.get("tasks", [])])
    check("parse: list tomorrow", p["action"] == "list" and any("launch" in t["title"].lower() for t in p["tasks"]))

    # Find tasks in a chat
    convs = (await c.get("/api/conversations")).json()["items"]
    priya = next(i for i in convs if i["partner"]["name"].startswith("Priya"))
    mom = next(i for i in convs if i["partner"]["name"] == "Mom")
    r = await c.post(f"/api/conversations/{priya['id']}/tasks/suggest", headers=H, json={"tz": TZ})
    s = r.json()
    print("     ", s)
    check("chat suggest finds the report task", r.status_code == 200 and any(
        "report" in x["draft"]["title"].lower() and x["draft"]["due_time"] == "16:00" for x in s["suggestions"]))
    r = await c.post(f"/api/conversations/{mom['id']}/tasks/suggest", headers=H, json={"tz": TZ})
    check("chat suggest without AI permission -> 403", r.status_code == 403)

    await c.aclose()
    await other.aclose()
    print("ALL PASSED")


asyncio.run(main())
