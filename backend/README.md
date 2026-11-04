# Smart Messenger backend

FastAPI + PostgreSQL + Redis. Postgres and Redis run in Docker; the API runs locally.

## First-time setup
```powershell
docker compose up -d                      # from the repo root
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
copy .env.example .env                    # then set MASTER_KEY (command is in the file)
.\.venv\Scripts\python.exe -m app.seed --reset   # demo users, password Demo@12345
```

## Run (3 terminals)
```powershell
docker compose up -d                                           # repo root
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000   # backend/
npm run dev                                                    # frontend/
```
Open http://localhost:5173 and log in as `uday@demo.com` / `Demo@12345`.
Other demo users: priya@, mom@, ravi@, kiran@, dad@, arjun@, sneha@, lakshmi@ (all `@demo.com`).
API docs: http://localhost:8000/docs

## Tests
With the backend running and freshly seeded data (`python -m app.seed --reset` before each):
- `.\.venv\Scripts\python.exe tests_smoke.py` covers auth, chats, WebSocket and ranking.
- `.\.venv\Scripts\python.exe tests_assist.py` covers AI assist and **calls the real Meta Model API** (about 12 requests).

## AI assist
`POST /api/conversations/{id}/assist {goal, context}` returns three replies (Short / Detailed / Friendly).
- Uses `API_KEY` from the repo-root `.env` (or `META_API_KEY` in `backend/.env`).
- Model `muse-spark-1.3` with `reasoning_effort=minimal` and JSON output; change it with `LLM_MODEL` / `LLM_REASONING_EFFORT`.
- Allowed only when the contact is saved (not External) and AI is on for that chat. This is checked on the server.
- Sends only the goal, the context and the last 10 messages. Prompts and replies are never logged or stored.
- Limited to 10 requests per minute per user.

## Security notes
- Messages are encrypted at rest with AES-256-GCM, one data key per conversation, wrapped by `MASTER_KEY`.
  **Back up `MASTER_KEY`. If it's lost, no stored message can be decrypted.**
- Passwords: bcrypt. Sessions: random token in an HTTP-only, SameSite=Lax cookie; only its SHA-256 is stored.
- Login lockout after 5 failures for 15 min (Redis). Non-GET requests and WebSockets must come from the frontend origin.
- Set `COOKIE_SECURE=true` once served over HTTPS.

## Personal assistant and reminders
- `POST /api/pa/parse {text, tz, source}` understands a typed or spoken request through the LLM and returns one of three things: a **draft** to confirm, a **follow-up question** with options, or a **task list** ("What do I have tomorrow?"). It never saves anything.
- `POST /api/tasks` saves a confirmed task. `PATCH`, `DELETE`, `/done`, `/reopen`, `/snooze {minutes}`, `/dismiss` and `/events` act on one task.
- `POST /api/conversations/{id}/tasks/suggest` finds follow-ups in the last 15 messages of one chat. It needs AI permission for that chat and never saves anything.
- The LLM only reads the request. The server checks the dates and turns them into time-zone-aware times. Repeats can be daily, weekdays, weekly or monthly, using `python-dateutil`.
- Task title, notes and the original request are encrypted with a per-user key, wrapped by `MASTER_KEY`.
- **Reminder worker:** it runs inside the API process (`RUN_SCHEDULER=true`) and checks every 10 s.
  - It claims due reminders with `FOR UPDATE SKIP LOCKED` and pushes `reminder.due` over the WebSocket.
  - Unanswered alerts are still waiting after a reconnect or a server restart.
- Test: `.\.venv\Scripts\python.exe tests_pa.py` (fresh seed; about 6 LLM calls; waits up to 30 s for the scheduler).
- The seeded "Call Mom back" reminder fires about 2 minutes after `app.seed --reset`, which is handy for a demo.

## Smart priority with AI (LLM ranking of unread chats)
- **Opt-in in two places:** the master switch `users.ai_rank_enabled`, plus a per-contact permission `contacts.ai_rank`, set in Settings. External contacts are never included.
- **Formula:** `final = habit + 0.4 × (ai_urgency − habit)`. It applies only to unread chats from contacts you picked; every other chat keeps `final = habit`. The list sorts unread first, then by `final`.
- **Flow:** a new message to an opted-in chat queues the receiver in a Redis sorted set (`rank:queue`), with a 30 s debounce.
  - The worker in the scheduler loop then makes one LLM call per batch of up to 6 chats, sending only the newest 10 **unread** messages of each chat.
  - It stores the urgency, a short reason and any task suggestions in `chat_priority`, encrypted with the user's key, then pushes `ranking.updated`.
- **Reading a chat** clears its urgency, so it goes back to habit order. Task suggestions stay until you add or ignore them.
- **Turning permission off:** unticking a contact or turning the master switch off deletes the stored AI results.
- **The other person sees** "✦ Uday uses AI priority in this chat".
- **Endpoints:** `GET/PATCH /api/settings/ai-rank`, `PATCH /api/settings/ai-rank/contacts`, `GET /api/suggestions`, `GET /api/conversations/{id}/suggestions`, `POST .../suggestions/{sid}/dismiss`.
- **Test:** `.\.venv\Scripts\python.exe tests_rank.py` (fresh seed; about 1.5 min; 2–3 LLM calls).
- **Seed:** Smart priority is on for Priya, Kiran and Lakshmi, and off for the others.

## Memory
- **Notes** about each saved contact, tagged Role, Preference, Fact, Language, Date or Note. **My rules** say how you want to come across (tone, language, avoid, culture) and which categories they apply to: Everyone, Friends, Professional, Family or Relatives.
- **Storage:** all text is encrypted with the owner's key, in the `memory_notes` and `memory_rules` tables.
- **How AI assist uses it:** it adds the contact's **approved** notes and the rules that match the contact's category to the prompt. Both appear under "Context sent to AI".
- **✦ Suggest from chat**, at `POST /api/memory/people/{id}/suggest`, works only when you tap it, and needs AI assist on for that contact.
  - It reads the last 20 messages and proposes up to 3 lasting facts, skipping sensitive details.
  - Suggestions are stored as `suggested` and **never used** until you press Save.
- **Endpoints:** `GET /api/memory/people`, `GET /api/memory/people/{id}`, `POST .../notes`, `PATCH|DELETE /api/memory/notes/{id}`, `POST .../approve`, `DELETE /api/memory/people/{id}/notes`, `GET|POST /api/memory/rules`, `DELETE /api/memory/rules/{id}`.
- **Test:** `.\.venv\Scripts\python.exe tests_memory.py` (fresh seed; 3 LLM calls).
