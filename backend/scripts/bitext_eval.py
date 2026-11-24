"""Evaluation on the Bitext customer-support dataset (SYNTHETIC; CDLA-Sharing-1.0). No pandas needed.
 Part 1: intent classification (keyword baseline vs TF-IDF+LR) on a deduplicated, stratified split,
         with breakdown by Bitext language-variation flags.
 Part 2: retrieval ablation over a knowledge base built ONLY from train-split responses.
Usage: python scripts/bitext_eval.py path/to/Bitext...csv [n_retrieval_queries]"""
import csv, json, re, sys, shutil
from collections import Counter, defaultdict
from pathlib import Path
import numpy as np
sys.path.insert(0, ".")
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline, make_union
from app.ingest import build_chunks
from app.retrieval import HybridRetriever

import glob
_args = sys.argv[1:]
CSV = next((a for a in _args if not a.isdigit()), None) or next(iter(sorted(glob.glob("data/Bitext*.csv"))), None)
NQ = int(next((a for a in _args if a.isdigit()), 2000))
if not CSV:
    sys.exit("Bitext CSV not found. Put it in the data folder (data/Bitext....csv).")
SEED = 42
rng = np.random.RandomState(SEED)

FILL = {"order number": "ORD48213", "invoice number": "INV20931", "date": "March 12", "date range": "last month",
        "client first name": "Amit", "client last name": "Shah", "money amount": "$49", "refund amount": "$49",
        "delivery city": "Pune", "delivery country": "India", "store location": "Mumbai"}
PH = re.compile(r"\{\{([^}]*)\}\}")
def fill(t): return PH.sub(lambda m: FILL.get(m.group(1).strip().lower(), m.group(1).strip().lower()), t)
def norm_key(t): return " ".join(re.sub(r"[^a-z ]", "", PH.sub("", t.lower())).split())

with open(CSV, encoding="utf-8", newline="") as f:
    raw = list(csv.DictReader(f))
n0 = len(raw)
key_intents = defaultdict(set)
for r in raw: key_intents[norm_key(r["instruction"])].add(r["intent"])
seen, rows, n_conf = set(), [], 0
for r in raw:
    k = norm_key(r["instruction"])
    if len(key_intents[k]) > 1: n_conf += 1; continue
    if k in seen: continue
    seen.add(k); rows.append(r)
print(f"rows {n0} -> {len(rows)} after dedup (normalised text); rows dropped for conflicting intents: {n_conf}")
text = np.array([fill(r["instruction"]) for r in rows]); intent = np.array([r["intent"] for r in rows])
flags = np.array([r["flags"] or "" for r in rows]); resp = np.array([r["response"] for r in rows])
cat_of = {r["intent"]: r["category"] for r in rows}
tr_i, te_i = train_test_split(np.arange(len(rows)), test_size=0.2, stratify=intent, random_state=SEED)
print(f"train {len(tr_i)}  test {len(te_i)}  intents {len(set(intent))}")
res = {"n_raw": n0, "n_dedup": len(rows), "n_train": int(len(tr_i)), "n_test": int(len(te_i))}
Xtr, ytr, Xte, yte, fte = text[tr_i], intent[tr_i], text[te_i], intent[te_i], flags[te_i]

# ---------- Part 1: intent classification ----------
def keyword_baseline(X, y, k=8):
    v = TfidfVectorizer(stop_words="english", sublinear_tf=True); M = v.fit_transform(X)
    vocab = np.array(v.get_feature_names_out()); kw = {}
    for it in sorted(set(y)):
        m = np.asarray(M[y == it].mean(axis=0)).ravel(); o = np.asarray(M[y != it].mean(axis=0)).ravel()
        kw[it] = set(vocab[np.argsort(-(m - o))[:k]])
    def pred(t):
        toks = set(re.findall(r"[a-z]+", t.lower())); s = {it: len(toks & w) for it, w in kw.items()}
        return max(s, key=s.get) if max(s.values()) > 0 else "contact_customer_service"
    return pred

