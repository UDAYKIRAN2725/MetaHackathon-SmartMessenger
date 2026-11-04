import uuid
from datetime import date, datetime

from sqlalchemy import (
    BigInteger, Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer,
    LargeBinary, String, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base

CATEGORIES = ("fr", "pro", "fam", "rel", "ext")


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)  # stored lower-case
    phone: Mapped[str] = mapped_column(String(15), unique=True, index=True)   # digits only
    password_hash: Mapped[str] = mapped_column(String(100))                   # bcrypt
    # Smart priority with AI (master switch). Per-contact permission is Contact.ai_rank.
    ai_rank_enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    tz: Mapped[str] = mapped_column(String(64), default="", server_default="")  # last seen browser time zone
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuthSession(Base):
    """Login session. Only a SHA-256 of the cookie token is stored."""
    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Conversation(Base):
    """One-to-one chat. user_a_id < user_b_id so each pair has exactly one row."""
    __tablename__ = "conversations"
    __table_args__ = (
        UniqueConstraint("user_a_id", "user_b_id"),
        CheckConstraint("user_a_id < user_b_id", name="ck_conv_order"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_a_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    user_b_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    # Per-conversation AES-256 data key, encrypted ("wrapped") with MASTER_KEY.
    wrapped_key: Mapped[bytes] = mapped_column(LargeBinary)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)


class Contact(Base):
    """How `owner` sees `contact`: category and per-chat AI permission."""
    __tablename__ = "contacts"
    __table_args__ = (CheckConstraint(f"category IN {CATEGORIES}", name="ck_contact_cat"),)

    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    contact_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    category: Mapped[str] = mapped_column(String(3), default="ext")
    ai_allowed: Mapped[bool] = mapped_column(Boolean, default=False)   # AI assist, only when tapped
    ai_rank: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")  # AI reads unread automatically
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (Index("ix_msg_conv_id", "conversation_id", "id"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    conversation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"))
    sender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    nonce: Mapped[bytes] = mapped_column(LargeBinary)       # 12 bytes, unique per message
    ciphertext: Mapped[bytes] = mapped_column(LargeBinary)  # AES-256-GCM, includes auth tag
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ChatActivity(Base):
    """Seconds a user spent with a chat open and visible, per day. No message content."""
    __tablename__ = "chat_activity"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    conversation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), primary_key=True)
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    seconds: Mapped[int] = mapped_column(Integer, default=0)


class UserKey(Base):
    """Per-user AES-256 data key for the user's own private data (tasks), wrapped with MASTER_KEY."""
    __tablename__ = "user_keys"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    wrapped_key: Mapped[bytes] = mapped_column(LargeBinary)


REPEATS = ("none", "daily", "weekdays", "weekly", "monthly")


class Task(Base):
    """A PA task. Title, notes and the original request are encrypted (JSON in `ciphertext`)."""
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint(f"repeat IN {REPEATS}", name="ck_task_repeat"),
        Index("ix_task_user_status_due", "user_id", "status", "due_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    nonce: Mapped[bytes] = mapped_column(LargeBinary)
    ciphertext: Mapped[bytes] = mapped_column(LargeBinary)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))   # None = to-do, no reminder
    tz: Mapped[str] = mapped_column(String(64))                               # IANA zone the times were given in
    repeat: Mapped[str] = mapped_column(String(10), default="none")
    remind_offset_min: Mapped[int] = mapped_column(Integer, default=30)
    alert_style: Mapped[str] = mapped_column(String(12), default="notification")  # notification|sound|alarm
    source: Mapped[str] = mapped_column(String(8), default="typed")               # typed|voice|chat
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("conversations.id", ondelete="SET NULL"))
    status: Mapped[str] = mapped_column(String(8), default="open")                # open|done
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Reminder(Base):
    """One scheduled alert. The scheduler moves pending -> sent; the user moves sent -> done/dismissed (or snoozes)."""
    __tablename__ = "reminders"
    __table_args__ = (Index("ix_rem_status_fire", "status", "fire_at"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    task_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    fire_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(10), default="pending")  # pending|sent|done|dismissed|cancelled
    snooze_count: Mapped[int] = mapped_column(Integer, default=0)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TaskEvent(Base):
    """History shown in the reminder detail. `detail` never contains task text."""
    __tablename__ = "task_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    task_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), index=True)
    action: Mapped[str] = mapped_column(String(16))  # created|edited|alerted|snoozed|done|reopened|dismissed
    detail: Mapped[str] = mapped_column(String(120), default="")
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ChatPriority(Base):
    """LLM result for one owner's chat. `urgency` applies to the current unread batch only (cleared on read).
    Reason and task suggestions are derived from message text, so they're encrypted with the owner's key."""
    __tablename__ = "chat_priority"

    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    conversation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), primary_key=True)
    urgency: Mapped[int | None] = mapped_column(Integer)
    nonce: Mapped[bytes] = mapped_column(LargeBinary)
    ciphertext: Mapped[bytes] = mapped_column(LargeBinary)  # JSON {"reason": str, "suggestions": [...]}
    last_message_id: Mapped[int] = mapped_column(BigInteger, default=0)
    scored_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class MemoryNote(Base):
    """Something the owner wants remembered about a contact. Text is encrypted with the owner's key.
    status 'suggested' notes (found by AI in a chat) are never used until the owner approves them."""
    __tablename__ = "memory_notes"
    __table_args__ = (Index("ix_mem_owner_contact", "owner_id", "contact_id"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    contact_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    tag: Mapped[str] = mapped_column(String(12), default="Note")         # Role|Preference|Fact|Language|Date|Note
    status: Mapped[str] = mapped_column(String(10), default="approved")  # approved|suggested
    source: Mapped[str] = mapped_column(String(6), default="you")        # you|chat
    nonce: Mapped[bytes] = mapped_column(LargeBinary)
    ciphertext: Mapped[bytes] = mapped_column(LargeBinary)               # JSON {"text", "src"}
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MemoryRule(Base):
    """'My rules': how the owner wants to come across. Applied to AI-assist replies for matching contacts."""
    __tablename__ = "memory_rules"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(10))       # tone|language|avoid|culture
    applies: Mapped[str] = mapped_column(String(40))    # comma list of all|fr|pro|fam|rel
    nonce: Mapped[bytes] = mapped_column(LargeBinary)
    ciphertext: Mapped[bytes] = mapped_column(LargeBinary)  # JSON {"text"}
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
