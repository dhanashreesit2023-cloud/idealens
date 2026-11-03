from backend import engine
from .helpers import IDEA


def test_report_shape_and_ranges():
    r = engine.analyze(*IDEA)
    for k in engine.KEYS + ["overall"]:
        assert 0 <= r["scores"][k] <= 100
    for key in ("similar", "risks", "suggestions", "technology", "roadmap", "sdgs", "reasons", "summary"):
        assert r[key]
    assert "Agriculture" in r["domains"]
    assert any(s["number"] == 2 for s in r["sdgs"])  # Zero Hunger


def test_existing_project_is_flagged_as_similar():
    r = engine.analyze("Smart Parking Finder", "IoT sensors detect free parking slots and a mobile app guides drivers to the nearest space.")
    assert r["similar"][0]["similarity"] >= 40
    assert r["scores"]["originality"] < 60


def test_improver_returns_before_after():
    out = engine.improve(*IDEA)
    assert out["after"]["overall"] >= out["before"]["overall"]
    assert out["description"].startswith(IDEA[1][:30])


def test_weights_normalise_and_reset():
    w = engine.set_weights({k: 1 for k in engine.KEYS})
    assert abs(sum(w.values()) - 1) < 1e-9
    engine.set_weights(None)
    assert engine.WEIGHTS == engine.WEIGHTS_DEFAULT


def test_custom_corpus_reload():
    base = len(engine.SEED)
    total = engine.reload_corpus([{"id": "c1", "title": "Tamil voice farming helper", "domain": "Agriculture",
                                   "description": "voice assistant for farmers in Tamil"}])
    assert total == base + 1
    assert engine.reload_corpus([]) == base


def test_duplicate_detection_between_submissions():
    others = [{"id": "o1", "title": "Smart Parking Finder", "student_name": "Ravi",
               "text": "Smart Parking Finder. Sensors detect empty parking slots and a mobile app guides drivers to free space in the city."}]
    m = engine.college_matches("Parking Slot Finder App. IoT sensors detect free parking slots and an app guides drivers in a city.", others)
    assert m and m[0]["student_name"] == "Ravi"
    assert engine.college_matches("anything", []) == []
