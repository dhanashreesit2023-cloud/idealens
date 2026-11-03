import hashlib, hmac, re, secrets, uuid, datetime as dt
from typing import List, Optional
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import calibrate, config, engine, llm, mentor, notify, pdfreport, ratelimit
from .auth import current_user_factory, hash_password, make_token, verify_password
from .db import get_store
from .views import REVIEW_STATUSES, student_stats, summary, teacher_stats, teacher_students, view_for

store = get_store()
current_user = current_user_factory(store)

app = FastAPI(title="IdeaLens API", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
ROLES = ("student", "teacher", "admin")


def startup_load():
    """Load admin-added corpus and calibrated weights from the database."""
    try:
        engine.reload_corpus(store.list_corpus())
        w = store.get_setting("weights")
        if w:
            engine.set_weights(w)
    except Exception as e:
        print("[IdeaLens] startup settings not loaded:", e)


startup_load()


# ------------------------------------------------------------------ helpers
def limiter(name, limit, window=60):
    def dep(request: Request):
        fwd = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
        ip = fwd or (request.client.host if request.client else "unknown")
        wait = ratelimit.hit(f"{name}:{ip}", limit, window)
        if wait:
            raise HTTPException(429, f"Too many requests. Please wait {wait} seconds and try again.")
    return dep


rl_auth, rl_analyze, rl_chat = limiter("auth", 60), limiter("analyze", 40), limiter("chat", 60)


def reviewer_only(user=Depends(current_user)):
    if user.get("role") not in ("teacher", "admin"):
        raise HTTPException(403, "Reviewer access only.")
    return user


def admin_only(user=Depends(current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access only.")
    return user


def norm_ws(s):
    return " ".join((s or "").split())[:60] or "General"


def ws_key(s):
    return norm_ws(s).lower()


def scope(user, docs):
    """Reviewers see their own workspace only; admins see everything."""
    if user.get("role") == "admin":
        return docs
    return [a for a in docs if ws_key(a.get("workspace")) == ws_key(user.get("workspace"))]


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def public(u):
    return {"id": u["id"], "name": u["name"], "email": u["email"], "role": u.get("role", "student"),
            "workspace": u.get("workspace", "General")}


def make_report(title, description, domain=None):
    report = engine.analyze(title, description, domain)
    report["mentor_feedback"] = llm.mentor_feedback(title, description, report)
    scored = llm.score_with_reasons(title, description, report)
    if scored:
        engine.blend_llm(report, scored)
    return report


def new_doc(user, title, description, report, idea_id=None, version=1, parent=None):
    did = uuid.uuid4().hex
    return {"id": did, "idea_id": idea_id or did, "version": version, "parent_id": parent, "user_id": user["id"],
            "student_name": user["name"], "workspace": user.get("workspace", "General"), "title": title,
            "description": description, "created_at": now(), "status": "draft", "reviews": [],
            "college_matches": [], "chat": [], "report": report}


def own(user, aid):
    a = store.get_analysis(aid, user["id"])
    if not a:
        raise HTTPException(404, "Report not found.")
    return a


# ------------------------------------------------------------------ models
class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    email: str = Field(min_length=5, max_length=120)
    password: str = Field(min_length=6, max_length=100)
    role: str = "student"
    teacher_code: str = ""
    workspace: str = ""


class LoginIn(BaseModel):
    email: str
    password: str


class ProfileIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    workspace: str = Field(default="", max_length=60)


class PasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=100)


class ForgotIn(BaseModel):
    email: str


class ResetIn(BaseModel):
    email: str
    code: str
    new_password: str = Field(min_length=6, max_length=100)


class IdeaIn(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(min_length=20, max_length=4000)
    domain: str = ""


class ReviewIn(BaseModel):
    comment: str = Field(min_length=2, max_length=1000)
    grade: Optional[int] = Field(default=None, ge=0, le=10)
    status: str = "under_review"


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=500)


class RoleIn(BaseModel):
    role: str


class CorpusItem(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    domain: str = Field(default="", max_length=60)
    description: str = Field(min_length=20, max_length=1000)


class CorpusIn(BaseModel):
    items: List[CorpusItem] = Field(min_length=1, max_length=500)


# ------------------------------------------------------------------ auth
@app.post("/api/auth/register", dependencies=[Depends(rl_auth)])
def register(body: RegisterIn):
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "Please enter a valid email address.")
    if body.role not in ROLES:
        raise HTTPException(400, "Invalid role.")
    code = body.teacher_code.strip()
    if body.role == "teacher" and not hmac.compare_digest(code, config.TEACHER_CODE):
        raise HTTPException(403, "Invalid reviewer access code.")
    if body.role == "admin":
        if not config.ADMIN_CODE:
            raise HTTPException(403, "Admin sign-up is disabled. Set ADMIN_CODE on the server to enable it.")
        if not hmac.compare_digest(code, config.ADMIN_CODE):
            raise HTTPException(403, "Invalid admin access code.")
    user = {"id": uuid.uuid4().hex, "name": body.name.strip(), "email": email, "role": body.role,
            "workspace": norm_ws(body.workspace), "password": hash_password(body.password), "created_at": now()}
    if not store.add_user(user):
        raise HTTPException(409, "An account with this email already exists.")
    return {"token": make_token(user["id"]), "user": public(user)}


@app.post("/api/auth/login", dependencies=[Depends(rl_auth)])
def login(body: LoginIn):
    user = store.user_by_email(body.email.strip().lower())
    if not user or not verify_password(body.password, user["password"]):
        raise HTTPException(401, "Incorrect email or password.")
    return {"token": make_token(user["id"]), "user": public(user)}


@app.get("/api/auth/me")
def me(user=Depends(current_user)):
    return public(user)


@app.put("/api/auth/profile")
def update_profile(body: ProfileIn, user=Depends(current_user)):
    name, ws = body.name.strip(), norm_ws(body.workspace)
    store.update_user(user["id"], {"name": name, "workspace": ws})
    for a in store.list_analyses(user["id"]):
        store.update_analysis(a["id"], {"student_name": name, "workspace": ws})
    return public(store.user_by_id(user["id"]))


@app.post("/api/auth/password", dependencies=[Depends(rl_auth)])
def change_password(body: PasswordIn, user=Depends(current_user)):
    if not verify_password(body.current_password, user["password"]):
        raise HTTPException(400, "Current password is incorrect.")
    store.update_user(user["id"], {"password": hash_password(body.new_password)})
    return {"ok": True}


@app.post("/api/auth/forgot", dependencies=[Depends(rl_auth)])
def forgot(body: ForgotIn):
    user = store.user_by_email(body.email.strip().lower())
    if user:
        code = secrets.token_hex(4)
        exp = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=30)).isoformat()
        store.update_user(user["id"], {"reset": {"hash": hashlib.sha256(code.encode()).hexdigest(), "exp": exp}})
        if notify.email_enabled():
            notify.send_email(user["email"], "IdeaLens password reset", f"Your reset code is {code}. It expires in 30 minutes.")
        else:
            print(f"[IdeaLens] Password reset code for {user['email']}: {code}  (e-mail is not configured)")
    return {"ok": True, "message": "If that email is registered, a reset code has been sent. Ask your admin if e-mail is not set up."}


