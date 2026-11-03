"""Learn better score weights from reviewer grades (non-negative least squares, clipped to 5%-50%)."""
import numpy as np
from .engine import KEYS

MIN_SAMPLES = 8


def graded_rows(docs):
    rows = []
    for a in docs:
        grades = [r["grade"] for r in a.get("reviews", []) if r.get("grade") is not None]
        if grades:
            rows.append((a["report"].get("scores_rules") or a["report"]["scores"], grades[-1]))
    return rows


def suggest(docs, current):
    rows = graded_rows(docs)
    n = len(rows)
    if n < MIN_SAMPLES:
        return {"ok": False, "n": n, "needed": MIN_SAMPLES,
                "message": f"Need at least {MIN_SAMPLES} reviewed ideas with grades (have {n})."}
    X = np.array([[s[k] for k in KEYS] for s, _ in rows], float) / 100
    y = np.array([g for _, g in rows], float) / 10
    w, *_ = np.linalg.lstsq(X, y, rcond=None)
    w = np.clip(w, 0, None)
    if w.sum() <= 0:
        return {"ok": False, "n": n, "needed": MIN_SAMPLES, "message": "Grades do not correlate with the scores yet."}
    w = np.clip(w / w.sum(), 0.05, 0.5)
    w = w / w.sum()
    cur = np.array([current[k] for k in KEYS], float)

    def corr(pred):
        return round(float(np.corrcoef(pred, y)[0, 1]), 3) if np.std(pred) > 0 and np.std(y) > 0 else 0.0
    return {"ok": True, "n": n, "suggested": {k: round(float(v), 3) for k, v in zip(KEYS, w)},
            "current": {k: round(float(current[k]), 3) for k in KEYS},
            "corr_current": corr(X @ cur), "corr_suggested": corr(X @ w)}
