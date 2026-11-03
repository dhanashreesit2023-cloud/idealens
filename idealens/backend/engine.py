"""IdeaLens analysis engine: similarity, explainable scoring, SDGs, risks, improver, roadmap."""
import json, re
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from . import config

SEED = json.loads((config.DATA_DIR / "projects.json").read_text(encoding="utf-8"))
CORPUS = list(SEED)

KEYS = ["originality", "innovation", "feasibility", "impact", "relevance"]
WEIGHTS_DEFAULT = {"originality": .25, "innovation": .20, "feasibility": .25, "impact": .20, "relevance": .10}
WEIGHTS = dict(WEIGHTS_DEFAULT)


def set_weights(w=None):
    """Set scoring weights (normalised to sum 1). set_weights(None) restores defaults."""
    global WEIGHTS
    if not w:
        WEIGHTS = dict(WEIGHTS_DEFAULT)
        return WEIGHTS
    vals = {k: max(0.0, float(w[k])) for k in KEYS}
    total = sum(vals.values())
    if total <= 0:
        raise ValueError("weights must sum to more than 0")
    WEIGHTS = {k: v / total for k, v in vals.items()}
    return WEIGHTS


# ---------------------------------------------------------------- similarity
_MODEL = None


def _get_model():
    global _MODEL
    if _MODEL is None:
        from sentence_transformers import SentenceTransformer
        _MODEL = SentenceTransformer("all-MiniLM-L6-v2")
    return _MODEL


class Similarity:
    """TF-IDF cosine by default; Sentence-Transformers (+FAISS if installed) when USE_EMBEDDINGS=1."""

    def __init__(self, corpus):
        self.corpus = corpus
        texts = [f"{p['title']}. {p['description']}" for p in corpus]
        self.mode, self.model, self.index = "tfidf", None, None
        if config.USE_EMBEDDINGS:
            try:
                self.model = _get_model()
                self.matrix = np.asarray(self.model.encode(texts, normalize_embeddings=True), dtype="float32")
                self.mode = "embeddings"
                try:
                    import faiss
                    self.index = faiss.IndexFlatIP(self.matrix.shape[1])
                    self.index.add(self.matrix)
                    self.mode = "embeddings+faiss"
                except Exception:
                    self.index = None
            except Exception as e:
                print(f"[IdeaLens] Embeddings unavailable ({e}); falling back to TF-IDF")
                self.mode = "tfidf"
        if self.mode == "tfidf":
            self.vec = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True)
            self.matrix = self.vec.fit_transform(texts)

    def top(self, text, k=5):
        if self.mode == "tfidf":
            sims = (self.matrix @ self.vec.transform([text]).T).toarray().ravel()  # L2-normalised -> cosine
            pairs = [(int(i), float(sims[i])) for i in np.argsort(-sims)[:k]]
        else:
            q = np.asarray(self.model.encode([text], normalize_embeddings=True), dtype="float32")
            if self.index is not None:
                D, I = self.index.search(q, min(k, len(self.corpus)))
                pairs = [(int(i), float(d)) for d, i in zip(D[0], I[0]) if i >= 0]
            else:
                sims = self.matrix @ q[0]
                pairs = [(int(i), float(sims[i])) for i in np.argsort(-sims)[:k]]
        thr = 0.12 if self.mode == "tfidf" else 0.25
        return [{"id": self.corpus[i]["id"], "title": self.corpus[i]["title"], "domain": self.corpus[i]["domain"],
                 "description": self.corpus[i]["description"], "similarity": round(s * 100, 1)}
                for i, s in pairs if s >= thr]


SIM = Similarity(CORPUS)


def reload_corpus(extra=None):
    """Rebuild the reference corpus = bundled seed + admin-added projects."""
    global CORPUS, SIM
    items = [{"id": p["id"], "title": p["title"], "domain": p.get("domain") or "General",
              "description": p["description"], "source": p.get("source", "custom")} for p in (extra or [])]
    CORPUS = list(SEED) + items
    SIM = Similarity(CORPUS)
    return len(CORPUS)