@app.post("/api/auth/reset", dependencies=[Depends(rl_auth)])
def reset(body: ResetIn):
    user = store.user_by_email(body.email.strip().lower())
    r = (user or {}).get("reset")
    ok = bool(r) and hmac.compare_digest(r["hash"], hashlib.sha256(body.code.strip().encode()).hexdigest()) \
        and r["exp"] > now()
    if not ok:
        raise HTTPException(400, "Invalid or expired reset code.")
    store.update_user(user["id"], {"password": hash_password(body.new_password), "reset": None})
    return {"ok": True}


# ------------------------------------------------------------------ notifications
@app.get("/api/notifications")
def notifications(user=Depends(current_user)):
    rows = store.list_notifications(user["id"])
    return {"unread": sum(1 for n in rows if not n.get("read")), "items": rows}


@app.post("/api/notifications/read")
def notifications_read(user=Depends(current_user)):
    store.mark_read(user["id"])
    return {"ok": True}


# ------------------------------------------------------------------ creator: analyse + manage
@app.get("/api/student/stats")
def s_stats(user=Depends(current_user)):
    return student_stats(store.list_analyses(user["id"]))


@app.post("/api/analyze", dependencies=[Depends(rl_analyze)])
def analyze(body: IdeaIn, user=Depends(current_user)):
    try:
        report = make_report(body.title.strip(), body.description.strip(), body.domain.strip() or None)
    except Exception as e:  # never leak a stack trace to the UI
        print("[IdeaLens] analysis error:", e)
        raise HTTPException(500, "Analysis failed. Please try again with a more detailed description.")
    doc = new_doc(user, body.title.strip(), body.description.strip(), report)
    store.add_analysis(doc)
    return view_for(doc, user)


