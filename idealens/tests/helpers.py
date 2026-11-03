from backend import engine

IDEA = ("Smart Crop Advisor", "A mobile app for rural farmers that uses soil sensors and weather forecasts "
        "with machine learning to recommend crops and irrigation schedules, with offline mode.")


def make_doc(uid="u1", status="submitted", name="Asha", grade=None, title=None, **extra):
    t, d = IDEA
    doc = {"id": "a-" + uid + (title or "x"), "user_id": uid, "student_name": name, "title": title or t, "description": d,
           "created_at": "2026-10-01T10:00:00+00:00", "status": status, "reviews": [], "college_matches": [],
           "report": engine.analyze(t, d)}
    if grade is not None:
        doc["reviews"] = [{"id": "r1", "teacher_name": "T", "comment": "ok", "grade": grade, "status": status,
                           "created_at": "2026-10-02T10:00:00+00:00"}]
    doc.update(extra)
    return doc