# ---------------------------------------------------------------- knowledge
DOMAINS = {
    "Smart City": r"smart city|traffic|parking|waste|streetlight|urban|municipal|citizen|pollution",
    "Manufacturing": r"manufactur|factory|industr|machinery|maintenance|production line|assembly|defect",
    "Healthcare": r"health|patient|hospital|medical|disease|diagnos|doctor|medicine|wellness|fitness|mental",
    "Agriculture": r"farm|crop|soil|irrigat|agricult|plant|yield",
    "Education": r"student|educat|e-learning|learner|teacher|course|exam|campus|college|school|tutor",
    "Finance": r"financ|payment|bank|loan|fraud|budget|expense|invoice|invest",
    "Environment & Energy": r"energy|solar|recycl|carbon|water|climate|environment|sustainab",
    "Transport & Logistics": r"transport|vehicle|fleet|logistic|deliver|route|supply chain|ride",
    "Security": r"security|surveillance|authenticat|privacy|intrusion|threat|phishing",
    "E-commerce & Retail": r"shop|retail|e-?commerce|store|inventory|customer",
    "Business & Startups": r"startup|business|sales|marketing|crm|saas|freelanc|entrepreneur|marketplace",
    "Social Impact": r"ngo|volunteer|donat|charity|community|disaster|relief|accessib",
    "Media & Entertainment": r"game|gaming|music|video|podcast|entertainment|streaming|creator",
    "Productivity & Tools": r"productivity|task|todo|calendar|notes|workflow|automation|collaborat|meeting",
    "Travel & Hospitality": r"travel|tour|hotel|restaurant|booking|trip|itinerary",
}
INDUSTRY_HOT = {"Manufacturing": 90, "Smart City": 85, "Healthcare": 88, "Agriculture": 80, "Finance": 85,
                "Environment & Energy": 88, "Transport & Logistics": 80, "Security": 85, "E-commerce & Retail": 75,
                "Education": 72, "Business & Startups": 82, "Social Impact": 78, "Media & Entertainment": 70,
                "Productivity & Tools": 74, "Travel & Hospitality": 68}

SIGNALS = {  # key: (regex, complexity weight, label)
    "ai": (r"\b(ai|artificial intelligence|machine learning|ml|deep learning|neural|nlp|llm|recommend\w*|predict\w*)\b", 2, "AI/ML model development"),
    "vision": (r"\b(computer vision|image recognition|object detection|face recognition|video|camera)\b", 2, "Computer vision pipeline"),
    "iot": (r"\b(iot|sensors?|arduino|raspberry|embedded|hardware|drone|robot\w*|rfid|esp32|wearable)\b", 3, "Hardware / IoT integration"),
    "blockchain": (r"\b(blockchain|smart contract|web3|ethereum)\b", 3, "Blockchain infrastructure"),
    "realtime": (r"real[- ]time|live stream|streaming|websocket", 1, "Real-time data handling"),
    "arvr": (r"\b(ar|vr|augmented|virtual reality|metaverse)\b", 2, "AR/VR content creation"),
    "mobile": (r"\b(mobile app|android|ios|flutter|react native)\b", 1, "Mobile app development"),
    "bigdata": (r"\b(big data|large[- ]scale|millions|data lake|spark)\b", 2, "Large-scale data processing"),
    "frontier": (r"\b(autonomous|self[- ]driving|quantum|5g|satellite)\b", 4, "Frontier technology"),
    "cloud": (r"\b(cloud|aws|azure|gcp|serverless)\b", 1, "Cloud deployment"),
    "payments": (r"\b(payments?|upi|bank\w*|transactions?)\b", 1, "Payment/regulatory compliance"),
}
INNOV = r"\b(predict\w*|personali[sz]\w*|generative|explainable|federated|edge|digital twin|multilingual|voice|gamif\w*|anomal\w*|autonomous|adaptive|semantic|blockchain|ai|iot)\b"
IMPACT = r"\b(rural|farmers?|accessib\w*|disab\w*|disaster|health\w*|safety|sustainab\w*|energy|poverty|education|elderly|women|clean|waste|emergency|affordable|students?)\b"

