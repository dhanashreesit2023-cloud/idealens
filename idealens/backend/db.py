"""Storage layer. MongoDB if MONGO_URL is set and reachable, otherwise a local JSON file."""
import json, os, threading
from . import config

_EMPTY = {"users": [], "analyses": [], "notifications": [], "corpus": [], "settings": {}}


class FileStore:
    kind = "local-json"

    def __init__(self):
        self.path = config.STORE_PATH
        self.lock = threading.Lock()
        if not self.path.exists():
            self._save(self._load())

    def _load(self):
        try:
            d = json.loads(self.path.read_text(encoding="utf-8"))
            if not isinstance(d, dict):
                raise ValueError("store is not a JSON object")
        except FileNotFoundError:
            d = {}
        except Exception as e:  # damaged file: keep a backup so nothing is lost, then start clean
            self._quarantine(e)
            d = {}
        for k, v in _EMPTY.items():
            d.setdefault(k, type(v)())
        return d

    def _quarantine(self, err):
        try:
            import shutil, time
            if self.path.exists() and self.path.stat().st_size > 0:
                bak = self.path.with_name(f"store.corrupt-{int(time.time())}.json")
                shutil.copy(self.path, bak)
                print(f"[IdeaLens] WARNING: database file was unreadable ({err}). Backup saved as {bak.name}")
        except Exception as e2:
            print("[IdeaLens] could not back up damaged database:", e2)

    def _save(self, data):
        tmp = str(self.path) + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        os.replace(tmp, self.path)

    # ---- users

    def user_by_email(self, email):
        return next((u for u in self._load()["users"] if u["email"] == email), None)

    def user_by_id(self, uid):
        return next((u for u in self._load()["users"] if u["id"] == uid), None)

    def all_users(self):
        return self._load()["users"]

    def add_user(self, user):
        with self.lock:
            d = self._load()
            if any(u["email"] == user["email"] for u in d["users"]):
                return False
            d["users"].append(user)
            self._save(d)
            return True

    def update_user(self, uid, fields):
        with self.lock:
            d = self._load()
            for u in d["users"]:
                if u["id"] == uid:
                    u.update(fields)
                    self._save(d)
                    return True
            return False

    def delete_user(self, uid):
        with self.lock:
            d = self._load()
            n = len(d["users"])
            d["users"] = [u for u in d["users"] if u["id"] != uid]
            d["analyses"] = [a for a in d["analyses"] if a["user_id"] != uid]
            d["notifications"] = [x for x in d["notifications"] if x["user_id"] != uid]
            self._save(d)
            return len(d["users"]) < n

    # ---- analyses

    def add_analysis(self, doc):
        with self.lock:
            d = self._load()
            d["analyses"].append(doc)
            self._save(d)

    def all_analyses(self):
        return self._load()["analyses"]

    def list_analyses(self, uid):
        rows = [a for a in self._load()["analyses"] if a["user_id"] == uid]
        rows.sort(key=lambda a: a["created_at"], reverse=True)
        return rows

    def get_analysis(self, aid, uid):
        return next((a for a in self._load()["analyses"] if a["id"] == aid and a["user_id"] == uid), None)

    def get_analysis_any(self, aid):
        return next((a for a in self._load()["analyses"] if a["id"] == aid), None)

    def update_analysis(self, aid, fields):
        with self.lock:
            d = self._load()
            for a in d["analyses"]:
                if a["id"] == aid:
                    a.update(fields)
                    self._save(d)
                    return True
            return False

    def add_review(self, aid, review, status):
        with self.lock:
            d = self._load()
            for a in d["analyses"]:
                if a["id"] == aid:
                    a.setdefault("reviews", []).append(review)
                    a["status"] = status
                    self._save(d)
                    return True
            return False

    def delete_analysis(self, aid, uid):
        with self.lock:
            d = self._load()
            n = len(d["analyses"])
            d["analyses"] = [a for a in d["analyses"] if not (a["id"] == aid and a["user_id"] == uid)]
            self._save(d)
            return len(d["analyses"]) < n

    # ---- notifications

    def add_notification(self, doc):
        with self.lock:
            d = self._load()
            d["notifications"].append(doc)
            d["notifications"] = d["notifications"][-2000:]
            self._save(d)

    def list_notifications(self, uid, limit=50):
        rows = [x for x in self._load()["notifications"] if x["user_id"] == uid]
        rows.sort(key=lambda x: x["created_at"], reverse=True)
        return rows[:limit]

    def mark_notifications_read(self, uid):
        with self.lock:
            d = self._load()
            for x in d["notifications"]:
                if x["user_id"] == uid:
                    x["read"] = True
            self._save(d)

    # ---- dataset (custom reference projects) and settings

    def add_corpus(self, items):
        with self.lock:
            d = self._load()
            d["corpus"].extend(items)
            self._save(d)

    def list_corpus(self):
        return self._load()["corpus"]

    def delete_corpus(self, cid):
        with self.lock:
            d = self._load()
            n = len(d["corpus"])
            d["corpus"] = [c for c in d["corpus"] if c["id"] != cid]
            self._save(d)
            return len(d["corpus"]) < n

    def get_setting(self, key, default=None):
        return self._load()["settings"].get(key, default)

    def set_setting(self, key, value):
        with self.lock:
            d = self._load()
            d["settings"][key] = value
            self._save(d)

    def mark_read(self, uid):
        with self.lock:
            d = self._load()
            for n in d["notifications"]:
                if n["user_id"] == uid:
                    n["read"] = True
            self._save(d)

    def mark_read(self, uid):
        return self.mark_notifications_read(uid)


