"""Optional LLM features (Anthropic API, stdlib only). Every function returns None on any problem."""
import json, urllib.request
from . import config
from .engine import KEYS


def enabled():
    return bool(config.ANTHROPIC_API_KEY)


def _call(prompt, max_tokens=500, system=None):
    if not enabled():
        return None
    payload = {"model": config.LLM_MODEL, "max_tokens": max_tokens, "messages": [{"role": "user", "content": prompt}]}
    if system:
        payload["system"] = system
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages", data=json.dumps(payload).encode(), method="POST",
        headers={"content-type": "application/json", "x-api-key": config.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read().decode())
        return "".join(b.get("text", "") for b in data.get("content", [])).strip() or None
    except Exception as e:
        print(f"[IdeaLens] LLM call failed: {e}")
        return None


def _json(text):
    if not text:
        return None
    try:
        return json.loads(text[text.index("{"): text.rindex("}") + 1])
    except Exception:
        return None


def mentor_feedback(title, description, report):
    s = report["scores"]
    top = report["similar"][0]["title"] if report["similar"] else "none found"
    return _call("You are a concise project mentor. In under 130 words give honest feedback on this idea: biggest strength, "
                 f"biggest weakness and one next step.\nTitle: {title}\nDescription: {description}\n"
                 f"Scores (0-100): originality {s['originality']}, innovation {s['innovation']}, feasibility {s['feasibility']}, "
                 f"impact {s['impact']}. Closest existing project: {top}.")


def score_with_reasons(title, description, report):
    """Independent LLM scoring. Returns {originality..relevance (0-100 ints), reasons{...}} or None."""
    top = ", ".join(f"{x['title']} ({x['similarity']}%)" for x in report["similar"][:3]) or "none"
    out = _json(_call(
        "Score this project idea from 0-100 on originality, innovation, feasibility, impact and relevance. "
        f"Known similar projects: {top}. Reply with ONLY JSON like "
        '{"originality":70,"innovation":65,"feasibility":60,"impact":55,"relevance":70,'
        '"reasons":{"originality":"one short sentence","innovation":"...","feasibility":"...","impact":"...","relevance":"..."}}\n'
        f"Title: {title}\nDescription: {description}", 500))
    try:
        res = {k: max(0, min(100, int(out[k]))) for k in KEYS}
        res["reasons"] = {k: str(v) for k, v in (out.get("reasons") or {}).items()}
        return res
    except Exception:
        return None


def rewrite(title, description, report):
    """Improved version of the idea description (<= 1200 chars) or None."""
    tips = "; ".join(report["suggestions"][:3])
    t = _call("Rewrite this project idea description to be clearer and more innovative, applying these suggestions: "
              f"{tips}. Keep it under 150 words, plain text, no title, no preamble.\nTitle: {title}\nDescription: {description}", 450)
    return t[:1200] if t else None


def chat(doc, history, message):
    r, s = doc["report"], doc["report"]["scores"]
    ctx = (f"Idea: {doc['title']} - {doc['description'][:600]}\nScores: " + ", ".join(f"{k} {s[k]}" for k in KEYS + ['overall']) +
           f"\nTop risks: {'; '.join(x['category'] + ' ' + x['level'] for x in r['risks'][:4])}\n"
           f"Suggestions: {'; '.join(r['suggestions'][:3])}\nCost: {r['cost']['estimate']}; about {r['time_weeks']} weeks.")
    hist = "\n".join(f"{m['role']}: {m['text']}" for m in history[-6:])
    return _call(f"{ctx}\n\nConversation so far:\n{hist}\n\nUser: {message}\n\nAnswer helpfully in under 120 words.",
                 350, system="You are IdeaLens, a practical mentor who helps people refine project ideas. Be concise and specific.")