# (detect regex, suggestion shown to user, phrase appended by the AI improver)
BOOSTERS = [
    ("predictive", "Add predictive analytics (forecasting trends or failures) instead of only showing current data.", "predictive analytics that forecast trends and failures early"),
    ("voice|multilingual", "Support voice input and regional languages to reach users who are not comfortable with English.", "voice input and multilingual support"),
    ("explainable", "Add explainable AI - show why the system reached each result so users can trust it.", "explainable results that show why each recommendation was made"),
    ("offline", "Make it offline-first (PWA / local cache) so it works with poor connectivity.", "an offline-first mode for poor connectivity"),
    ("gamif", "Add gamification - badges, streaks or leaderboards - to drive continued usage.", "gamification with badges and streaks to keep users engaged"),
    ("api", "Expose an open REST API so other apps and organisations can plug into your system.", "an open REST API for integrations"),
    ("edge", "Run lightweight models on edge devices to cut latency and cloud cost.", "edge computing to run models on-device with low latency"),
    ("digital twin", "Build a digital-twin simulation to test scenarios before real deployment.", "a digital twin simulation to test scenarios safely"),
    ("personali", "Personalise outputs per user using a simple preference/feedback loop.", "personalised recommendations learned from user feedback"),
    ("anomal", "Add anomaly detection with automatic alerts (SMS/email/WhatsApp) for unusual events.", "anomaly detection with automatic alerts"),
]

TECH_BY_DOMAIN = {
    "Smart City": ["MQTT broker (Mosquitto)", "Leaflet / Google Maps API", "Time-series DB (InfluxDB)"],
    "Manufacturing": ["OPC-UA / MQTT data ingestion", "scikit-learn / XGBoost for anomaly detection", "Grafana dashboards"],
    "Healthcare": ["Data encryption at rest and in transit", "WebRTC for teleconsultation", "FHIR-compatible data model"],
    "Agriculture": ["TensorFlow Lite for on-device models", "Open weather API", "Multilingual UI (i18n)"],
    "Education": ["Role-based access", "PDF report generation", "Email/SMS notifications"],
    "Finance": ["Razorpay / UPI SDK sandbox", "Field-level encryption", "Audit logging"],
    "Environment & Energy": ["InfluxDB + Grafana", "Raspberry Pi / ESP32 gateway", "Open climate datasets"],
    "Transport & Logistics": ["Google Maps / OSRM routing", "WebSockets for live tracking", "Redis for location cache"],
    "Security": ["OWASP-compliant auth (OAuth2 / JWT)", "Rate limiting and WAF", "Encrypted storage (AES-256)"],
    "E-commerce & Retail": ["Elasticsearch for product search", "Redis caching", "Payment gateway sandbox"],
    "Business & Startups": ["Stripe / Razorpay sandbox", "Analytics (PostHog / GA4)", "Email automation"],
    "Social Impact": ["PWA for low-end phones", "SMS gateway (Twilio / MSG91)", "Multilingual UI (i18n)"],
    "Media & Entertainment": ["WebRTC / HLS streaming", "CDN for media delivery", "Recommendation service"],
    "Productivity & Tools": ["WebSockets for live collaboration", "OAuth integrations (Google, Slack)", "Background job queue (Celery)"],
    "Travel & Hospitality": ["Maps and places API", "Payment gateway sandbox", "Calendar / booking engine"],
}

SDGS = [
    (1, "No Poverty", r"poverty|low-income|affordable|micro ?loan|microfinance"),
    (2, "Zero Hunger", r"farm|crop|agricult|food|hunger|irrigat|harvest"),
    (3, "Good Health and Well-being", r"health|patient|medical|disease|hospital|wellness|elderly|mental|fitness|diet"),
    (4, "Quality Education", r"student|educat|learning|teacher|school|course|exam|tutor|skill"),
    (5, "Gender Equality", r"women|girls?|gender"),
    (6, "Clean Water and Sanitation", r"water|sanitation|leak|sewage"),
    (7, "Affordable and Clean Energy", r"energy|solar|renewable|electricity|power"),
    (8, "Decent Work and Economic Growth", r"job|employ|startup|business|freelanc|resume|workforce|marketplace|career"),
    (9, "Industry, Innovation and Infrastructure", r"industr|manufactur|factory|infrastructure|iot|logistic"),
    (10, "Reduced Inequalities", r"accessib|disab|inclusive|rural|regional language|visually|sign language"),
    (11, "Sustainable Cities and Communities", r"smart city|traffic|parking|urban|public transport|city|citizen|disaster"),
    (12, "Responsible Consumption and Production", r"recycl|waste|sustainab|surplus|supply chain"),
    (13, "Climate Action", r"climate|carbon|emission|pollution|green"),
    (14, "Life Below Water", r"ocean|marine|fish|river"),
    (15, "Life on Land", r"forest|wildlife|biodiversity|soil"),
    (16, "Peace, Justice and Strong Institutions", r"security|fraud|privacy|justice|governance|transparen|corruption|identity|phishing|fake news"),
    (17, "Partnerships for the Goals", r"collaborat|partnership|open data|community|volunteer|ngo"),
]


