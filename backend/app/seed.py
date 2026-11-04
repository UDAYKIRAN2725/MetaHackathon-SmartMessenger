"""Demo data: Uday plus the contacts from the wireframe, with 14 days of read/activity history.

    python -m app.seed           create demo data if missing
    python -m app.seed --reset   DROP ALL TABLES, then create demo data

Every demo account uses the password DEMO_PASSWORD below.
"""
import asyncio
import json
import random
import sys
import uuid
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select

from . import crypto
from .db import Base, SessionLocal, create_tables, engine
from .models import (ChatActivity, Contact, Conversation, MemoryNote, MemoryRule, Message, Reminder, Task, TaskEvent,
                     User, UserKey)
from .security import hash_password, utcnow

DEMO_TZ = "Asia/Kolkata"
# Smart priority with AI is on for these contacts only (Mom, Arjun etc. stay habit-only), to show a mixed list.
AI_RANK = {"Priya Sharma", "Kiran (Brother)", "Lakshmi Aunty"}


NOTES = {
    "Priya Sharma": [("Role", "Project Manager"), ("Preference", "Prefers short, clear updates"),
                     ("Fact", "Working on the Q3 report with me")],
    "Mom": [("Preference", "Prefers calls over long texts"), ("Language", "Talks in Telugu, calls me “kanna”"),
            ("Date", "Birthday: 14 January")],
    "Ravi Kumar": [("Role", "Project lead for the product launch"), ("Preference", "Prefers formal replies")],
    "Arjun": [("Fact", "College friend"), ("Fact", "Plays cricket on Sundays")],
}
SUGGESTED = {"Priya Sharma": ("Fact", "Leadership review is on Tuesdays at 5 PM",
                              "Suggested from chat: “Leadership review is at 5.”")}
RULES = [
    ("tone", "Professional tone with Professional contacts", "pro"),
    ("tone", "Keep replies short", "all"),
    ("language", "Reply in Telugu-English with family", "fam,rel"),
    ("avoid", "No emojis with managers", "pro"),
    ("avoid", "Never discuss salary in chat", "all"),
    ("culture", "Greet elders with respect (“Namaste Uncle”)", "rel"),
]


def seed_memory(db, me, people, wrapped, now):
    def sealed(d):
        return crypto.encrypt(me.id, wrapped, json.dumps(d, ensure_ascii=False))

    for name, notes in NOTES.items():
        for tag, text in notes:
            n, c = sealed({"text": text, "src": "Added by you"})
            db.add(MemoryNote(owner_id=me.id, contact_id=people[name].id, tag=tag, status="approved", source="you",
                              nonce=n, ciphertext=c, created_at=now - timedelta(days=10)))
    for name, (tag, text, src) in SUGGESTED.items():
        n, c = sealed({"text": text, "src": src})
        db.add(MemoryNote(owner_id=me.id, contact_id=people[name].id, tag=tag, status="suggested", source="chat",
                          nonce=n, ciphertext=c, created_at=now))
    for typ, text, applies in RULES:
        n, c = sealed({"text": text})
        db.add(MemoryRule(owner_id=me.id, type=typ, applies=applies, nonce=n, ciphertext=c, created_at=now - timedelta(days=9)))


