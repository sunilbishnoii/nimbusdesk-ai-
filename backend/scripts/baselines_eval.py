"""End-to-end baseline comparison on Bitext (SYNTHETIC) + hallucination-control test.
Needs kb_bitext/ (created by scripts/bitext_eval.py) and the Bitext CSV.
 B1 keyword rules -> predefined doc      B2 TF-IDF classifier -> predefined doc
 B3 basic RAG (dense top-1, never refuses)   B4 hybrid RAG (no rerank, never refuses)
 Proposed: hybrid + rerank + grounding-confidence refusal.
Metrics: top-1 correct-source rate; coverage; and refusal of 30 OFF-TOPIC queries (should be refused = hallucination control).
Usage: python scripts/baselines_eval.py [csv] [n_queries]"""
import csv, glob, json, re, sys
from collections import defaultdict
from pathlib import Path
import numpy as np
sys.path.insert(0, ".")
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from app.ingest import build_chunks
from app.rag import focus_queries, grounding_confidence
from app.retrieval import HybridRetriever

a = sys.argv[1:]
CSV = next((x for x in a if not x.isdigit()), None) or next(iter(sorted(glob.glob("data/Bitext*.csv"))), None)
NQ = int(next((x for x in a if x.isdigit()), 1500)); SEED = 42
if not CSV or not Path("kb_bitext").exists(): sys.exit("Need the Bitext CSV in data/ and kb_bitext/ (run scripts/bitext_eval.py first).")
FILL = {"order number": "ORD48213", "invoice number": "INV20931", "date": "March 12", "date range": "last month", "client first name": "Amit",
        "client last name": "Shah", "money amount": "$49", "refund amount": "$49", "delivery city": "Pune", "delivery country": "India", "store location": "Mumbai"}
PH = re.compile(r"\{\{([^}]*)\}\}")
fill = lambda t: PH.sub(lambda m: FILL.get(m.group(1).strip().lower(), m.group(1).strip().lower()), t)
nk = lambda t: " ".join(re.sub(r"[^a-z ]", "", PH.sub("", t.lower())).split())
raw = list(csv.DictReader(open(CSV, encoding="utf-8", newline="")))
ki = defaultdict(set)
for r in raw: ki[nk(r["instruction"])].add(r["intent"])
seen, rows = set(), []
for r in raw:
    k = nk(r["instruction"])
    if len(ki[k]) > 1 or k in seen: continue
    seen.add(k); rows.append(r)
text = np.array([fill(r["instruction"]) for r in rows]); intent = np.array([r["intent"] for r in rows])
tr_i, te_i = train_test_split(np.arange(len(rows)), test_size=0.2, stratify=intent, random_state=SEED)   # same split as bitext_eval.py
rng = np.random.RandomState(SEED); qi = rng.choice(te_i, min(NQ, len(te_i)), replace=False)
R = HybridRetriever(build_chunks(Path("kb_bitext")))

v = TfidfVectorizer(stop_words="english", sublinear_tf=True); M = v.fit_transform(text[tr_i]); vocab = np.array(v.get_feature_names_out()); ytr = intent[tr_i]
kw = {it: set(vocab[np.argsort(-(np.asarray(M[ytr == it].mean(0)).ravel() - np.asarray(M[ytr != it].mean(0)).ravel()))[:8]]) for it in sorted(set(ytr))}
def b1(t):
    toks = set(re.findall(r"[a-z]+", t.lower())); s = {i: len(toks & w) for i, w in kw.items()}
    return max(s, key=s.get) if max(s.values()) > 0 else "contact_customer_service"
clf = make_pipeline(TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True), LogisticRegression(max_iter=400, C=10)).fit(text[tr_i], ytr)
def top1(q, mode): return R.search(q, k=1, mode=mode)[0].chunk.source[:-3]
def conf_hits(q):
    best = None
    for s in focus_queries(q):
        h = R.search(s, k=3, mode="hybrid_rerank"); c = grounding_confidence(s, h)
        if best is None or c > best[0]: best = (c, h)
    return best

OOD = ["what is the capital of france", "write me a poem about the sea", "how do i cook pasta", "who won the cricket world cup", "what is the bitcoin price today",
 "translate good morning into spanish", "what is the weather in paris", "tell me a joke", "how tall is mount everest", "recommend a good movie",
 "explain quantum computing", "what is 245 times 12", "who is the prime minister of canada", "how do i learn guitar", "what should i name my dog",
 "give me a workout plan", "what is the meaning of life", "best places to visit in japan", "how do vaccines work", "write a python function to sort a list",
 "what time is it in tokyo", "how many moons does jupiter have", "suggest a birthday gift for my mom", "who painted the mona lisa", "is it going to rain tomorrow",
 "what is photosynthesis", "how do i fix my bicycle chain", "latest football scores", "tell me about the roman empire", "can you sing a song"]