@app.get("/api/analyses")
def list_analyses(user=Depends(current_user)):
    return [summary(a) for a in store.list_analyses(user["id"])]


@app.get("/api/analyses/{aid}")
def get_analysis(aid: str, user=Depends(current_user)):
    return view_for(own(user, aid), user)


@app.get("/api/analyses/{aid}/versions")
def versions(aid: str, user=Depends(current_user)):
    a = own(user, aid)
    iid = a.get("idea_id", a["id"])
    rows = [x for x in store.list_analyses(user["id"]) if x.get("idea_id", x["id"]) == iid]
    rows.sort(key=lambda x: x.get("version", 1))
    return [{"id": x["id"], "version": x.get("version", 1), "title": x["title"], "created_at": x["created_at"],
             "status": x.get("status", "draft"), "scores": x["report"]["scores"]} for x in rows]


@app.post("/api/analyses/{aid}/revise", dependencies=[Depends(rl_analyze)])
def revise(aid: str, body: IdeaIn, user=Depends(current_user)):
    base = own(user, aid)
    iid = base.get("idea_id", base["id"])
    nxt = 1 + max(x.get("version", 1) for x in store.list_analyses(user["id"]) if x.get("idea_id", x["id"]) == iid)
    report = make_report(body.title.strip(), body.description.strip(), body.domain.strip() or None)
    doc = new_doc(user, body.title.strip(), body.description.strip(), report, iid, nxt, base["id"])
    store.add_analysis(doc)
    return view_for(doc, user)


@app.post("/api/analyses/{aid}/improve", dependencies=[Depends(rl_analyze)])
def improve(aid: str, user=Depends(current_user)):
    a = own(user, aid)
    rewrite = llm.rewrite(a["title"], a["description"], a["report"])
    return {"title": a["title"], **engine.improve(a["title"], a["description"], None, rewrite)}


@app.post("/api/analyses/{aid}/chat", dependencies=[Depends(rl_chat)])
def chat(aid: str, body: ChatIn, user=Depends(current_user)):
    a = own(user, aid)
    history = a.get("chat", [])
    msg = body.message.strip()
    reply = llm.chat(a, history, msg) or mentor.answer(a, msg)
    stamp = now()
    history = (history + [{"role": "user", "text": msg, "at": stamp}, {"role": "mentor", "text": reply, "at": stamp}])[-40:]
    store.update_analysis(aid, {"chat": history})
    return {"reply": reply, "chat": history}


@app.post("/api/analyses/{aid}/submit")
def submit_for_review(aid: str, user=Depends(current_user)):
    a = own(user, aid)
    if a.get("status", "draft") not in ("draft", "needs_changes"):
        raise HTTPException(409, "This idea is already with your reviewers.")
    ws = ws_key(user.get("workspace"))
    others = [{"id": x["id"], "title": x["title"], "student_name": x.get("student_name", ""),
               "text": f"{x['title']}. {x['description']}"}
              for x in store.all_analyses()
              if x.get("status", "draft") != "draft" and x["user_id"] != user["id"]
              and x.get("idea_id", x["id"]) != a.get("idea_id", a["id"]) and ws_key(x.get("workspace")) == ws]
    matches = engine.college_matches(f"{a['title']}. {a['description']}", others)
    store.update_analysis(aid, {"status": "submitted", "college_matches": matches, "submitted_at": now()})
    for u in store.all_users():
        if u.get("role") == "teacher" and ws_key(u.get("workspace")) == ws:
            notify.push(store, u["id"], "New idea submitted", f"{user['name']} submitted '{a['title']}' for review.", f"/t/idea/{aid}/review")
    return view_for(store.get_analysis(aid, user["id"]), user)


