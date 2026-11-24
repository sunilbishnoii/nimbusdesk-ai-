"""Fit data-driven lead-score weights from HUMAN labels (replaces the provisional hand-set weights).
Cross-validated, so the reported numbers are out-of-sample.  python scripts/fit_scorer.py   (or --smoke: pipeline check only)"""
import csv, json, sys
from pathlib import Path
sys.path.insert(0, ".")
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from app import config
from app.pipeline import Pipeline

D = Path("data/eval"); smoke = "--smoke" in sys.argv
rows = list(csv.DictReader(open(D / "leads_enquiries.csv", encoding="utf-8-sig")))
if smoke: gold = {r["id"]: r["designed_profile"] for r in csv.DictReader(open(D / "_authoring_notes_DO_NOT_SHOW_ANNOTATORS.csv", encoding="utf-8-sig"))}
else: gold = {r["id"]: r["final"].strip().lower() for r in csv.DictReader(open(D / "leads_labels.csv", encoding="utf-8-sig"))}
P = Pipeline(); X, y, fixed = [], [], []
for r in rows:
    o = P.process(r["text"], r["channel"], persist=False)
    X.append([e["value"] for e in o["explanation"]]); y.append(gold[r["id"]]); fixed.append(o["tier"])
X, y, fixed = np.array(X), np.array(y), np.array(fixed); names = list(config.SCORE_WEIGHTS)
cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
mk = lambda: LogisticRegression(max_iter=2000, C=1.0, class_weight="balanced")
pred = cross_val_predict(mk(), X, y, cv=cv)
print(f"{'fixed hand-set weights':28} acc {accuracy_score(y, fixed):.3f}  macroF1 {f1_score(y, fixed, average='macro'):.3f}")
print(f"{'learned LogReg (5-fold CV)':28} acc {accuracy_score(y, pred):.3f}  macroF1 {f1_score(y, pred, average='macro'):.3f}")
m = mk().fit(X, y); hot = list(m.classes_).index("hot")
coef = dict(zip(names, np.round(m.coef_[hot], 2).tolist()))
print("\nfeature influence on 'hot' (larger = pushes toward hot):")
for k, v in sorted(coef.items(), key=lambda kv: -kv[1]): print(f"  {k:18}{v:+.2f}")
Path("results").mkdir(exist_ok=True)
json.dump({"mode": "SMOKE" if smoke else "human labels", "fixed_acc": round(accuracy_score(y, fixed), 3), "learned_cv_acc": round(accuracy_score(y, pred), 3), "hot_coefficients": coef},
          open("results/fit_scorer.json", "w"), indent=1)
if smoke: print("\nSMOKE TEST (designed profiles): do not report.")
