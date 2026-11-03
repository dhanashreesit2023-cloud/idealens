"""Tiny in-memory sliding-window rate limiter (per process)."""
import time
from collections import defaultdict, deque
from . import config

_hits = defaultdict(deque)


def hit(key, limit, window=60):
    """Record a request. Returns 0 if allowed, otherwise the number of seconds to wait."""
    if not config.RATE_LIMIT_ENABLED:
        return 0
    now = time.time()
    q = _hits[key]
    while q and q[0] <= now - window:
        q.popleft()
    if len(q) >= limit:
        return max(1, int(q[0] + window - now) + 1)
    q.append(now)
    return 0


def reset():
    _hits.clear()
