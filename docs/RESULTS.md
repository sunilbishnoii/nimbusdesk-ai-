# Results summary (for the report) - all numbers reproducible with the scripts in backend/scripts

**Data caveat (state this in the paper):** Bitext is a *synthetic*, templated dataset (CDLA-Sharing-1.0, cite Bitext). The 100 lead enquiries are *LLM-authored synthetic*. No real customer data was used.

## 1. Intent classification - Bitext, 27 intents, 4,696 test messages (deduplicated, stratified 80/20) - `bitext_eval.py`
| System | Accuracy | Macro-F1 | Accuracy on typo messages (n=927) |
|---|---|---|---|
| Keyword rules (auto-derived) | 80.0% | 0.790 | 76.2% |
| TF-IDF words + LogReg | 99.4% | 0.993 | 97.4% |
| Words + character n-grams (proposed) | 99.85% | 0.998 | 99.8% |
Reading: learned classifiers beat keyword rules by ~19 points; character n-grams fix most typo errors. 99.85% is a ceiling effect of templated data, not real-world accuracy.

## 2. Retrieval ablation - 1,500 queries, 27-document KB built from train responses only - `bitext_eval.py`
| Method | Hit@1 | Hit@3 | MRR@5 | Hit@3 typos |
|---|---|---|---|---|
| BM25 | 0.543 | 0.715 | 0.634 | 0.666 |
| Dense (TF-IDF+SVD) | 0.597 | 0.777 | 0.688 | 0.770 |
| Hybrid (RRF) | 0.585 | 0.770 | 0.679 | 0.751 |
| Hybrid + rerank | 0.607 | 0.782 | 0.693 | 0.790 |
Reading: BM25 is clearly weakest; the other three are within sampling error (about +-1.2 points). Do not claim hybrid beats dense. KB-build randomness moved Hit@3 by ~4 points in a re-run, which is larger than the gaps between methods.

## 3. Baselines, intent-aware retrieval and refusal - `baselines_eval.py`
| System | Right document first | Off-topic refused (30 queries) |
|---|---|---|
| B1 keyword rules + fixed answers | 79.5% | 0% |
| B2 classifier + fixed answers | 99.5% | 0% |
| B3 basic RAG (dense) | 59.7% | 0% |
| B4 hybrid RAG | 58.7% | 0% |
| Proposed (hybrid+rerank+refusal, thr 0.30) | 60.4% | 73% |
| Proposed + intent-aware retrieval | 89.5% | 73% |
Reading: on this closed-set synthetic data a classifier with fixed answers wins - do not claim RAG beats it here. RAG's advantages (updatable knowledge, citations, refusal) are not measured by this test. Intent-aware retrieval (classifier intent as a retrieval prior) lifts 60% -> 90% on Bitext, but Bitext document names equal intent labels, which flatters it; on the NimbusDesk KB (24 queries) it made no difference (0.833 both ways). Claim: helps when intents map cleanly to documents, no harm otherwise.

Refusal trade-off (threshold on grounding confidence):
| Threshold | In-domain answered | Correct when answered | Off-topic refused |
|---|---|---|---|
| 0.1 | 98.0% | 0.610 | 63% |
| 0.3 (default) | 81.9% | 0.648 | 73% |
| 0.4 | 68.5% | 0.690 | 90% |
| 0.5 | 51.1% | 0.738 | 97% |
Off-topic refusal is a rough proxy for hallucination control, not a faithfulness measurement. A standalone-LLM baseline and LLM-judged faithfulness (RAGAS) were NOT run (no API key).

## 4. Lead tiering - NOT YET EVALUATED ON HUMAN LABELS
`lead_eval.py --smoke` compares against the author's designed profiles only (circular: thresholds were set from that same set). Do **not** report it as a result.
To produce the real result: two annotators fill `backend/data/eval/leads_labels.csv`, then run `lead_eval.py` and `fit_scorer.py`. Until then, state: "lead-score weights and thresholds are provisional; human-labelled validation is future work."

## Limitations to state
Synthetic data only; dense encoder is TF-IDF/SVD (sentence-transformer embeddings not yet used); intent classifier for the NimbusDesk demo is trained on ~70 seed utterances; grounding confidence is a heuristic; no authentication or PII protection; lead weights provisional.
