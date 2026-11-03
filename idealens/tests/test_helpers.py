import random
from backend import calibrate, config, engine, mentor, pdfreport, ratelimit, views
from .helpers import make_doc


def test_student_cannot_see_who_matched_but_teacher_can():
    doc = make_doc(college_matches=[{"id": "x", "title": "Other", "student_name": "Ravi", "similarity": 40.0}])
    sv = views.view_for(doc, {"role": "student", "id": "u1"})
    tv = views.view_for(doc, {"role": "teacher", "id": "t1"})
    assert "college_matches" not in sv and sv["duplicate_warning"] == {"count": 1, "top": 40.0}
    assert tv["college_matches"][0]["student_name"] == "Ravi"


def test_stats():
    docs = [make_doc("u1", "draft", title="A"), make_doc("u1", "submitted", title="B"), make_doc("u2", "approved", title="C", name="Ravi")]
    ss = views.student_stats(docs[:2]); assert ss["total"] == 2 and ss["draft"] == 1
    ts = views.teacher_stats(docs); assert ts["total"] == 2 and ts["approved"] == 1
    assert len(views.teacher_students(docs)) == 2


def test_mentor_answers_from_report():
    doc = make_doc()
    assert "cost" in mentor.answer(doc, "What is the cost?").lower()
    assert mentor.answer(doc, "how can I improve this?")


def test_pdf_is_valid():
    data = pdfreport.build_pdf(pdfreport.report_blocks(views.view_for(make_doc(), {"role": "student", "id": "u1"})))
    assert data.startswith(b"%PDF") and len(data) > 1500


def test_calibration_needs_enough_data_then_improves_fit():
    docs = [make_doc("u1", title="d%d" % i, grade=5) for i in range(3)]
    assert calibrate.suggest(docs, engine.WEIGHTS)["ok"] is False
    random.seed(1)
    many = []
    for i in range(14):
        sc = {k: random.randint(30, 90) for k in engine.KEYS}; sc["overall"] = engine._overall(sc)
        g = round((0.6 * sc["feasibility"] + 0.4 * sc["impact"]) / 10)
        many.append({"id": str(i), "status": "approved", "reviews": [{"grade": g}], "report": {"scores": sc}})
    res = calibrate.suggest(many, engine.WEIGHTS)
    assert res["ok"] and abs(sum(res["suggested"].values()) - 1) < 0.05 and res["corr_suggested"] >= res["corr_current"]


def test_rate_limiter():
    config.RATE_LIMIT_ENABLED = True
    ratelimit.reset()
    assert [ratelimit.hit("k", 2, 60) for _ in range(3)][:2] == [0, 0]
    assert ratelimit.hit("k", 2, 60) > 0
    ratelimit.reset()
