"""End-to-end API tests (need fastapi + httpx installed)."""
import datetime as dt, hashlib, uuid
from fastapi.testclient import TestClient
from backend.main import app, store

c = TestClient(app)
TAG = uuid.uuid4().hex[:6]
IDEA = {"title": "Smart Parking Finder", "description": "IoT sensors detect free parking slots and a mobile app guides drivers to the nearest space in a city."}
IDEA2 = {"title": "Parking Slot Finder App", "description": "Sensors detect empty parking slots and a mobile app guides drivers to free space in the city."}


def signup(name, role="student", code=""):
    r = c.post("/api/auth/register", json={"name": name, "email": f"{name.lower()}_{TAG}@example.com", "password": "secret123", "role": role, "teacher_code": code})
    assert r.status_code == 200, r.text
    return {"Authorization": "Bearer " + r.json()["token"]}, r.json()["user"]


def test_static_and_pwa_files():
    assert c.get("/api/health").json()["status"] == "ok"
    assert c.get("/").status_code == 200
    assert c.get("/static/js/app.js").status_code == 200
    assert c.get("/sw.js").status_code == 200 and c.get("/manifest.webmanifest").status_code == 200


def test_auth_rules():
    assert c.post("/api/auth/register", json={"name": "Bad", "email": f"bad_{TAG}@x.com", "password": "secret123", "role": "teacher", "teacher_code": "nope"}).status_code == 403
    assert c.post("/api/auth/register", json={"name": "Bad", "email": f"bad2_{TAG}@x.com", "password": "secret123", "role": "admin", "teacher_code": "nope"}).status_code == 403
    signup("Dup"); assert c.post("/api/auth/register", json={"name": "Dup", "email": f"dup_{TAG}@example.com", "password": "secret123"}).status_code == 409
    assert c.post("/api/auth/login", json={"email": f"dup_{TAG}@example.com", "password": "wrong"}).status_code == 401
    assert c.get("/api/analyses").status_code == 401


def test_full_review_workflow():
    th, _ = signup("Meena", "teacher", "teach-test")
    sh, su = signup("Asha")
    rh, _ = signup("Ravi")

    d = c.post("/api/analyze", json=IDEA, headers=sh); assert d.status_code == 200, d.text
    aid = d.json()["id"]; assert d.json()["status"] == "draft"
    assert c.post("/api/analyze", json={"title": "x", "description": "short"}, headers=sh).status_code == 422
    assert c.get(f"/api/analyses/{aid}", headers=rh).status_code == 404            # private draft
    assert c.get("/api/teacher/stats", headers=sh).status_code == 403              # role check
    assert c.get(f"/api/teacher/ideas/{aid}", headers=th).status_code == 404       # drafts hidden

    assert c.post(f"/api/analyses/{aid}/submit", headers=sh).json()["status"] == "submitted"
    assert c.post(f"/api/analyses/{aid}/submit", headers=sh).status_code == 409
    assert c.delete(f"/api/analyses/{aid}", headers=sh).status_code == 409
    assert c.get("/api/notifications", headers=th).json()["unread"] >= 1           # reviewer notified

    b = c.post("/api/analyze", json=IDEA2, headers=rh).json()["id"]
    sub = c.post(f"/api/analyses/{b}/submit", headers=rh).json()
    assert "college_matches" not in sub and sub["duplicate_warning"]["count"] >= 1
    assert c.get(f"/api/teacher/ideas/{b}", headers=th).json()["college_matches"]

    r = c.post(f"/api/teacher/ideas/{aid}/review", headers=th, json={"comment": "Add a differentiator.", "grade": 5, "status": "needs_changes"})
    assert r.status_code == 200, r.text
    assert c.post(f"/api/teacher/ideas/{aid}/review", headers=sh, json={"comment": "hi", "status": "approved"}).status_code == 403
    mine = c.get(f"/api/analyses/{aid}", headers=sh).json()
    assert mine["status"] == "needs_changes" and mine["reviews"][0]["grade"] == 5
    assert c.get("/api/notifications", headers=sh).json()["unread"] >= 1           # creator notified
    assert c.post("/api/notifications/read", headers=sh).status_code == 200
    assert c.get("/api/notifications", headers=sh).json()["unread"] == 0
    assert c.post(f"/api/analyses/{aid}/submit", headers=sh).json()["status"] == "submitted"   # resubmit

    # versions, improver, chat, PDF
    v2 = c.post(f"/api/analyses/{aid}/revise", headers=sh, json={"title": IDEA["title"], "description": IDEA["description"] + " It also predicts free slots with machine learning."})
    assert v2.status_code == 200 and v2.json()["version"] == 2
    assert len(c.get(f"/api/analyses/{aid}/versions", headers=sh).json()) >= 2
    imp = c.post(f"/api/analyses/{aid}/improve", headers=sh).json(); assert "before" in imp and "after" in imp
    ch = c.post(f"/api/analyses/{aid}/chat", headers=sh, json={"message": "What is the cost?"}).json()
    assert ch["reply"] and len(ch["chat"]) == 2
    pdf = c.get(f"/api/analyses/{aid}/pdf", headers=sh)
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    assert c.get("/api/student/stats", headers=sh).json()["total"] >= 2
    assert len(c.get("/api/teacher/ideas", headers=th).json()) >= 2