def evaluate(name, yp):
    yp = np.array(yp)
    r = {"accuracy": round(float(accuracy_score(yte, yp)), 4), "macro_f1": round(float(f1_score(yte, yp, average="macro")), 4)}
    byflag = {}
    for f, lab in [("Z", "typos"), ("Q", "colloquial"), ("W", "offensive"), ("K", "keyword-only"), ("N", "negation"), ("C", "coordinated")]:
        m = np.array([f in x for x in fte])
        if m.sum() >= 30: byflag[lab] = (round(float(accuracy_score(yte[m], yp[m])), 4), int(m.sum()))
    r["by_flag_acc_n"] = byflag
    res.setdefault("intent", {})[name] = r
    print(f"{name:36} acc {r['accuracy']:.4f}  macroF1 {r['macro_f1']:.4f}\n    by flag (acc, n): {byflag}")

kp = keyword_baseline(Xtr, ytr); evaluate("B1 keyword rules (auto-derived)", [kp(t) for t in Xte])
word = make_pipeline(TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True), LogisticRegression(max_iter=400, C=10))
word.fit(Xtr, ytr); evaluate("B2 TF-IDF word + LogReg", word.predict(Xte))
both = make_pipeline(make_union(TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True),
                                TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), sublinear_tf=True)),
                     LogisticRegression(max_iter=400, C=10))
both.fit(Xtr, ytr); yp = both.predict(Xte); evaluate("Proposed: word+char TF-IDF + LogReg", yp)
conf = Counter((a, b) for a, b in zip(yte, yp) if a != b).most_common(8)
res["top_confusions"] = [{"true": a, "pred": b, "n": n} for (a, b), n in conf]
print("top confusions:", conf)

# ---------- Part 2: retrieval over KB built from TRAIN responses only ----------
def clean_resp(t):
    s = re.split(r"(?<=[.!?])\s+", fill(t).replace("\n", " ").strip())
    if len(s) > 2 and len(s[0].split()) < 45: s = s[1:]       # drop the echo-the-user opener
    return " ".join(s)

kbdir = Path("kb_bitext"); shutil.rmtree(kbdir, ignore_errors=True); kbdir.mkdir()
for it in sorted(set(intent)):
    idx = tr_i[intent[tr_i] == it]; idx = rng.choice(idx, min(150, len(idx)), replace=False)
    v = TfidfVectorizer(stop_words="english").fit(resp[idx]); M = v.transform(resp[idx])
    medoid = int(np.asarray((M @ M.T).mean(axis=1)).argmax()); title = it.replace("_", " ").title()
    (kbdir / f"{it}.md").write_text(f"# {title}\n## {title} ({cat_of[it].title()})\n{clean_resp(resp[idx[medoid]])}\n", encoding="utf-8")
chunks = build_chunks(kbdir)
print(f"KB: {len(list(kbdir.glob('*.md')))} docs, {len(chunks)} chunks (one medoid train response per intent)")
R = HybridRetriever(chunks)
qi = rng.choice(te_i, min(NQ, len(te_i)), replace=False)
print(f"retrieval queries: {len(qi)} (test split); gold source = intent doc; cat = same Bitext category")
res["retrieval"] = {"n_queries": int(len(qi)), "n_chunks": len(chunks)}
zmask = np.array(["Z" in flags[i] for i in qi])
print(f"{'mode':16}{'Hit@1':>8}{'Hit@3':>8}{'MRR@5':>8}{'cat-Hit@3':>11}{'Hit@3 typos':>13}")
for mode in ("bm25", "dense", "hybrid", "hybrid_rerank"):
    h1 = h3 = mrr = c3 = 0; per = []
    for i in qi:
        it = intent[i]; src = [h.chunk.source[:-3] for h in R.search(text[i], k=5, mode=mode)]
        rk = next((j for j, s in enumerate(src) if s == it), None)
        h1 += rk == 0; ok = rk is not None and rk < 3; h3 += ok; per.append(ok)
        mrr += 1 / (rk + 1) if rk is not None else 0
        c3 += any(cat_of[s] == cat_of[it] for s in src[:3])
    n = len(qi); zt = float(np.array(per)[zmask].mean()) if zmask.any() else float("nan")
    res["retrieval"][mode] = {"hit1": round(h1 / n, 4), "hit3": round(h3 / n, 4), "mrr5": round(mrr / n, 4), "cat_hit3": round(c3 / n, 4), "hit3_typos": round(zt, 4)}
    print(f"{mode:16}{h1/n:8.3f}{h3/n:8.3f}{mrr/n:8.3f}{c3/n:11.3f}{zt:13.3f}")
Path("results").mkdir(exist_ok=True); json.dump(res, open("results/bitext_eval.json", "w"), indent=1)
print("saved results/bitext_eval.json")
