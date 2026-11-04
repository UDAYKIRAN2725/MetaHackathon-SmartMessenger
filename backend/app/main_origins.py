from urllib.parse import urlparse

from .config import settings


def _variants(origin: str) -> set[str]:
    u = urlparse(origin)
    out = {origin.rstrip("/")}
    if u.hostname in ("localhost", "127.0.0.1"):
        port = f":{u.port}" if u.port else ""
        out |= {f"{u.scheme}://localhost{port}", f"{u.scheme}://127.0.0.1{port}"}
    return out


ALLOWED = _variants(settings.frontend_origin)


def origin_allowed(origin: str | None) -> bool:
    # No Origin header = not a browser cross-site request (curl, tests, same-origin GET).
    return origin is None or origin.rstrip("/") in ALLOWED
