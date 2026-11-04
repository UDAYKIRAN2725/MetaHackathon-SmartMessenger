from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
# backend/.env wins; the repo-root .env (where API_KEY already lives) is read as a fallback.
ENV_FILES = (BACKEND_DIR.parent / ".env", BACKEND_DIR / ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILES, extra="ignore")

    # Meta Model API (OpenAI-compatible). Empty key -> AI assist returns 503, everything else works.
    llm_api_key: str = Field("", validation_alias=AliasChoices("META_API_KEY", "API_KEY"))
    llm_base_url: str = "https://api.meta.ai/v1"
    llm_model: str = "muse-spark-1.3"
    llm_reasoning_effort: str = "minimal"   # fastest in our test (~2 s); "" = API default
    llm_timeout_seconds: float = 25
    assist_history_messages: int = 10
    assist_rate_per_minute: int = 10

    # Personal assistant
    default_tz: str = "Asia/Kolkata"
    pa_rate_per_minute: int = 20
    find_tasks_messages: int = 40       # ✦ Find tasks reads this many recent messages
    run_scheduler: bool = True          # reminder worker runs inside the API process
    scheduler_interval_seconds: int = 10

    # Smart priority with AI (step d)
    rank_weight: float = 0.4            # final = habit + weight × (ai_urgency − habit)
    rank_debounce_seconds: int = 30     # wait for a burst of messages, then one LLM call per user
    rank_batch_chats: int = 6           # chats per LLM call
    rank_unread_messages: int = 10      # newest unread messages sent per chat

    database_url: str
    redis_url: str = "redis://127.0.0.1:6379/0"
    master_key: str  # base64, 32 bytes. Wraps the per-conversation data keys.
    cookie_secure: bool = False
    frontend_origin: str = "http://localhost:5173"

    session_cookie: str = "sm_session"
    session_days: int = 30          # "remember me"
    session_hours_short: int = 12   # not remembered
    ranking_window_days: int = 14
    min_tracked_for_score: int = 5
    heartbeat_seconds: int = 30
    login_max_failures: int = 5
    login_lock_seconds: int = 900


settings = Settings()
