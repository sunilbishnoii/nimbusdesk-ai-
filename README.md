# NLP + RAG Customer Enquiry & Lead Management System

Final-year project. A customer enquiry goes in; the system understands it (intent + entities), finds the answer in a controlled
knowledge base (or refuses when unsure), and scores the lead (hot / warm / cold) with an explanation for every point.

```
backend/    Python FastAPI service: NLP, hybrid retrieval, RAG, lead scoring, SQLite, evaluation scripts   (owner: Sunil)
frontend/   React + TypeScript web app + zero-dependency mock API                                         (owner: friend)
docs/       API_CONTRACT.md, openapi.json, examples/  <- the agreement between the two sides              (owner: Sunil)
```

**Golden rule:** the two halves only talk through the API described in `docs/API_CONTRACT.md`. The frontend never needs Python,
and the backend never needs Node.

## Quick start - frontend on a Mac (no backend needed)
```bash
brew install node@20 git            # skip what you already have; or use nvm: nvm install 20
git clone <repo-url> && cd <repo>/frontend
cp .env.example .env
npm install
npm run mock        # terminal 1: fake API on http://127.0.0.1:8000 (realistic sample data)
npm run dev         # terminal 2: app on http://localhost:5173
```
## Frontend against the REAL backend (optional, Mac)
```bash
brew install python@3.12
cd backend && python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload       # stop the mock first: both use port 8000
```
## Backend on Windows (Sunil)
See `backend/README_FIRST.txt` (double-click `setup.bat` once, then `run_app.bat`).

## Hardening (optional env vars)
`API_KEY` requires an `X-API-Key` header on API calls (leave unset for the demo); `RATE_LIMIT_PER_MIN` (default 120) caps POSTs per IP.

## Research assets (backend/)
`scripts/bitext_eval.py` (intent + retrieval on Bitext), `scripts/lead_eval.py` (lead tiering vs human labels),
`data/eval/` (100 synthetic enquiries + annotation guide), `results/` (saved metrics).

## Evaluation scripts (backend/)
| Script | What it measures | Needs |
|---|---|---|
| `bitext_eval.py` | intent classification + retrieval ablation (Bitext, synthetic) | Bitext CSV |
| `baselines_eval.py` | keyword rules vs classifier vs basic RAG vs proposed; off-topic refusal sweep; intent-aware retrieval | Bitext CSV + `kb_bitext/` |
| `lead_eval.py` | hot/warm/cold accuracy, hot recall, annotator agreement | `data/eval/leads_labels.csv` (human labels) |
| `fit_scorer.py` | learns lead-score weights from human labels (cross-validated) | `leads_labels.csv` |

CI (`.github/workflows/ci.yml`) runs backend tests and the frontend build on every push. `backend/Dockerfile` is provided (not yet tested).