async def seed_tasks(db, me, convs, now):
    """PA demo data, relative to now so it always makes sense. "Call Mom back" fires ~2 min after seeding."""
    z = ZoneInfo(DEMO_TZ)
    loc = now.astimezone(z)
    wrapped = crypto.new_wrapped_key(me.id)
    db.add(UserKey(user_id=me.id, wrapped_key=wrapped))
    await db.flush()
    seed_memory(db, me, {n: await db.get(User, convs[n].user_a_id if convs[n].user_b_id == me.id else convs[n].user_b_id)
                         for n in NOTES}, wrapped, now)

    def at(d: date, hh: int, mm: int = 0) -> datetime:
        return datetime.combine(d, time(hh, mm), z)

    today = loc.date()
    meds = at(today, 18, 30) if at(today, 18, 30) > now + timedelta(minutes=40) else at(today + timedelta(days=1), 18, 30)
    days_to_tue = (1 - today.weekday()) % 7
    tue = at(today + timedelta(days=days_to_tue), 19)
    if tue <= now:
        tue += timedelta(days=7)
    gift_year = today.year if date(today.year, 3, 11) > today else today.year + 1

    specs = [
        dict(title="Pick up medicines for Dad", due=meds, source="voice", notes="Apollo Pharmacy",
             src="Remind me to pick up Dad’s medicines at 6:30 from Apollo"),
        dict(title="Submit timesheet", due=tue, repeat="weekly"),
        dict(title="Renew gym membership", due=None),
        dict(title="Bring launch copy to meeting", due=at(today + timedelta(days=1), 11), source="chat",
             conv=convs["Ravi Kumar"], src="Meeting tomorrow 11 AM, bring the launch copy"),
        dict(title="Call Mom back", due=now + timedelta(minutes=2), offset=0, source="chat", conv=convs["Mom"],
             src="Call me when you’re free ♡", snoozed=1),
        dict(title="Arjun’s birthday gift", due=at(date(gift_year, 3, 11), 10), offset=1440),
        dict(title="Team standup", due=None, status="done"),
    ]
    for s in specs:
        nonce, ct = crypto.encrypt(me.id, wrapped, json.dumps(
            {"title": s["title"], "notes": s.get("notes", ""), "source_text": s.get("src", "")}, ensure_ascii=False))
        t = Task(id=uuid.uuid4(), user_id=me.id, nonce=nonce, ciphertext=ct, due_at=s["due"], tz=DEMO_TZ,
                 repeat=s.get("repeat", "none"), remind_offset_min=s.get("offset", 30), alert_style="sound",
                 source=s.get("source", "typed"), conversation_id=s["conv"].id if s.get("conv") else None,
                 status=s.get("status", "open"), created_at=now - timedelta(hours=3),
                 completed_at=now - timedelta(hours=1) if s.get("status") == "done" else None)
        db.add(t)
        await db.flush()
        db.add(TaskEvent(task_id=t.id, action="created", detail=t.source, at=now - timedelta(hours=3)))
        if t.status == "open" and t.due_at:
            fire = max(t.due_at - timedelta(minutes=t.remind_offset_min), now + timedelta(seconds=30))
            db.add(Reminder(task_id=t.id, user_id=me.id, fire_at=fire, status="pending",
                            snooze_count=s.get("snoozed", 0), created_at=now))
            if s.get("snoozed"):
                db.add(TaskEvent(task_id=t.id, action="snoozed", detail="60 min", at=now - timedelta(hours=1)))

DEMO_PASSWORD = "Demo@12345"

ME = ("Uday Kiran", "uday@demo.com", "919000000001")

# name, email, phone, my category for them, their category for me, AI allowed,
# avg read delay (min), minutes/day, recent script: (from_me, text, minutes_ago, read)
PEOPLE = [
    ("Priya Sharma", "priya@demo.com", "919000012345", "pro", "pro", True, 2, 20, [
        (False, "Morning! How’s the Q3 report coming along?", 7, True),
        (True, "Almost done, just reviewing the numbers.", 5, True),
        (False, "Great. Can you send the report by 4 PM?", 3, False),
        (False, "Leadership review is at 5.", 2, False),
    ]),
    ("Mom", "mom@demo.com", "919000000002", "fam", "fam", False, 4, 22, [
        (True, "Good morning Amma ☀️", 225, True),
        (False, "Good morning kanna. Did you eat?", 205, True),
        (False, "Call me when you’re free ♡", 135, False),
    ]),
    ("Ravi Kumar", "ravi@demo.com", "919000000003", "pro", "pro", True, 8, 10, [
        (False, "Can you share the deck today?", 50, True),
        (True, "Will share the deck by EOD", 35, True),
    ]),
    ("Kiran (Brother)", "kiran@demo.com", "919000000004", "fam", "fam", False, 12, 9, [
        (False, "Did you book the train tickets?", 163, False),
    ]),
    ("Dad", "dad@demo.com", "919000000005", "fam", "fam", False, 6, 11, [
        (True, "Reached office, Nanna.", 900, True),
        (False, "Ok 👍", 880, True),
    ]),
    ("Arjun", "arjun@demo.com", "919000000006", "fr", "fr", True, 40, 6, [
        (True, "That movie was too good 😂", 3000, True),
        (False, "Bro, are we meeting this weekend?", 820, False),
    ]),
    ("Sneha", "sneha@demo.com", "919000000007", "fr", "fr", False, 60, 4, [
        (False, "Haha see you at the gym", 2900, True),
    ]),
    ("Lakshmi Aunty", "lakshmi@demo.com", "919000000008", "rel", "rel", False, 180, 2, [
        (False, "Forwarded: Diwali greetings 🪔", 1300, False),
        (False, "Forwarded: Have a blessed day 🙏", 1250, False),
        (False, "Forwarded: Good night 🌙", 1200, False),
    ]),
]
STRANGER = ("XYZ Realty", "sales@xyzrealty.demo", "919876543210",
            "Hi, is this Uday? I’m calling from XYZ Realty about plots near the airport. Very good offer.", 25)

