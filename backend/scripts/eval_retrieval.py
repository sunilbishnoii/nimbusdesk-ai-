"""Retrieval ablation: bm25 vs dense vs hybrid vs hybrid+rerank on a small gold set.
Metrics: Hit@1, Recall@3 (a chunk from the gold section is in the top 3), MRR.
NOTE: gold set is small (16 queries) -> use as a smoke benchmark, not evidence."""
import json, sys
sys.path.insert(0, ".")
from app import config
from app.ingest import build_chunks
from app.retrieval import HybridRetriever

gold = json.loads((config.DATA_DIR / "eval_retrieval.json").read_text())
r = HybridRetriever(build_chunks())
print(f"{'mode':16}{'Hit@1':>8}{'Recall@3':>10}{'MRR':>8}")
for mode in ("bm25", "dense", "hybrid", "hybrid_rerank"):
    h1 = r3 = mrr = 0.0
    for g in gold:
        hits = r.search(g["q"], k=3, mode=mode)
        ranks = [i for i, h in enumerate(hits) if h.chunk.source == g["src"] and h.chunk.heading == g["h"]]
        if ranks:
            r3 += 1; h1 += ranks[0] == 0; mrr += 1 / (ranks[0] + 1)
    n = len(gold)
    print(f"{mode:16}{h1 / n:8.2f}{r3 / n:10.2f}{mrr / n:8.2f}")