def detect_sdgs(text, limit=3):
    scored = []
    for num, name, pat in SDGS:
        hits = sorted(set(re.findall(pat, text)))
        if hits:
            scored.append((len(hits), num, name, hits))
    scored.sort(key=lambda x: (-x[0], x[1]))
    return [{"number": n, "name": nm, "reason": "Matched: " + ", ".join(h[:4])} for _, n, nm, h in scored[:limit]]


def _clamp(x, lo=0, hi=100):
    return int(max(lo, min(hi, round(x))))


def _level(v):
    return "High" if v >= 66 else "Medium" if v >= 36 else "Low"


def _overall(s):
    return _clamp(sum(WEIGHTS[k] * s[k] for k in KEYS))


def _verdict(o):
    return ("Strong idea - proceed to planning" if o >= 75 else "Promising - refine and differentiate" if o >= 60 else
            "Needs stronger differentiation" if o >= 45 else "High risk - rethink scope or approach")


def detect_domains(text, hint=None):
    hits = {d: len(re.findall(r, text)) for d, r in DOMAINS.items()}
    ranked = [d for d, c in sorted(hits.items(), key=lambda x: -x[1]) if c > 0]
    if hint and hint in DOMAINS and hint not in ranked:
        ranked.insert(0, hint)
    return ranked[:3] or ["General"]