FILLER_IN = ["Ok, noted.", "Sounds good!", "Thanks 🙂", "See you then.", "Sure.", "Got it, thanks!"]
FILLER_OUT = ["Ok 👍", "Will do.", "Thanks!", "Sure, talk later.", "Done.", "Noted."]


def add_msg(db, conv, sender, text, at, delivered_after_s=5, read_after_s=None):
    nonce, ct = crypto.encrypt(conv.id, conv.wrapped_key, text)
    db.add(Message(
        conversation_id=conv.id, sender_id=sender, nonce=nonce, ciphertext=ct, created_at=at,
        delivered_at=at + timedelta(seconds=delivered_after_s),
        read_at=None if read_after_s is None else at + timedelta(seconds=read_after_s),
    ))
    conv.last_message_at = max(conv.last_message_at or at, at)


def new_conv(me, other, creator):
    a, b = sorted([me, other])
    cid = uuid.uuid4()
    return Conversation(id=cid, user_a_id=a, user_b_id=b, created_by=creator, wrapped_key=crypto.new_wrapped_key(cid))


async def seed(reset: bool) -> None:
    if reset:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
    await create_tables()

    rnd = random.Random(42)
    now = utcnow()
    pw = hash_password(DEMO_PASSWORD)
    async with SessionLocal() as db:
        if (await db.execute(select(User).where(User.email == ME[1]))).scalar_one_or_none():
            print("Demo data already exists. Use --reset to recreate it.")
            return

        me = User(name=ME[0], email=ME[1], phone=ME[2], password_hash=pw, ai_rank_enabled=True, tz=DEMO_TZ)
        db.add(me)
        await db.flush()
        convs = {}

        for name, email, phone, my_cat, their_cat, ai, delay, mpd, script in PEOPLE:
            p = User(name=name, email=email, phone=phone, password_hash=pw)
            db.add(p)
            await db.flush()
            conv = new_conv(me.id, p.id, me.id)
            db.add(conv)
            await db.flush()
            convs[name] = conv
            db.add(Contact(owner_id=me.id, contact_id=p.id, category=my_cat, ai_allowed=ai, ai_rank=name in AI_RANK))
            db.add(Contact(owner_id=p.id, contact_id=me.id, category=their_cat, ai_allowed=False))

            # Past 13 days: two messages from them (read after ~delay), one reply from me.
            for d in range(13, 0, -1):
                for _ in range(2):
                    at = now - timedelta(days=d, hours=rnd.uniform(0, 10))
                    add_msg(db, conv, p.id, rnd.choice(FILLER_IN), at,
                            read_after_s=int(delay * 60 * rnd.uniform(0.6, 1.4)) + 5)
                at = now - timedelta(days=d, hours=rnd.uniform(-3, 0))
                add_msg(db, conv, me.id, rnd.choice(FILLER_OUT), at, read_after_s=600)
                db.add(ChatActivity(user_id=me.id, conversation_id=conv.id, day=(now - timedelta(days=d)).date(),
                                    seconds=int(mpd * 60 * rnd.uniform(0.8, 1.2) * 14 / 13)))

            for from_me, text, mins_ago, read in script:
                at = now - timedelta(minutes=mins_ago)
                sender = me.id if from_me else p.id
                read_after = (int(delay * 60) + 5 if not from_me else 60) if read else None
                add_msg(db, conv, sender, text, at, read_after_s=read_after)

        # Unknown number: they started the chat, I see them as External.
        name, email, phone, text, mins_ago = STRANGER
        s = User(name=name, email=email, phone=phone, password_hash=pw)
        db.add(s)
        await db.flush()
        conv = new_conv(me.id, s.id, s.id)
        db.add(conv)
        await db.flush()
        db.add(Contact(owner_id=s.id, contact_id=me.id, category="fr", ai_allowed=False))
        db.add(Contact(owner_id=me.id, contact_id=s.id, category="ext", ai_allowed=False))
        add_msg(db, conv, s.id, text, now - timedelta(minutes=mins_ago))

        await seed_tasks(db, me, convs, now)
        await db.commit()
    print(f"Seeded {len(PEOPLE) + 2} users. Log in as {ME[1]} / {DEMO_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(seed("--reset" in sys.argv))