p_b1 = np.array([b1(t) for t in text[qi]]); p_b2 = clf.predict(text[qi]); y = intent[qi]
p_b3 = np.array([top1(t, "dense") for t in text[qi]]); p_b4 = np.array([top1(t, "hybrid") for t in text[qi]])
ch = [conf_hits(t) for t in text[qi]]
p_pr = np.array([h[0].chunk.source[:-3] for _, h in ch]); c_in = np.array([c for c, _ in ch])
c_ood = np.array([conf_hits(t)[0] for t in OOD])
PRIOR_W = 0.4
def prior_for(q):
    pr = clf.predict_proba([q])[0]; i = int(pr.argmax()); return {f"{clf.classes_[i]}.md": PRIOR_W * float(pr[i])}
def conf_hits_prior(q):
    best = None
    for s_ in focus_queries(q):
        h = R.search(s_, k=3, mode="hybrid_rerank", prior=prior_for(s_)); c = grounding_confidence(s_, h)
        if best is None or c > best[0]: best = (c, h)
    return best
chp = [conf_hits_prior(t) for t in text[qi]]
p_pp = np.array([h[0].chunk.source[:-3] for _, h in chp]); c_inp = np.array([c for c, _ in chp])
c_oodp = np.array([conf_hits_prior(t)[0] for t in OOD])
res = {"n_queries": int(len(qi)), "n_offtopic": len(OOD), "top1_source_accuracy": {}}
print(f"{len(qi)} in-domain test queries; {len(OOD)} off-topic queries; gold = correct intent document\n")
print(f"{'system':44}{'top-1 correct':>14}{'off-topic refused':>22}")
for name, p in (("B1 keyword rules -> predefined answer", p_b1), ("B2 TF-IDF classifier -> predefined answer", p_b2),
                ("B3 basic RAG (dense top-1, no refusal)", p_b3), ("B4 hybrid RAG (no rerank, no refusal)", p_b4)):
    acc = float((p == y).mean()); res["top1_source_accuracy"][name] = {"accuracy": round(acc, 4), "offtopic_refused": 0.0}
    print(f"{name:44}{acc:14.3f}{'0.00 (always answers)':>22}")
thr0 = 0.30
ans = c_in >= thr0; acc_ans = float((p_pr[ans] == y[ans]).mean()) if ans.any() else float("nan")
res["proposed"] = {"threshold": thr0, "answered": round(float(ans.mean()), 4), "top1_accuracy_when_answered": round(acc_ans, 4),
                   "top1_accuracy_all": round(float((p_pr == y).mean()), 4), "offtopic_refused": round(float((c_ood < thr0).mean()), 4)}
print(f"{'Proposed: hybrid+rerank+refusal (thr 0.30)':44}{(p_pr == y).mean():14.3f}{(c_ood < thr0).mean():22.2f}")
print(f"   proposed answers {ans.mean():.1%} of in-domain queries; correct when it answers: {acc_ans:.3f}; wrongly refused in-domain: {1 - ans.mean():.1%}")
ansp = c_inp >= thr0; accp = float((p_pp[ansp] == y[ansp]).mean())
res["proposed_with_intent_prior"] = {"prior_weight": PRIOR_W, "top1_accuracy_all": round(float((p_pp == y).mean()), 4), "answered": round(float(ansp.mean()), 4),
                                     "top1_accuracy_when_answered": round(accp, 4), "offtopic_refused": round(float((c_oodp < thr0).mean()), 4)}
print(f"{'Proposed + intent-aware retrieval (thr 0.30)':44}{(p_pp == y).mean():14.3f}{(c_oodp < thr0).mean():22.2f}")
print(f"   answers {ansp.mean():.1%} of in-domain queries; correct when it answers: {accp:.3f}")
print("\nRefusal threshold sweep (safety vs usefulness trade-off):")
print(f"{'threshold':>10}{'in-domain answered':>20}{'correct when answered':>23}{'off-topic refused':>19}")
res["sweep"] = []
for t in (0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6):
    m = c_in >= t; a_ = float((p_pr[m] == y[m]).mean()) if m.any() else float("nan"); o = float((c_ood < t).mean())
    res["sweep"].append({"thr": t, "answered": round(float(m.mean()), 3), "acc_when_answered": round(a_, 3), "offtopic_refused": round(o, 3)})
    print(f"{t:10.1f}{m.mean():20.3f}{a_:23.3f}{o:19.3f}")
Path("results").mkdir(exist_ok=True); json.dump(res, open("results/baselines_eval.json", "w"), indent=1); print("\nsaved results/baselines_eval.json")
print("Note: off-topic refusal is a hallucination-control PROXY; B1-B4 always answer by construction. A real LLM-judged faithfulness test is still needed.")
