# MetaHackathon-SmartMessenger

Smart Messenger is a one-to-one chat app that learns who matters to you, helps you reply, remembers what you promised and reminds you on time. It does all of this only in the ways you allow. The AI only suggests: nothing is sent or saved without your OK.

## Features

| Feature | What it does | AI? |
|---|---|---|
| **Live chat** | Real-time messages between registered users over WebSocket, with sent ✓, delivered ✓✓ and read ✓✓ receipts. | No |
| **Behaviour ranking** | Unread chats come first, then a 0–100 habit score based on how fast you read each contact and how long you spend in the chat (last 14 days). Uses timestamps only. | No |
| **Contact categories** | Friends, Professional, Family, Relatives, External. Unknown senders stay External until you save them. | No |
| **✦ AI assist** | Tap ✦, choose a goal and add context, then get Short, Detailed and Friendly replies. The tone follows the contact's category, your memory notes and your rules. The reply fills the message box; you still press send. | Yes, when tapped |
| **Personal assistant (PA)** | Type or speak a task ("Remind me to call the bank on Friday at 11 AM"). The AI drafts it, asks a follow-up if something is unclear, and you confirm. It also answers "What do I have tomorrow?". | Yes, when used |
| **Reminders** | A background worker sends alerts at the time you choose, with Done, Snooze, Open chat and Dismiss. Supports repeating tasks, alert styles and history. Alerts survive restarts and wait for you if you're offline. | No |
| **✦ Find tasks** | Finds promises, requests, plans and unanswered questions in the last 40 messages of a chat. | Yes, when tapped |
| **Smart priority with AI** | For contacts you tick in Settings, the AI scores new **unread** messages for urgency and spots tasks. `final = habit + 0.4 × (AI urgency − habit)`. Other chats keep their habit score. | Yes, automatic, opt-in per contact |
| **Memory** | Notes about each contact and "My rules" (tone, language, things to avoid, culture), used by AI assist. **✦ Suggest from chat** proposes notes; they're used only after you save them. | Suggest: when tapped |
| **Scheduled messages** | One-time and repeating messages. | UI only (sample data) |

## Privacy and security

- **Encryption at rest:** messages, tasks, memory and AI results are encrypted with AES-256-GCM. Each conversation and each user has its own data key, and those keys are wrapped by `MASTER_KEY`, which is kept in `.env` and never in the database.
- **Logins:** passwords are hashed with bcrypt. Sessions use a random token in an HTTP-only cookie, and only the token's hash is stored. Login locks for 15 minutes after 5 failed attempts.
- **Requests from other sites:** POST/PATCH/DELETE requests and WebSocket connections must come from the frontend origin.
- **AI permissions are checked on the server, per contact.** External contacts are never sent to the AI. Chat text is treated as data, not instructions, which protects against prompt injection. Prompts and replies are never logged.
- **Turning AI off** for a contact, or turning Smart priority off, deletes the stored AI results. The other person sees "✦ … uses AI priority in this chat".

## Tech stack

| Part | Technology |
|---|---|
| Frontend | React 19 + Vite (JavaScript) |
| Backend | Python 3.11, FastAPI, SQLAlchemy (async), WebSockets |
| Database / cache | PostgreSQL 16, Redis 7 (in Docker) |
| AI | Meta Model API (`muse-spark-1.3`, OpenAI-compatible) |

```
React (Vite :5173) ──/api + WebSocket──► FastAPI (:8000) ──► PostgreSQL (:5432)
                                            │  ├─ reminder + ranking worker
                                            │  └─► Redis (:6379)  live events, queues, rate limits
                                            └─► Meta Model API
```

## Project structure

```
MetaHackathon/
├── docker-compose.yml        Postgres + Redis
├── .env                      API_KEY for the Meta Model API (not committed)
├── backend/
│   ├── .env                  DATABASE_URL, REDIS_URL, MASTER_KEY (not committed)
│   ├── requirements.txt
│   ├── app/                  FastAPI app: routes_*.py, models.py, llm.py, pa.py,
│   │                         ai_rank.py, memory.py, scheduler.py, crypto.py, seed.py
│   └── tests_*.py            end-to-end tests against a running server
├── frontend/
│   └── src/                  pages/, components/, ChatStore, TaskStore, api.js
└── smart-messenger-*.html    original clickable wireframes
```

## Prerequisites

- **Docker Desktop** (running)
- **Python 3.11+**
- **Node.js 20.19+** with npm
- A **Meta Model API key**

## First-time setup

Run from the repo root in PowerShell.

1. **API key.** Create `.env` in the repo root:
   ```
   API_KEY=your-meta-model-api-key
   ```

