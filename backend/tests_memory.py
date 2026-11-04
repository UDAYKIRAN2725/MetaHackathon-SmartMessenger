"""Memory test against a running backend with freshly seeded data. Calls the Meta Model API (3 requests).

    python -m app.seed --reset
    python tests_memory.py
"""
import asyncio
import subprocess

import httpx

BASE = "http://127.0.0.1:8000"
H = {"Origin": "http://localhost:5173"}


def check(label, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + label, extra)
    if not cond:
        raise SystemExit(1)


async def login(email):
    c = httpx.AsyncClient(base_url=BASE, timeout=60)
    await c.post("/api/auth/login", json={"identifier": email, "password": "Demo@12345"}, headers=H)
    return c


async def main():
    u = await login("uday@demo.com")
    people = (await u.get("/api/memory/people")).json()["items"]
    pid = lambda n: next(p for p in people if p["name"].startswith(n))  # noqa: E731
    priya, mom, arjun = pid("Priya"), pid("Mom"), pid("Arjun")
    check("people with counts", priya["notes"] == 3 and priya["suggested"] == 1 and mom["notes"] == 3)
    check("external contacts not listed", not any(p["name"] == "XYZ Realty" for p in people))

    d = (await u.get(f"/api/memory/people/{priya['contact_id']}")).json()
    check("notes decrypted", "Project Manager" in [n["text"] for n in d["notes"]] and d["conversation_id"])
    sug = next(n for n in d["notes"] if n["status"] == "suggested")

    convs = (await u.get("/api/conversations")).json()["items"]
    pconv = next(i for i in convs if i["partner"]["name"].startswith("Priya"))["id"]
    aconv = next(i for i in convs if i["partner"]["name"] == "Arjun")["id"]
    r = (await u.post(f"/api/conversations/{pconv}/assist", headers=H, json={"goal": "Agree or confirm", "context": "Sending at 4"})).json()
    print("     sent notes:", r["sent"]["notes"], "rules:", r["sent"]["rules"])
    check("assist uses approved notes only", any("Project Manager" in n for n in r["sent"]["notes"])
          and not any("Leadership review" in n for n in r["sent"]["notes"]))
    check("assist uses matching rules only", "No emojis with managers" in r["sent"]["rules"]
          and "Keep replies short" in r["sent"]["rules"] and not any("Telugu" in x for x in r["sent"]["rules"]))

    a = (await u.post(f"/api/memory/notes/{sug['id']}/approve", headers=H)).json()
    check("approve suggested", a["status"] == "approved" and "approved by you" in a["src"])
    r = (await u.post(f"/api/conversations/{pconv}/assist", headers=H, json={"goal": "Agree or confirm"})).json()
    check("approved note now used", any("Leadership review" in n for n in r["sent"]["notes"]))

    n = (await u.post(f"/api/memory/people/{arjun['contact_id']}/notes", headers=H, json={"tag": "Preference", "text": "Calls me bro, likes short texts"})).json()
    e = (await u.patch(f"/api/memory/notes/{n['id']}", headers=H, json={"text": "Calls me bro"})).json()
    check("add + edit note", e["text"] == "Calls me bro")
    r = await u.post(f"/api/memory/people/{arjun['contact_id']}/notes", headers=H, json={"text": "   "})
    check("blank note -> 422", r.status_code == 422)
    rr = (await u.post("/api/memory/rules", headers=H, json={"type": "tone", "text": "Use 'bro' with friends", "applies": ["fr"]})).json()
    r = (await u.post(f"/api/conversations/{aconv}/assist", headers=H, json={"goal": "Agree or confirm", "context": "Saturday 6 pm works"})).json()
    print("     arjun replies:", [x["text"] for x in r["replies"]])
    check("friend rule + note applied", "Use 'bro' with friends" in r["sent"]["rules"] and any("bro" in nn for nn in r["sent"]["notes"]))
    check("delete rule", (await u.delete(f"/api/memory/rules/{rr['id']}", headers=H)).status_code == 204)

    other = await login("priya@demo.com")
    check("other user can't read or edit", (await other.patch(f"/api/memory/notes/{n['id']}", headers=H, json={"text": "x"})).status_code == 404
          and (await other.get(f"/api/memory/people/{arjun['contact_id']}")).status_code == 404)

    r = await u.post(f"/api/memory/people/{mom['contact_id']}/suggest", headers=H)
    check("suggest needs AI assist permission", r.status_code == 403)
    r = await u.post(f"/api/memory/people/{priya['contact_id']}/suggest", headers=H)
    print("     suggested from Priya's chat:", [(x["tag"], x["text"]) for x in r.json().get("items", [])])
    check("suggest from chat -> stored as suggested", r.status_code == 200 and all(x["status"] == "suggested" for x in r.json()["items"]))

    check("delete all for Arjun", (await u.delete(f"/api/memory/people/{arjun['contact_id']}/notes", headers=H)).status_code == 204
          and (await u.get(f"/api/memory/people/{arjun['contact_id']}")).json()["notes"] == [])

    out = subprocess.run(["docker", "exec", "sm-postgres", "psql", "-U", "smart", "-d", "smart_messenger", "-tAc",
                          "select count(*) from memory_notes where position(convert_to('Project Manager','UTF8') in ciphertext) > 0"],
                         capture_output=True, text=True).stdout.strip()
    check("no plaintext in database", out == "0", out)
    for c in (u, other):
        await c.aclose()
    print("ALL PASSED")


asyncio.run(main())
