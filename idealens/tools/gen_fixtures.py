"""Creates sample users/ideas in a throw-away database and saves real API responses for tools/render_check.js."""
import sys, os, json
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import conftest
from fastapi.testclient import TestClient
from backend.main import app
c = TestClient(app)
def su(name, role="student", code=""):
    r = c.post("/api/auth/register", json={"name": name, "email": name.lower()+"@x.com", "password": "secret123", "role": role, "teacher_code": code}); assert r.status_code == 200, r.json()
    return {"Authorization": "Bearer " + r.json()["token"]}
T = su("Meena", "teacher", "teach-test"); S1 = su("Asha"); S2 = su("Ravi"); A = su("Boss", "admin", "adm-test")
I1 = {"title": "Smart Parking Finder", "description": "IoT sensors detect free parking slots and a mobile app guides drivers to the nearest space in a city."}
I2 = {"title": "Parking Slot Finder App", "description": "Sensors detect empty parking slots and a mobile app guides drivers to free space in the city."}
I3 = {"title": "Farm Voice Helper", "description": "A voice assistant for rural farmers that predicts crop prices using machine learning, with offline mode and regional languages."}
a1 = c.post("/api/analyze", json=I1, headers=S1).json()["id"]
c.post(f"/api/analyses/{a1}/submit", headers=S1)
b1 = c.post("/api/analyze", json=I2, headers=S2).json()["id"]; c.post(f"/api/analyses/{b1}/submit", headers=S2)
c.post(f"/api/teacher/ideas/{a1}/review", headers=T, json={"comment": "Needs a differentiator.", "grade": 6, "status": "needs_changes"})
a2 = c.post(f"/api/analyses/{a1}/revise", headers=S1, json={"title": I1["title"], "description": I1["description"] + " It predicts free slots using machine learning."}).json()["id"]
c.post(f"/api/analyses/{a1}/chat", headers=S1, json={"message": "What is the cost?"})
dr = c.post("/api/analyze", json=I3, headers=S1).json()["id"]
from backend.main import store
from backend import engine as _e
me = c.get("/api/auth/me", headers=S1).json()["id"]
_t = "Legacy idea"; _d = "IoT sensors detect free parking slots and a mobile app guides drivers in a city."
_old = {k: v for k, v in _e.analyze(_t, _d).items() if k not in ("sdgs", "reasons", "weights", "scoring_mode")}
store.add_analysis({"id": "old1", "user_id": me, "title": _t, "description": _d, "created_at": "2026-01-02T00:00:00+00:00", "report": _old})
store.add_analysis({"id": "old2", "user_id": me, "title": _t + " 2", "description": _d, "created_at": "2026-01-03T00:00:00+00:00", "status": "submitted", "student_name": "Asha", "report": _old})
a1_after = a1
fx = {"ids": {"a1": a1, "a2": a2, "draft": dr, "b1": b1, "old": "old1", "old2": "old2"}, "student": {}, "teacher": {}, "admin": {}}
def g(role, path, hdr, key=None): 
    r = c.get("/api" + path, headers=hdr); assert r.status_code == 200, (path, r.status_code, r.json()); fx[role][key or path] = r.json()
for p in ["/student/stats", "/analyses", f"/analyses/{a1}", f"/analyses/{a2}", f"/analyses/{dr}", f"/analyses/{a1}/versions", f"/analyses/{a2}/versions", f"/analyses/{dr}/versions", "/analyses/old1", "/analyses/old1/versions", "/notifications"]: g("student", p, S1)
for p in ["/teacher/stats", "/teacher/ideas", "/teacher/students", f"/teacher/ideas/{a1}", f"/teacher/ideas/{b1}", "/teacher/ideas/old2", "/notifications"]: g("teacher", p, T)
for p in ["/admin/overview", "/admin/users", "/admin/corpus", "/admin/calibration", "/notifications", "/teacher/stats", "/teacher/ideas"]: g("admin", p, A)
fx["improve"] = c.post(f"/api/analyses/{a1}/improve", headers=S1).json()
fx["chat"] = c.post(f"/api/analyses/{a1}/chat", headers=S1, json={"message": "How can I make it more unique?"}).json()
json.dump(fx, open(os.path.join(ROOT, "tools", "fixtures.json"), "w"))
print("fixtures ok:", {k: len(v) for k, v in fx.items() if isinstance(v, dict)}, fx["ids"])
