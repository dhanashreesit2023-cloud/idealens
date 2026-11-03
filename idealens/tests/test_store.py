import tempfile
from pathlib import Path
from backend import config
from backend.db import FileStore


def new_store():
    config.STORE_PATH = Path(tempfile.mkdtemp()) / "store.json"
    return FileStore()


def test_users():
    s = new_store()
    assert s.add_user({"id": "u1", "email": "a@b.co", "name": "A", "password": "x", "role": "student"})
    assert not s.add_user({"id": "u2", "email": "a@b.co", "name": "B", "password": "x"})
    assert s.update_user("u1", {"name": "Asha"}) and s.user_by_id("u1")["name"] == "Asha"
    assert s.user_by_email("a@b.co")["id"] == "u1" and len(s.all_users()) == 1


def test_analyses_are_private_per_user():
    s = new_store()
    s.add_analysis({"id": "a1", "user_id": "u1", "created_at": "2026-01-01", "status": "draft"})
    assert s.get_analysis("a1", "u1") and not s.get_analysis("a1", "u2")
    assert s.get_analysis_any("a1")
    assert s.update_analysis("a1", {"status": "submitted"}) and s.get_analysis("a1", "u1")["status"] == "submitted"
    assert s.add_review("a1", {"id": "r", "grade": 7}, "approved") and s.get_analysis_any("a1")["status"] == "approved"
    assert s.delete_analysis("a1", "u1") and not s.delete_analysis("a1", "u1")


def test_notifications_settings_corpus():
    s = new_store()
    s.add_notification({"id": "n1", "user_id": "u1", "title": "t", "text": "x", "read": False, "created_at": "2026-01-01"})
    assert not s.list_notifications("u1")[0]["read"]
    s.mark_read("u1")
    assert s.list_notifications("u1")[0]["read"]
    assert s.get_setting("weights") is None
    s.set_setting("weights", {"a": 1}); assert s.get_setting("weights") == {"a": 1}
    s.add_corpus([{"id": "c1", "title": "T", "description": "d"}]); assert len(s.list_corpus()) == 1
    assert s.delete_corpus("c1") and not s.list_corpus()


def test_damaged_database_file_is_backed_up_not_lost():
    s = new_store()
    s.add_user({"id": "u1", "email": "a@b.co", "name": "A", "password": "x"})
    s.path.write_text('{"users": [ broken')
    assert s.all_users() == []                                   # app keeps running
    assert list(s.path.parent.glob("store.corrupt-*.json"))       # damaged copy kept for recovery
    assert s.add_user({"id": "u2", "email": "c@d.co", "name": "C", "password": "x"})
