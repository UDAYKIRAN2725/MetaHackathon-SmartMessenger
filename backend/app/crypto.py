"""Envelope encryption for messages.

MASTER_KEY (env, never in the DB)
   └─ wraps a random 256-bit data key per conversation (conversations.wrapped_key)
        └─ encrypts every message in that conversation with AES-256-GCM

A database dump alone reveals no message text. The conversation id is bound in as
associated data, so ciphertext copied into another conversation fails to decrypt.
"""
import base64
import os
import uuid
from functools import lru_cache

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .config import settings

_NONCE = 12


def _master() -> AESGCM:
    key = base64.b64decode(settings.master_key)
    if len(key) != 32:
        raise RuntimeError("MASTER_KEY must be 32 bytes, base64-encoded.")
    return AESGCM(key)


_MASTER = _master()


def new_wrapped_key(conversation_id: uuid.UUID) -> bytes:
    data_key = AESGCM.generate_key(bit_length=256)
    nonce = os.urandom(_NONCE)
    return nonce + _MASTER.encrypt(nonce, data_key, conversation_id.bytes)


@lru_cache(maxsize=4096)
def _data_key(conversation_id: uuid.UUID, wrapped: bytes) -> AESGCM:
    key = _MASTER.decrypt(wrapped[:_NONCE], wrapped[_NONCE:], conversation_id.bytes)
    return AESGCM(key)


def encrypt(conversation_id: uuid.UUID, wrapped: bytes, text: str) -> tuple[bytes, bytes]:
    nonce = os.urandom(_NONCE)
    ct = _data_key(conversation_id, wrapped).encrypt(nonce, text.encode(), conversation_id.bytes)
    return nonce, ct


def decrypt(conversation_id: uuid.UUID, wrapped: bytes, nonce: bytes, ciphertext: bytes) -> str:
    return _data_key(conversation_id, wrapped).decrypt(nonce, ciphertext, conversation_id.bytes).decode()