@app.delete("/api/analyses/{aid}")
def delete_analysis(aid: str, user=Depends(current_user)):
    a = own(user, aid)
    if a.get("status", "draft") in ("submitted", "under_review", "approved"):
        raise HTTPException(409, "Submitted ideas can't be deleted.")
    store.delete_analysis(aid, user["id"])
    return {"ok": True}


@app.get("/api/analyses/{aid}/pdf")
def pdf(aid: str, user=Depends(current_user)):
    a = store.get_analysis(aid, user["id"])
    if not a and user.get("role") in ("teacher", "admin"):
        a = store.get_analysis_any(aid)
        if a and (a.get("status", "draft") == "draft" or not scope(user, [a])):
            a = None
    if not a:
        raise HTTPException(404, "Report not found.")
    data = pdfreport.build_pdf(pdfreport.report_blocks(view_for(a, user)))
    slug = re.sub(r"[^a-z0-9]+", "-", a["title"].lower()).strip("-")[:40] or "report"
    return Response(content=data, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="idealens-{slug}.pdf"'})


# ------------------------------------------------------------------ reviewer (teacher / mentor / manager)
def reviewable(user):
    return [a for a in scope(user, store.all_analyses()) if a.get("status", "draft") != "draft"]


@app.get("/api/teacher/stats")
def t_stats(user=Depends(reviewer_only)):
    return teacher_stats(reviewable(user))


@app.get("/api/teacher/students")
def t_students(user=Depends(reviewer_only)):
    return teacher_students(reviewable(user))


@app.get("/api/teacher/ideas")
def t_ideas(user=Depends(reviewer_only)):
    rows = reviewable(user)
    rows.sort(key=lambda a: a.get("submitted_at", a["created_at"]), reverse=True)
    return [summary(a, True) for a in rows]


def reviewer_doc(user, aid):
    a = store.get_analysis_any(aid)
    if not a or a.get("status", "draft") == "draft" or not scope(user, [a]):
        raise HTTPException(404, "Idea not found.")
    return a


@app.get("/api/teacher/ideas/{aid}")
def t_idea(aid: str, user=Depends(reviewer_only)):
    return view_for(reviewer_doc(user, aid), user)


@app.post("/api/teacher/ideas/{aid}/review")
def t_review(aid: str, body: ReviewIn, user=Depends(reviewer_only)):
    if body.status not in REVIEW_STATUSES:
        raise HTTPException(400, "Status must be under_review, approved or needs_changes.")
    a = reviewer_doc(user, aid)
    review = {"id": uuid.uuid4().hex, "teacher_id": user["id"], "teacher_name": user["name"],
              "comment": body.comment.strip(), "grade": body.grade, "status": body.status, "created_at": now()}
    store.add_review(aid, review, body.status)
    label = body.status.replace("_", " ")
    notify.push(store, a["user_id"], f"Your idea was reviewed: {label}", f"{user['name']} reviewed '{a['title']}'. {body.comment.strip()[:160]}", f"/s/report/{aid}/feedback")
    return view_for(store.get_analysis_any(aid), user)


# ------------------------------------------------------------------ admin
@app.get("/api/admin/overview")
def a_overview(user=Depends(admin_only)):
    users, docs = store.all_users(), store.all_analyses()
    roles = {r: sum(1 for u in users if u.get("role", "student") == r) for r in ROLES}
    return {"users": len(users), "roles": roles, "ideas": len(docs),
            "submitted": sum(1 for a in docs if a.get("status", "draft") != "draft"),
            "workspaces": len({ws_key(u.get("workspace")) for u in users}), "corpus": len(engine.CORPUS),
            "database": store.kind, "similarity": engine.SIM.mode, "llm": llm.enabled(),
            "email": notify.email_enabled(), "weights": engine.WEIGHTS}


@app.get("/api/admin/users")
def a_users(user=Depends(admin_only)):
    counts = {}
    for a in store.all_analyses():
        counts[a["user_id"]] = counts.get(a["user_id"], 0) + 1
    return [{**public(u), "created_at": u.get("created_at", ""), "ideas": counts.get(u["id"], 0)}
            for u in sorted(store.all_users(), key=lambda u: u.get("created_at", ""), reverse=True)]


@app.put("/api/admin/users/{uid}/role")
def a_role(uid: str, body: RoleIn, user=Depends(admin_only)):
    if body.role not in ROLES:
        raise HTTPException(400, "Invalid role.")
    if uid == user["id"] and body.role != "admin":
        raise HTTPException(400, "You can't remove your own admin role.")
    if not store.update_user(uid, {"role": body.role}):
        raise HTTPException(404, "User not found.")
    return {"ok": True}


@app.post("/api/admin/users/{uid}/reset-password")
def a_reset_pw(uid: str, user=Depends(admin_only)):
    target = store.user_by_id(uid)
    if not target:
        raise HTTPException(404, "User not found.")
    temp = secrets.token_urlsafe(8)
    store.update_user(uid, {"password": hash_password(temp)})
    return {"temporary_password": temp}


@app.get("/api/admin/corpus")
def a_corpus(user=Depends(admin_only)):
    return {"bundled": len(engine.SEED), "custom": store.list_corpus()}


@app.post("/api/admin/corpus")
def a_corpus_add(body: CorpusIn, user=Depends(admin_only)):
    items = [{"id": "c" + uuid.uuid4().hex[:10], "title": i.title.strip(), "domain": i.domain.strip() or "General",
              "description": i.description.strip(), "source": "custom"} for i in body.items]
    store.add_corpus(items)
    return {"added": len(items), "total": engine.reload_corpus(store.list_corpus())}


@app.delete("/api/admin/corpus/{cid}")
def a_corpus_del(cid: str, user=Depends(admin_only)):
    if not store.delete_corpus(cid):
        raise HTTPException(404, "Item not found.")
    return {"total": engine.reload_corpus(store.list_corpus())}


@app.get("/api/admin/calibration")
def a_calibration(user=Depends(admin_only)):
    return calibrate.suggest([a for a in store.all_analyses() if a.get("status", "draft") != "draft"], engine.WEIGHTS)


@app.post("/api/admin/calibration/apply")
def a_calibration_apply(user=Depends(admin_only)):
    res = calibrate.suggest([a for a in store.all_analyses() if a.get("status", "draft") != "draft"], engine.WEIGHTS)
    if not res["ok"]:
        raise HTTPException(400, res["message"])
    store.set_setting("weights", res["suggested"])
    return {"weights": engine.set_weights(res["suggested"])}


@app.post("/api/admin/calibration/reset")
def a_calibration_reset(user=Depends(admin_only)):
    store.set_setting("weights", None)
    return {"weights": engine.set_weights(None)}


# ------------------------------------------------------------------ system + frontend
@app.get("/api/health")
def health():
    return {"status": "ok", "database": store.kind, "similarity": engine.SIM.mode, "llm": llm.enabled(),
            "email": notify.email_enabled(), "corpus_size": len(engine.CORPUS), "version": app.version}


app.mount("/static", StaticFiles(directory=str(config.FRONTEND_DIR)), name="static")


@app.get("/sw.js", include_in_schema=False)
def service_worker():
    return FileResponse(config.FRONTEND_DIR / "sw.js", media_type="application/javascript", headers={"Service-Worker-Allowed": "/"})


@app.get("/manifest.webmanifest", include_in_schema=False)
def manifest():
    return FileResponse(config.FRONTEND_DIR / "manifest.webmanifest", media_type="application/manifest+json")


@app.get("/", include_in_schema=False)
def index():
    return FileResponse(config.FRONTEND_DIR / "index.html")
