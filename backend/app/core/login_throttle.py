"""Thread-safe best-effort login throttling for the single-worker free tier.

This is process-local. Multiple workers require a shared edge/store limiter.
"""
from collections import deque
from threading import Lock
from time import monotonic

from fastapi import HTTPException

_WINDOW = 300
_lock = Lock()
_failures: dict[tuple[str, str], deque[float]] = {}


def keys_for(ip: str, email: str) -> tuple[tuple[str, str], tuple[str, str]]:
    return ("account", ip + ":" + email.strip().casefold()), ("ip", ip)


def check(keys: tuple[tuple[str, str], tuple[str, str]]) -> None:
    now = monotonic()
    with _lock:
        for key, limit in zip(keys, (8, 80)):
            history = _failures.get(key)
            if not history:
                continue
            while history and history[0] <= now - _WINDOW:
                history.popleft()
            if not history:
                del _failures[key]
            elif len(history) >= limit:
                raise HTTPException(
                    status_code=429,
                    detail="Too many login attempts. Try again later.",
                    headers={"Retry-After": str(_WINDOW)},
                )


def failed(keys: tuple[tuple[str, str], tuple[str, str]]) -> None:
    now = monotonic()
    with _lock:
        for key in keys:
            history = _failures.setdefault(key, deque())
            while history and history[0] <= now - _WINDOW:
                history.popleft()
            history.append(now)
        if len(_failures) > 8192:
            for key in list(_failures):
                if not _failures[key] or _failures[key][-1] <= now - _WINDOW:
                    del _failures[key]
            while len(_failures) > 8192:
                del _failures[next(iter(_failures))]


def succeeded(account_key: tuple[str, str]) -> None:
    with _lock:
        _failures.pop(account_key, None)