class MongoStore:
    kind = "mongodb"

    def __init__(self, url, name):
        from pymongo import MongoClient
        client = MongoClient(url, serverSelectionTimeoutMS=3000)
        client.admin.command("ping")
        self.db = client[name]
        self.db.users.create_index("email", unique=True)
        self.db.analyses.create_index([("user_id", 1), ("created_at", -1)])
        self.db.notifications.create_index([("user_id", 1), ("created_at", -1)])

    def user_by_email(self, email):
        return self.db.users.find_one({"email": email}, {"_id": 0})

    def user_by_id(self, uid):
        return self.db.users.find_one({"id": uid}, {"_id": 0})

    def all_users(self):
        return list(self.db.users.find({}, {"_id": 0}))

    def add_user(self, user):
        from pymongo.errors import DuplicateKeyError
        try:
            self.db.users.insert_one(dict(user))
            return True
        except DuplicateKeyError:
            return False

    def update_user(self, uid, fields):
        return self.db.users.update_one({"id": uid}, {"$set": fields}).matched_count > 0

    def delete_user(self, uid):
        ok = self.db.users.delete_one({"id": uid}).deleted_count > 0
        self.db.analyses.delete_many({"user_id": uid})
        self.db.notifications.delete_many({"user_id": uid})
        return ok

    def add_analysis(self, doc):
        self.db.analyses.insert_one(dict(doc))

    def all_analyses(self):
        return list(self.db.analyses.find({}, {"_id": 0}))

    def list_analyses(self, uid):
        return list(self.db.analyses.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1))

    def get_analysis(self, aid, uid):
        return self.db.analyses.find_one({"id": aid, "user_id": uid}, {"_id": 0})

    def get_analysis_any(self, aid):
        return self.db.analyses.find_one({"id": aid}, {"_id": 0})

    def update_analysis(self, aid, fields):
        return self.db.analyses.update_one({"id": aid}, {"$set": fields}).matched_count > 0

    def add_review(self, aid, review, status):
        r = self.db.analyses.update_one({"id": aid}, {"$push": {"reviews": review}, "$set": {"status": status}})
        return r.matched_count > 0

    def delete_analysis(self, aid, uid):
        return self.db.analyses.delete_one({"id": aid, "user_id": uid}).deleted_count > 0

    def add_notification(self, doc):
        self.db.notifications.insert_one(dict(doc))

    def list_notifications(self, uid, limit=50):
        return list(self.db.notifications.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).limit(limit))

    def mark_notifications_read(self, uid):
        self.db.notifications.update_many({"user_id": uid}, {"$set": {"read": True}})

    def add_corpus(self, items):
        if items:
            self.db.corpus.insert_many([dict(i) for i in items])

    def list_corpus(self):
        return list(self.db.corpus.find({}, {"_id": 0}))

    def delete_corpus(self, cid):
        return self.db.corpus.delete_one({"id": cid}).deleted_count > 0

    def get_setting(self, key, default=None):
        d = self.db.settings.find_one({"key": key}, {"_id": 0})
        return d["value"] if d else default

    def set_setting(self, key, value):
        self.db.settings.update_one({"key": key}, {"$set": {"value": value}}, upsert=True)

    def mark_read(self, uid):
        self.db.notifications.update_many({"user_id": uid}, {"$set": {"read": True}})

    def mark_read(self, uid):
        return self.mark_notifications_read(uid)


def get_store():
    if config.MONGO_URL:
        try:
            s = MongoStore(config.MONGO_URL, config.MONGO_DB)
            print("[IdeaLens] Using MongoDB")
            return s
        except Exception as e:
            print(f"[IdeaLens] MongoDB unavailable ({e}); using local JSON store instead")
    print("[IdeaLens] Using local JSON store")
    return FileStore()