def analyze(title, description, domain_hint=None):
    text = f"{title}. {description}".lower()
    n_words = len(re.findall(r"\w+", text))
    domains = detect_domains(text, domain_hint)

    similar = SIM.top(f"{title}. {description}", 5)
    top = similar[0]["similarity"] if similar else 0.0
    avg3 = sum(s["similarity"] for s in similar[:3]) / 3 if similar else 0.0
    sim_level = ("Very similar solutions already exist" if top >= 60 else
                 "Partially overlaps with existing solutions" if top >= 30 else
                 "Largely unique within the reference dataset")

    flags = {k: bool(re.search(v[0], text)) for k, v in SIGNALS.items()}
    on_labels = [SIGNALS[k][2] for k, on in flags.items() if on]
    complexity = max(1, min(10, 2 + sum(SIGNALS[k][1] for k, on in flags.items() if on) + (1 if len(domains) > 2 else 0)))

    originality = _clamp(100 - (0.7 * top + 0.3 * avg3) * 1.25)
    innov_found = sorted(set(re.findall(INNOV, text)))
    innovation = _clamp(28 + originality * 0.4 + len(innov_found) * 6 + (8 if len(domains) > 1 else 0))
    feasibility = _clamp(98 - complexity * 7.5 + (6 if n_words >= 50 else 0), 15, 95)
    impact_found = sorted(set(re.findall(IMPACT, text)))
    impact = _clamp(38 + len(impact_found) * 8 + (6 if len(domains) > 1 else 0), 20, 95)
    relevance = _clamp(sum(INDUSTRY_HOT.get(d, 60) for d in domains) / len(domains))
    scores = {"originality": originality, "innovation": innovation, "feasibility": feasibility, "impact": impact, "relevance": relevance}
    overall = _overall(scores)
    scores["overall"] = overall
    verdict = _verdict(overall)

    reasons = {
        "originality": (f"Closest existing project is '{similar[0]['title']}' ({top:.0f}% match), so originality is reduced." if similar and top >= 30
                        else f"No close match among {len(CORPUS)} reference projects (best match {top:.0f}%)."),
        "innovation": (f"Found {len(innov_found)} innovative element(s): {', '.join(innov_found[:5])}." if innov_found else "No distinctive innovative features mentioned yet.")
                      + (f" Combines {len(domains)} domains." if len(domains) > 1 else ""),
        "feasibility": f"Technical complexity is {complexity}/10" + (f" because of: {', '.join(on_labels[:4])}." if on_labels else " (standard web stack).")
                       + (" A detailed description helped." if n_words >= 50 else " A longer description would improve confidence."),
        "impact": (f"Social-impact signals found: {', '.join(impact_found[:5])}." if impact_found else "No social-impact keywords found; explain who benefits and how."),
        "relevance": f"Domain(s) {', '.join(domains)} have an industry-demand score of {relevance}.",
    }

    hardware = flags["iot"] or flags["frontier"]
    cost_band = "Low" if complexity <= 3 else "Medium" if complexity <= 6 else "High"
    cost_text = {"Low": "Rs. 0 - 10,000 (free-tier cloud, open-source tools)",
                 "Medium": "Rs. 10,000 - 50,000 (cloud credits, some hardware or paid APIs)",
                 "High": "Rs. 50,000+ (hardware, GPU/cloud compute, specialised licences)"}[cost_band]
    weeks = int(6 + complexity * 1.8 + (3 if hardware else 0))

    risks = []

    def add(cat, desc, mag, fix):
        risks.append({"category": cat, "risk": desc, "level": _level(mag), "mitigation": fix})
    add("Technical", ("Integration effort across " + ", ".join(on_labels)[:110]) if on_labels else "Standard web stack - low technical uncertainty",
        complexity * 10, "Build a thin end-to-end prototype first, then add one advanced component at a time.")
    add("Financial", f"Estimated cost band: {cost_band}.", {"Low": 20, "Medium": 50, "High": 80}[cost_band],
        "Prefer free tiers, simulators and open datasets before buying hardware or paid APIs.")
    add("Resource", "Skills needed: " + (", ".join(on_labels)[:90] or "web development basics"),
        20 + len(on_labels) * 15, "Divide modules by skill and learn one new tool per sprint.")
    add("Implementation", f"Roughly {weeks} weeks of work; scope creep is likely if features are not prioritised.",
        min(90, weeks * 3), "Define an MVP with 3-4 must-have features and freeze the scope.")
    if flags["ai"] or flags["vision"] or flags["bigdata"]:
        add("Data", "Quality and quantity of training/reference data may limit accuracy.", 60,
            "Start with public datasets (Kaggle, UCI, OpenML) and plan data cleaning early.")
    if top >= 45:
        add("Market / Originality", f"Close to an existing solution ('{similar[0]['title']}').", top,
            "Pick a clear differentiator from the Innovation Booster suggestions.")
    if "Healthcare" in domains or "Finance" in domains:
        add("Compliance", "Sensitive personal data requires privacy and security care.", 65,
            "Use encryption, consent screens and anonymised demo data.")

    suggestions = [s for key, s, _ in BOOSTERS if not re.search(key, text)][:5]
    if originality < 55 and similar:
        suggestions.insert(0, f"Differentiate from '{similar[0]['title']}': narrow to an under-served user group or add a feature it lacks.")
    suggestions = suggestions[:6]

    tech = {"Frontend": "React.js (responsive UI, charts)", "Backend": "FastAPI (Python) + JWT authentication",
            "Database": "MongoDB" + (" + time-series store (InfluxDB)" if flags["iot"] or flags["realtime"] else ""),
            "AI / ML": ("Sentence Transformers + FAISS for similarity; " if flags["ai"] or flags["vision"] else "") +
                       ("TensorFlow / PyTorch or OpenCV for vision" if flags["vision"] else
                        "scikit-learn / LLM API for intelligence" if flags["ai"] else "Rule-based logic is enough - add ML later"),
            "Deployment": "Docker + " + ("AWS / Azure" if flags["cloud"] or flags["bigdata"] else "Render / Railway / free-tier VPS"),
            "Extras": []}
    if flags["iot"]:
        tech["Extras"].append("MQTT + ESP32/Raspberry Pi firmware")
    if flags["blockchain"]:
        tech["Extras"].append("Solidity + Hardhat on a test network")
    if flags["mobile"]:
        tech["Extras"].append("React Native or Flutter mobile client")
    for d in domains:
        tech["Extras"].extend(TECH_BY_DOMAIN.get(d, [])[:2])
    tech["Extras"] = list(dict.fromkeys(tech["Extras"]))[:6]

    split = [("Requirements & Research", .12, ["Finalise problem statement and user stories", "Study the similar projects listed above", "Define MVP scope"]),
             ("System Design", .13, ["Architecture and database schema", "UI wireframes", "API contract"]),
             ("Prototype / Data", .20, ["Build the core end-to-end flow", "Collect and clean data" if (flags["ai"] or flags["vision"]) else "Set up sample data", "Demo to a mentor or first users"]),
             ("Core Development", .35, ["Implement all MVP modules", "Integrate " + (", ".join(on_labels)[:60] or "frontend with backend"), "Authentication and role handling"]),
             ("Testing & Optimisation", .12, ["Unit + API tests", "User testing and bug fixing", "Performance and security checks"]),
             ("Deployment & Documentation", .08, ["Dockerise and deploy", "Final report and presentation", "User manual"])]
    roadmap, start = [], 1
    for name, frac, tasks in split:
        w = max(1, round(weeks * frac))
        roadmap.append({"phase": name, "weeks": w, "from_week": start, "to_week": start + w - 1, "tasks": tasks})
        start += w

    summary = (f"'{title}' scores {overall}/100 overall ({verdict.lower()}). {sim_level}"
               f" (closest match {top:.0f}%). Feasibility is {feasibility}/100 with {complexity}/10 technical complexity; "
               f"expect about {weeks} weeks and a {cost_band.lower()} budget. "
               + ("Priority: differentiate from existing work using the suggestions below." if originality < 60 else
                  "Priority: lock the MVP scope and start the prototype."))

    return {"domains": domains, "scores": scores, "verdict": verdict, "complexity": complexity,
            "similarity_summary": sim_level, "similarity_method": SIM.mode, "similar": similar,
            "cost": {"band": cost_band, "estimate": cost_text}, "time_weeks": weeks, "risks": risks,
            "suggestions": suggestions, "technology": tech, "roadmap": roadmap, "summary": summary,
            "reasons": reasons, "sdgs": detect_sdgs(text), "scoring_mode": "rules", "weights": dict(WEIGHTS)}


