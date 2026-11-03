"""Pure helper functions (no web framework) that shape stored documents for each role."""
from collections import Counter

STATUSES = ("draft", "submitted", "under_review", "approved", "needs_changes")
REVIEW_STATUSES = ("under_review", "approved", "needs_changes")


def view_for(doc, user):
    """Full document for the viewer. Creators never see other people's names/titles; chat stays private."""
    out = dict(doc)
    out["status"] = doc.get("status", "draft")
    out["reviews"] = doc.get("reviews", [])
    out["version"] = doc.get("version", 1)
    out["idea_id"] = doc.get("idea_id", doc["id"])
    cm = doc.get("college_matches", [])
    if user.get("role") in ("teacher", "admin"):
        out["college_matches"] = cm
        out.pop("chat", None)
    else:
        out.pop("college_matches", None)
        out["chat"] = doc.get("chat", [])
        out["duplicate_warning"] = {"count": len(cm), "top": cm[0]["similarity"] if cm else 0}
    return out


def summary(a, teacher=False):
    reviews, cm = a.get("reviews", []), a.get("college_matches", [])
    row = {"id": a["id"], "title": a["title"], "created_at": a["created_at"],
           "overall": a["report"]["scores"]["overall"], "verdict": a["report"]["verdict"],
           "status": a.get("status", "draft"), "reviews": len(reviews),
           "kind": a.get("kind", "general"),
           "grade": next((r["grade"] for r in reversed(reviews) if r.get("grade") is not None), None)}
    if teacher:
        row.update({"student_name": a.get("student_name", ""), "domains": a["report"].get("domains", []),
                    "duplicate": cm[0]["similarity"] if cm else 0})
    return row


def version_rows(docs, idea_id):
    rows = sorted((summary(a) for a in docs if a.get("idea_id", a["id"]) == idea_id), key=lambda r: r["version"])
    prev = None
    for r in rows:
        r["delta"] = None if prev is None else r["overall"] - prev
        prev = r["overall"]
    return rows


def teacher_stats(all_docs):
    subs = [a for a in all_docs if a.get("status", "draft") != "draft"]
    by = Counter(a.get("status") for a in subs)
    scores = [a["report"]["scores"]["overall"] for a in subs]
    dom = Counter(d for a in subs for d in a["report"].get("domains", []))
    dist = {"0-44": 0, "45-59": 0, "60-74": 0, "75-100": 0}
    for v in scores:
        dist["0-44" if v < 45 else "45-59" if v < 60 else "60-74" if v < 75 else "75-100"] += 1
    top = sorted(subs, key=lambda a: -a["report"]["scores"]["overall"])[:5]
    tl = Counter((a.get("submitted_at") or a["created_at"])[:10] for a in subs)
    by_dom = {}
    for a in subs:
        for d in a["report"].get("domains", []):
            by_dom.setdefault(d, []).append(a["report"]["scores"]["overall"])
    domain_scores = [{"name": n, "average": round(sum(v) / len(v)), "count": len(v)}
                     for n, v in sorted(by_dom.items(), key=lambda x: -len(x[1]))[:6]]
    return {"total": len(subs), "awaiting": by.get("submitted", 0), "under_review": by.get("under_review", 0),
            "approved": by.get("approved", 0), "needs_changes": by.get("needs_changes", 0),
            "average": round(sum(scores) / len(scores)) if scores else 0,
            "domains": [{"name": n, "count": c} for n, c in dom.most_common(6)],
            "distribution": dist, "top": [summary(a, True) for a in top],
            "timeline": [{"date": d, "count": c} for d, c in sorted(tl.items())[-14:]],
            "domain_scores": domain_scores}


def student_stats(docs):
    """docs: one creator's analyses, newest first."""
    by = Counter(a.get("status", "draft") for a in docs)
    scores = [a["report"]["scores"]["overall"] for a in docs]
    best = max(docs, key=lambda a: a["report"]["scores"]["overall"]) if docs else None
    return {"total": len(docs), "draft": by.get("draft", 0), "submitted": by.get("submitted", 0),
            "under_review": by.get("under_review", 0), "approved": by.get("approved", 0),
            "needs_changes": by.get("needs_changes", 0),
            "average": round(sum(scores) / len(scores)) if scores else 0,
            "best": summary(best) if best else None, "recent": [summary(a) for a in docs[:3]]}


def teacher_students(all_docs):
    groups = {}
    for a in all_docs:
        if a.get("status", "draft") == "draft":
            continue
        g = groups.setdefault(a["user_id"], {"name": a.get("student_name", "Creator"), "ideas": 0,
                                             "approved": 0, "needs_changes": 0, "scores": [], "last": ""})
        g["ideas"] += 1
        g["approved"] += int(a.get("status") == "approved")
        g["needs_changes"] += int(a.get("status") == "needs_changes")
        g["scores"].append(a["report"]["scores"]["overall"])
        g["last"] = max(g["last"], a.get("submitted_at") or a["created_at"])
    out = [{"name": g["name"], "ideas": g["ideas"], "approved": g["approved"], "needs_changes": g["needs_changes"],
            "average": round(sum(g["scores"]) / len(g["scores"])), "last": g["last"]} for g in groups.values()]
    return sorted(out, key=lambda x: (-x["ideas"], x["name"]))


def admin_stats(users, analyses, custom_corpus, base_corpus):
    roles = Counter(u.get("role", "student") for u in users)
    st = Counter(a.get("status", "draft") for a in analyses)
    return {"users": len(users), "creators": roles.get("student", 0), "reviewers": roles.get("teacher", 0),
            "admins": roles.get("admin", 0), "analyses": len(analyses), "submitted": len(analyses) - st.get("draft", 0),
            "drafts": st.get("draft", 0), "dataset_base": base_corpus, "dataset_custom": len(custom_corpus)}
