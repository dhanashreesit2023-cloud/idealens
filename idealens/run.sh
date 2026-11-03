#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
[ -d venv ] || python3 -m venv venv
source venv/bin/activate
python -m pip install -q -r requirements.txt
echo "Open http://localhost:8000"
python -m uvicorn backend.main:app --reload --port 8000