def blend_llm(report, llm_out):
    """Average rule-based scores with LLM scores and adopt the LLM's reasons. llm_out has the 5 KEYS (+ reasons)."""
    s = report["scores"]
    report["scores_rules"] = dict(s)
    for k in KEYS:
        s[k] = _clamp((s[k] + float(llm_out[k])) / 2)
    s["overall"] = _overall(s)
    for k, v in (llm_out.get("reasons") or {}).items():
        if k in KEYS and isinstance(v, str) and v.strip():
            report["reasons"][k] = v.strip()[:300]
    report["verdict"] = _verdict(s["overall"])
    report["summary"] = re.sub(r"scores \d+/100 overall \([^)]*\)", f"scores {s['overall']}/100 overall ({report['verdict'].lower()})", report["summary"], count=1)
    report["scoring_mode"] = "hybrid"
    return report


def improve(title, description, domain=None, rewrite=None):
    """Return an improved description and the before/after scores (nothing is saved)."""
    before = analyze(title, description, domain)["scores"]
    text = f"{title} {description}".lower()
    if rewrite and len(rewrite.strip()) >= 20:
        new_desc, added, source = rewrite.strip()[:3900], [], "ai"
    else:
        added = [p for key, _, p in BOOSTERS if not re.search(key, text)][:3]
        new_desc = (description.rstrip(" .") + ". It also adds " + "; ".join(added) + ".") if added else description
        source = "rules"
    after = analyze(title, new_desc, domain)["scores"]
    return {"description": new_desc, "added": added, "source": source, "before": before, "after": after,
            "delta": {k: after[k] - before[k] for k in before}}


def college_matches(text, others, threshold=25.0):
    """Compare one idea with other people's submitted ideas. others: dicts with id, title, student_name, text."""
    if not others:
        return []
    try:
        vec = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True)
        m = vec.fit_transform([o["text"] for o in others] + [text])
        sims = (m[:-1] @ m[-1].T).toarray().ravel()
    except ValueError:  # empty vocabulary
        return []
    out = []
    for i in np.argsort(-sims)[:5]:
        pct = round(float(sims[i]) * 100, 1)
        if pct >= threshold:
            o = others[int(i)]
            out.append({"id": o["id"], "title": o["title"], "student_name": o.get("student_name", ""), "similarity": pct})
    return out
