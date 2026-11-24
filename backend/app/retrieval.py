"""Hybrid retrieval: BM25 (sparse) + LSA dense vectors, fused with Reciprocal Rank
Fusion, then a lightweight reranker. Modes allow ablation: bm25 | dense | hybrid | hybrid_rerank.

Dense encoder: TF-IDF char n-grams + TruncatedSVD (works offline). Swap `DenseIndex`
for a sentence-transformers model in production without touching the rest."""
import math
import re
from collections import Counter
from dataclasses import dataclass
import numpy as np
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import normalize
from . import config
from .ingest import Chunk

STOP = set("a an the is are was were be do does did can could i we you your our my to of for in on at and or it its "
           "with this that how what which who when where why much many please me us have has any there about from by as "
           "would will should tell like want need".split())


def stem(w: str) -> str:
    for suf in ("ing", "es", "s"):
        if w.endswith(suf) and len(w) - len(suf) >= 4:
            return w[: -len(suf)]
    return w


def tokenize(text: str):
    return [stem(t) for t in re.findall(r"[a-z0-9]+", text.lower()) if t not in STOP]


class BM25:
    def __init__(self, docs, k1=1.5, b=0.75):
        self.k1, self.b = k1, b
        self.docs = docs
        self.tf = [Counter(d) for d in docs]
        self.len = np.array([len(d) for d in docs], dtype=float)
        self.avg = self.len.mean() if len(docs) else 0
        df = Counter(t for d in docs for t in set(d))
        n = len(docs)
        self.idf = {t: math.log(1 + (n - c + 0.5) / (c + 0.5)) for t, c in df.items()}

    def scores(self, q_tokens):
        out = np.zeros(len(self.docs))
        for i, tf in enumerate(self.tf):
            s = 0.0
            for t in q_tokens:
                if t in tf:
                    f = tf[t]
                    s += self.idf[t] * f * (self.k1 + 1) / (f + self.k1 * (1 - self.b + self.b * self.len[i] / self.avg))
            out[i] = s
        return out


class DenseIndex:
    def __init__(self, texts):
        self.vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True)
        X = self.vec.fit_transform(texts)
        k = max(2, min(100, X.shape[0] - 1, X.shape[1] - 1))
        self.svd = TruncatedSVD(n_components=k, random_state=0)
        self.Z = normalize(self.svd.fit_transform(X))

    def scores(self, query):
        q = normalize(self.svd.transform(self.vec.transform([query])))
        return (self.Z @ q.T).ravel()


@dataclass
class Hit:
    chunk: Chunk
    score: float
    dense_cos: float
    coverage: float


def coverage(q_tokens, c_tokens) -> float:
    q = set(q_tokens)
    return len(q & set(c_tokens)) / len(q) if q else 0.0


class HybridRetriever:
    def __init__(self, chunks):
        self.chunks = chunks
        self.toks = [tokenize(c.index_text) for c in chunks]
        self.bm25 = BM25(self.toks)
        self.dense = DenseIndex([c.index_text for c in chunks])

    def search(self, query: str, k: int = config.TOP_K, mode: str = "hybrid_rerank", prior=None):
        qt = tokenize(query)
        b = self.bm25.scores(qt)
        d = self.dense.scores(query)
        b_rank = [i for i in np.argsort(-b)[: config.CANDIDATES] if b[i] > 0]
        d_rank = list(np.argsort(-d)[: config.CANDIDATES])
        if mode == "bm25":
            order = [(i, float(b[i])) for i in b_rank]
        elif mode == "dense":
            order = [(i, float(d[i])) for i in d_rank]
        else:
            fused = Counter()
            for ranks in (b_rank, d_rank):
                for r, i in enumerate(ranks):
                    fused[i] += 1.0 / (config.RRF_K + r + 1)
            order = fused.most_common(config.CANDIDATES)
            if mode == "hybrid_rerank":   # lightweight reranker: semantic + lexical coverage + heading match (+ optional classifier-intent prior)
                rr = []
                for i, _ in order:
                    cov = coverage(qt, self.toks[i])
                    head = coverage(qt, tokenize(self.chunks[i].heading))
                    rr.append((i, 0.5 * float(d[i]) + 0.4 * cov + 0.1 * head + (prior or {}).get(self.chunks[i].source, 0.0)))
                order = sorted(rr, key=lambda x: -x[1])
        return [Hit(self.chunks[i], s, float(d[i]), coverage(qt, self.toks[i])) for i, s in order[:k]]