def test_password_change_and_reset():
    h, u = signup("Resetter")
    assert c.post("/api/auth/password", headers=h, json={"current_password": "nope", "new_password": "newpass1"}).status_code == 400
    assert c.post("/api/auth/password", headers=h, json={"current_password": "secret123", "new_password": "newpass1"}).status_code == 200
    assert c.post("/api/auth/forgot", json={"email": f"resetter_{TAG}@example.com"}).json()["ok"]
    assert c.post("/api/auth/forgot", json={"email": "nobody@example.com"}).json()["ok"]       # no account enumeration
    exp = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=30)).isoformat()
    store.update_user(u["id"], {"reset": {"hash": hashlib.sha256(b"abc12345").hexdigest(), "exp": exp}})
    assert c.post("/api/auth/reset", json={"email": u["email"], "code": "wrong", "new_password": "again123"}).status_code == 400
    assert c.post("/api/auth/reset", json={"email": u["email"], "code": "abc12345", "new_password": "again123"}).status_code == 200
    assert c.post("/api/auth/login", json={"email": u["email"], "password": "again123"}).status_code == 200


def test_admin_features():
    ah, _ = signup("Boss", "admin", "adm-test")
    sh, su = signup("Member")
    assert c.get("/api/admin/overview", headers=sh).status_code == 403
    assert c.get("/api/admin/overview", headers=ah).status_code == 200
    assert any(u["email"] == su["email"] for u in c.get("/api/admin/users", headers=ah).json())
    item = {"title": "Test reference project", "domain": "General", "description": "A reference project description that is long enough."}
    before = c.get("/api/admin/corpus", headers=ah).json()
    added = c.post("/api/admin/corpus", headers=ah, json={"items": [item]}).json(); assert added["added"] == 1
    cid = c.get("/api/admin/corpus", headers=ah).json()["custom"][-1]["id"]
    assert c.delete(f"/api/admin/corpus/{cid}", headers=ah).status_code == 200
    assert c.get("/api/admin/calibration", headers=ah).status_code == 200
    assert c.post(f"/api/admin/users/{su['id']}/reset-password", headers=ah).json()["temporary_password"]


def test_legacy_records_still_work():
    """Reports saved by older versions (missing newer fields) must not crash any endpoint."""
    from backend import engine
    h, u = signup("Legacy")
    t, d = "Legacy idea", "IoT sensors detect free parking slots and a mobile app guides drivers in a city."
    rep = {k: v for k, v in engine.analyze(t, d).items() if k not in ("sdgs", "reasons", "weights", "scoring_mode")}
    aid = "legacy-" + TAG
    store.add_analysis({"id": aid, "user_id": u["id"], "title": t, "description": d, "created_at": "2026-01-02T00:00:00+00:00", "report": rep})
    for path in (f"/api/analyses/{aid}", f"/api/analyses/{aid}/versions", "/api/analyses", "/api/student/stats"):
        assert c.get(path, headers=h).status_code == 200, path
    pdf = c.get(f"/api/analyses/{aid}/pdf", headers=h)
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    assert c.post(f"/api/analyses/{aid}/chat", headers=h, json={"message": "how long will it take?"}).status_code == 200
    assert c.post(f"/api/analyses/{aid}/improve", headers=h).status_code == 200
