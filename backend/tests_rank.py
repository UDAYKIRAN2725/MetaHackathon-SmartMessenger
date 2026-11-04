"""Smart priority with AI: test against a running backend with freshly seeded data.
Uses the real worker and Meta Model API (2-3 LLM calls). Takes about 1.5 minutes (30 s debounce).

    python -m app.seed --reset
    python tests_rank.py
"""
import asyncio
import time

import httpx

BASE = "http://127.0.0.1:8000"
H = {"Origin": "http://localhost:5173"}


def check(label, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + label, extra)
    if not cond:
        raise SystemExit(1)


async def login(email):
    c = httpx.AsyncClient(base_url=BASE, timeout=60)
    r = await c.post("/api/auth/login", json={"identifier": email, "password": "Demo@12345"}, headers=H)
    assert r.status_code == 200
    return c


async def items(c):
    return (await c.get("/api/conversations?tz=Asia/Kolkata")).json()["items"]


def by(lst, name):
    return next(i for i in lst if i["partner"]["name"].startswith(name))


async def wait_for(c, cond, timeout=75):
    end = time.time() + timeout
    while time.time() < end:
        lst = await items(c)
        if cond(lst):
            return lst
        await asyncio.sleep(3)
    return await items(c)


def show(lst):
    for i in lst:
        llm = i["llm"]
        print(f"     {i['partner']['name']:<16} unread={i['unread']} habit={i['stats']['score']} "
              f"ai={'✦' if i['ai_rank'] else ' '} urgency={llm and llm['urgency']} final={i['final']} "
              f"{(llm or {}).get('reason', '')}")


async def main():
    uday = await login("uday@demo.com")
    lst = await items(uday)
    check("opted-in flags", by(lst, "Priya")["ai_rank"] and by(lst, "Kiran")["ai_rank"] and not by(lst, "Mom")["ai_rank"])

    lst = await wait_for(uday, lambda l: all(by(l, n)["llm"] for n in ("Priya", "Kiran", "Lakshmi")))
    show(lst)
    pr, ki, la, mom = by(lst, "Priya"), by(lst, "Kiran"), by(lst, "Lakshmi"), by(lst, "Mom")
    check("worker scored the 3 opted-in unread chats", pr["llm"] and ki["llm"] and la["llm"])
    check("not opted-in: no AI, final = habit", mom["llm"] is None and mom["final"] == mom["stats"]["score"])
    for i in (pr, ki, la):
        b, u = i["stats"]["score"], i["llm"]["urgency"]
        check(f"formula {i['partner']['name']}", i["final"] == round(b + 0.4 * (u - b)), f"{b}→{i['final']} (u={u})")
    check("deadline chat is urgent", pr["llm"]["urgency"] >= 70)
    check("forwarded greetings are low", la["llm"]["urgency"] <= 30)
    unread = [i for i in lst if i["unread"]]
    finals = [i["final"] for i in unread if i["final"] is not None]
    check("unread sorted by final", finals == sorted(finals, reverse=True), finals)
    check("external stays unscored and last", unread[-1]["partner"]["name"] == "XYZ Realty")

    sug = (await uday.get(f"/api/conversations/{pr['id']}/suggestions")).json()["items"]
    print("     suggestions:", [(s["draft"]["title"], s["draft"]["due_time"]) for s in sug])
    check("task found automatically in Priya's unread", any("report" in s["draft"]["title"].lower() for s in sug))
    check("listed in Assistant suggestions", len((await uday.get("/api/suggestions")).json()["items"]) >= 1)

    priya = await login("priya@demo.com")
    mom_c = await login("mom@demo.com")
    check("Priya is told Uday uses AI priority", by(await items(priya), "Uday")["partner_ai_rank"] is True)
    check("Mom is not", by(await items(mom_c), "Uday")["partner_ai_rank"] is False)
    check("Priya can't see Uday's suggestions", (await priya.get(f"/api/conversations/{pr['id']}/suggestions")).json()["items"] == [])

    await uday.post(f"/api/conversations/{pr['id']}/read", headers=H)
    p2 = by(await items(uday), "Priya")
    check("read -> back to habit order", p2["llm"] is None and p2["final"] == p2["stats"]["score"])
    check("suggestions kept after read", p2["suggestions"] == len(sug))
    await uday.post(f"/api/conversations/{pr['id']}/suggestions/{sug[0]['id']}/dismiss", headers=H)
    check("dismiss suggestion", by(await items(uday), "Priya")["suggestions"] == len(sug) - 1)

    # New message from an opted-in contact gets scored after the debounce; one from Mom never does.
    lak = await login("lakshmi@demo.com")
    lconv = by(await items(lak), "Uday")["id"]
    await lak.post(f"/api/conversations/{lconv}/messages", headers=H,
                   json={"text": "Uday, Raju uncle is in hospital. Please call me right now."})
    mconv = by(await items(mom_c), "Uday")["id"]
    await mom_c.post(f"/api/conversations/{mconv}/messages", headers=H, json={"text": "Did you eat lunch?"})
    lst = await wait_for(uday, lambda l: (by(l, "Lakshmi")["llm"] or {}).get("urgency", 0) >= 70, timeout=80)
    la2 = by(lst, "Lakshmi")
    print("     Lakshmi now:", la2["llm"], "final", la2["final"])
    check("emergency raises Lakshmi", la2["llm"] and la2["llm"]["urgency"] >= 70 and la2["final"] > la["final"])
    check("Mom still habit-only", by(lst, "Mom")["llm"] is None)

    # Settings
    s = (await uday.get("/api/settings/ai-rank")).json()
    check("settings lists contacts", s["enabled"] and sum(c["allowed"] for c in s["contacts"]) == 3)
    ext = next(c for c in s["contacts"] if c["category"] == "ext")
    r = await uday.patch("/api/settings/ai-rank/contacts", headers=H, json={"contact_ids": [ext["contact_id"]], "allowed": True})
    check("external can't be allowed", r.status_code == 400)
    kid = next(c for c in s["contacts"] if c["name"].startswith("Kiran"))["contact_id"]
    await uday.patch("/api/settings/ai-rank/contacts", headers=H, json={"contact_ids": [kid], "allowed": False})
    k2 = by(await items(uday), "Kiran")
    check("unselect Kiran -> AI result deleted", not k2["ai_rank"] and k2["llm"] is None and k2["final"] == k2["stats"]["score"])
    await uday.patch("/api/settings/ai-rank", headers=H, json={"enabled": False})
    lst = await items(uday)
    check("master off -> everything habit-only", all(i["llm"] is None and not i["ai_rank"] for i in lst))
    check("master off -> suggestions deleted", (await uday.get("/api/suggestions")).json()["items"] == [])

    for c in (uday, priya, mom_c, lak):
        await c.aclose()
    print("ALL PASSED")


asyncio.run(main())
