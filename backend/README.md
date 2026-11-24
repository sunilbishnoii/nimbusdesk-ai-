# NLP + RAG Customer Enquiry & Lead Management — Phase 2–5 prototype

Unified pipeline: **enquiry → intent + entity extraction → hybrid retrieval → grounded answer (or refusal) → lead extraction → explainable scoring → storage/analytics.**

Demo data is a *fictional* SaaS ("NimbusDesk") in `kb/`. Replace the markdown files with your organisation's documents and `POST /kb/reload`.

## Run
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload          # UI at http://127.0.0.1:8000  ·  API docs at /docs
python -m pytest -q tests              # 9 tests
python scripts/eval_retrieval.py       # retrieval ablation (bm25 / dense / hybrid / hybrid+rerank)
```
Optional LLM: `LLM_BACKEND=anthropic ANTHROPIC_API_KEY=... uvicorn app.main:app` (default is the offline extractive generator).

## Layout
| File | Role (report section) |
|---|---|
| `app/ingest.py` | heading split + sentence-aware overlapping chunking, metadata |
| `app/retrieval.py` | BM25, dense (TF-IDF+SVD), RRF fusion, lightweight reranker |
| `app/nlp.py` | intent classifier (TF-IDF+LogReg), regex entity/lead-signal extraction |
| `app/rag.py` | prompt, LLM backends, grounding-confidence gate, refusal |
| `app/leads.py` | explainable weighted scoring (weights in `config.py`, provisional) |
| `app/store.py` | SQLite CRM store + analytics |
| `app/pipeline.py`, `app/main.py` | orchestration, FastAPI endpoints, demo UI |

## Endpoints
`POST /enquiry` · `GET /leads?tier=&min_score=` · `GET /leads/{id}` · `PATCH /leads/{id}/status` · `GET /analytics` · `POST /kb/reload` · `GET /health`

## Known limitations (be upfront in the report)
- Dense encoder is TF-IDF+SVD so it runs offline; swap `DenseIndex` for sentence-transformers (e.g. `all-MiniLM-L6-v2`) for real semantic recall.
- Intent classifier is trained on ~70 seed utterances: replace with real labelled enquiries and report held-out F1.
- Lead-score weights are provisional heuristics, not learned; calibrate on historical conversion data.
- Grounding confidence is a heuristic, not a calibrated probability; evaluate with RAGAS-style faithfulness + human labels.
- Retrieval gold set is small (24 queries) — a smoke test, not publishable evidence.
- Regex extraction misses unusual phrasing; consider an NER/LLM extractor and compare.
- No auth, rate limiting or PII encryption yet (required before real customer data).

## Bitext evaluation (synthetic data, CDLA-Sharing-1.0 — cite Bitext Innovations)
```bash
python scripts/bitext_eval.py "C:\path\to\Bitext_Sample_Customer_Support_Training_Dataset_27K_responses-v11.csv" 1500
```
Dedups messages, makes a stratified 80/20 split, compares intent classifiers (incl. per-flag accuracy), builds a 27-doc KB
(`kb_bitext/`) from *train-split* responses only and runs the retrieval ablation. Output: `results/bitext_eval.json`.
Caveats: data is synthetic and templated (intent accuracy saturates); retrieval gold = intent document, so sibling intents
(e.g. get_refund / track_refund) count as misses; no lead labels exist in this dataset.
