# 💡 IdeaLens v2 - Idea Validation Platform

Validate any project or startup idea before building it: similarity check, explainable scoring, risks,
UN SDG tags, roadmap, versions, mentor chat, PDF report and expert review.
Works for students, hackathons, startups and company innovation teams - people join a **workspace**
(a class, team, company or event) and reviewers only see ideas from their own workspace.

## Run it
1. Install Python 3.10+.
2. Open a terminal in this folder and run: `python -m pip install -r requirements.txt`
3. Start: `python -m uvicorn backend.main:app --reload`
4. Open http://localhost:8000 (first load needs internet: React comes from a CDN).
5. Check everything: `python -m pip install pytest` then `python tests_smoke.py`.

## Roles
| Role | Can do | Sign-up |
|---|---|---|
| Creator | Analyse ideas, versions, improver, mentor chat, PDF, submit for review | open |
| Reviewer | See submissions of their workspace, duplicate alerts, comment, grade, approve | needs `TEACHER_CODE` (default `teacher123`) |
| Admin | Users and roles, password help, reference dataset, scoring calibration | needs `ADMIN_CODE` (off until you set it in `.env`) |

## The 12 improvements and where they live
| # | Feature | Where |
|---|---|---|
| 1 | Explainable scoring (reason for every score); optional LLM blend | `engine.py`, `llm.py` |
| 2 | Embeddings + FAISS (optional) and admin-managed dataset (149 bundled projects) | `engine.py`, Admin > Reference data |
| 3 | Idea versions and score history | report > Versions |
| 4 | Idea improver with before/after scores | report > Improve |
| 5 | Mentor chat per report (rule-based; LLM if key set) | report > Mentor chat, `mentor.py` |
| 6 | UN SDG tagging | report > Overview |
| 7 | In-app notifications + optional e-mail | `notify.py`, bell icon |
| 8 | Admin role, password reset codes, rate limiting | `main.py`, `ratelimit.py` |
| 9 | English / Tamil / Hindi interface (report text stays English) | `frontend/js/i18n.js` |
| 10 | Weight calibration from reviewer grades | Admin > Calibration, `calibrate.py` |
| 11 | Installable app (PWA) and server-side PDF | `sw.js`, `manifest.webmanifest`, `pdfreport.py` |
| 12 | Tests, CI and auto-deploy | `tests/`, `.github/workflows/ci.yml`, `render.yaml` |

## Put it online (permanent link)
1. Create a free MongoDB Atlas cluster and copy its connection string.
2. Push this folder to GitHub (the `.gitignore` already skips secrets and local data).
3. On Render: New > Blueprint > select the repo (uses `render.yaml`), then set `MONGO_URL`, `TEACHER_CODE`, `ADMIN_CODE`.
4. Open `https://<your-service>.onrender.com/api/health` - it should show `"database":"mongodb"`.
Every push to `main` runs the tests on GitHub and redeploys on Render. Free plans sleep when idle.
In Chrome, open the site and use the install icon (or menu > Add to Home screen) to install it as an app.

## Honest limits
- Scores are rule-based guidance plus similarity, not a trained model. Calibration needs 8+ graded ideas.
- Without `ANTHROPIC_API_KEY` the improver and chat use rules; with it they use the LLM.
- The bundled dataset is a sample; add real projects in Admin > Reference data for better originality checks.
- Free hosting has no persistent disk: use MongoDB Atlas, otherwise data is lost on redeploy.

## Checking and troubleshooting
- `python tests_smoke.py` runs 22 backend and API tests (first time: `python -m pip install pytest`).
- `python tools/gen_fixtures.py` then `node tools/render_check.js` renders every page for student, reviewer and admin in English, Tamil and Hindi, using real backend data (needs Node.js; also runs in CI).
- Blank page or "IdeaLens could not start": check your internet (React loads from a CDN, with two backups), then press Ctrl+F5.
- If a page hits an unexpected error you see a "Something went wrong" card with a Reload button, not a blank screen.
- A damaged `backend/data/store.json` is never overwritten silently: a copy is saved as `store.corrupt-<time>.json` and the app keeps running.
- Reports saved by older versions open normally (missing newer fields are tolerated).
- Command not found / `No module named backend`: open the folder that directly contains `backend` and `requirements.txt` (not the folder above it), and always start with `python -m uvicorn backend.main:app --reload` with no full stop at the end.