2. **Database and Redis:**
   ```powershell
   docker compose up -d
   docker compose ps          # both should show "healthy"
   ```

3. **Backend:**
   ```powershell
   cd backend
   python -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
   copy .env.example .env
   ```
   Generate a `MASTER_KEY` and paste it into `backend/.env`:
   ```powershell
   .\.venv\Scripts\python.exe -c "import secrets,base64;print(base64.b64encode(secrets.token_bytes(32)).decode())"
   ```
   **Back this key up.** If it's lost, none of the stored data can be decrypted.

   Load the demo data:
   ```powershell
   .\.venv\Scripts\python.exe -m app.seed --reset
   ```

4. **Frontend:**
   ```powershell
   cd ..\frontend
   npm install
   ```
   `frontend/.npmrc` sets `legacy-peer-deps=true`, which works around a crash in npm 10.

## Running the project

Use three terminals. Start Docker Desktop first.

**Terminal 1: Postgres and Redis** (repo root)
```powershell
docker compose up -d
```

**Terminal 2: Backend** (`backend\`)
```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```
Wait for `Application startup complete`. API docs: http://localhost:8000/docs

**Terminal 3: Frontend** (`frontend\`)
```powershell
npm run dev
```

Open **http://localhost:5173** and log in as **`uday@demo.com` / `Demo@12345`**.

Every demo account uses the password `Demo@12345`: `priya@`, `mom@`, `ravi@`, `kiran@`, `dad@`, `arjun@`, `sneha@` and `lakshmi@`, all `@demo.com`. To test live chat, open a private window and log in as Priya.

**Git Bash:** the backend command is `./.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000`.

### Stopping

- Backend and frontend: press `Ctrl + C`.
- Docker: `docker compose down`. Your data is kept. `docker compose down -v` **deletes** the database.

### Resetting demo data

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.seed --reset
```
This **deletes all users, messages and tasks** and recreates the demo set. After a reset, the "Call Mom back" reminder fires about 2 minutes later, which is useful for showing reminders in a demo.

## Tests

With the backend running, reset the demo data before each script:

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.seed --reset
.\.venv\Scripts\python.exe tests_smoke.py     # auth, chats, WebSocket, ranking (no AI)
.\.venv\Scripts\python.exe tests_assist.py    # AI assist (~12 API calls)
.\.venv\Scripts\python.exe tests_pa.py        # tasks, reminders, scheduler (~6 API calls)
.\.venv\Scripts\python.exe tests_rank.py      # Smart priority (~1.5 min, 2–3 API calls)
.\.venv\Scripts\python.exe tests_memory.py    # Memory (3 API calls)
```

## Configuration

Set these in `backend/.env`. All are optional except the first two.

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | – | Postgres connection |
| `MASTER_KEY` | – | 32-byte base64 key that wraps every data key |
| `REDIS_URL` | `redis://127.0.0.1:6379/0` | Redis connection |
| `META_API_KEY` | `API_KEY` from root `.env` | Meta Model API key |
| `LLM_MODEL` | `muse-spark-1.3` | Model name |
| `LLM_REASONING_EFFORT` | `minimal` | Fastest setting in testing (about 2–3 s per call) |
| `RANK_WEIGHT` | `0.4` | How far AI urgency moves a chat's score |
| `RANK_DEBOUNCE_SECONDS` | `30` | Wait before scoring new unread messages |
| `FIND_TASKS_MESSAGES` | `40` | Messages read by ✦ Find tasks |
| `DEFAULT_TZ` | `Asia/Kolkata` | Fallback time zone |
| `COOKIE_SECURE` | `false` | Set to `true` when served over HTTPS |

## Troubleshooting

- **"Can't reach the server" on the login page:** the backend isn't running.
- **Backend can't connect to the database:** start Docker Desktop and run `docker compose up -d`.
- **Port 5432 is already in use:** a Postgres installed directly on Windows is using it. Change the port in `docker-compose.yml` and in `DATABASE_URL`.
- **AI features return 503:** check `API_KEY` in the root `.env`.
- **Voice input doesn't work:** use Chrome or Edge and allow the microphone.

## Known limitations

- The **Scheduled messages** page still uses sample data.
- Reminder alerts appear while a tab is open; if you're offline they wait until you come back. Alerts with the browser closed would need Web Push.
- Tables are created when the backend starts. Use Alembic migrations before you have real data to keep.
- Messages are encrypted at rest, not end-to-end: the server can decrypt them to run the AI features you enable.

More backend detail is in [`backend/README.md`](backend/README.md).
