"""Evaluate lead tiering (hot/warm/cold) against HUMAN labels.
Usage: python scripts/lead_eval.py            (uses data/eval/leads_labels.csv -> 'final' column)
       python scripts/lead_eval.py --smoke    (SMOKE TEST ONLY: uses the author's designed profiles, NOT human labels)
Systems: B1 intent-only rule  vs  Full scorer (intent + entities + grounding)."""
import csv, json, sys
from pathlib import Path
sys.path.insert(0, ".")
import numpy as np
from sklearn.metrics import accuracy_score, cohen_kappa_score, confusion_matrix, f1_score, precision_recall_fscore_support
from app.pipeline import Pipeline

D = Path("data/eval"); TIERS = ["hot", "warm", "cold"]
rows = list(csv.DictReader(open(D / "leads_enquiries.csv", encoding="utf-8-sig")))
smoke = "--smoke" in sys.argv
res = {"mode": "SMOKE (designed profiles, not human labels)" if smoke else "human labels"}
if smoke:
    gold = {r["id"]: r["designed_profile"] for r in csv.DictReader(open(D / "_authoring_notes_DO_NOT_SHOW_ANNOTATORS.csv", encoding="utf-8-sig"))}
else:
    lab = list(csv.DictReader(open(D / "leads_labels.csv", encoding="utf-8-sig")))
    a1 = [r["annotator1"].strip().lower() for r in lab]; a2 = [r["annotator2"].strip().lower() for r in lab]
    if all(a1) and all(a2):
        res["cohen_kappa"] = round(float(cohen_kappa_score(a1, a2)), 3)
        res["cohen_kappa_weighted"] = round(float(cohen_kappa_score(a1, a2, labels=TIERS, weights="linear")), 3)
        res["raw_agreement"] = round(float(np.mean([x == y for x, y in zip(a1, a2)])), 3)
        print("inter-annotator:", {k: res[k] for k in ("cohen_kappa", "cohen_kappa_weighted", "raw_agreement")})
    gold = {r["id"]: r["final"].strip().lower() for r in lab}
    missing = [i for i, g in gold.items() if g not in TIERS]
    if missing: sys.exit(f"'final' label missing/invalid for {len(missing)} rows (e.g. {missing[:3]}). Fill leads_labels.csv first.")
P = Pipeline()
def intent_only(intent): return "hot" if intent in ("demo_request", "purchase") else "warm" if intent in ("pricing", "product_info") else "cold"
y, full, base = [], [], []
for r in rows:
    out = P.process(r["text"], r["channel"], persist=False)
    y.append(gold[r["id"]]); full.append(out["tier"]); base.append(intent_only(out["intent"]))
y = np.array(y)
for name, pred in (("B1 intent-only rule", np.array(base)), ("Full scorer", np.array(full))):
    p, r_, f, _ = precision_recall_fscore_support(y, pred, labels=TIERS, zero_division=0)
    cm = confusion_matrix(y, pred, labels=TIERS)
    m = {"accuracy": round(float(accuracy_score(y, pred)), 3), "macro_f1": round(float(f1_score(y, pred, average="macro", labels=TIERS)), 3),
         "hot_recall": round(float(r_[0]), 3), "hot_precision": round(float(p[0]), 3),
         "hot_predicted_cold": int(cm[0][2]), "confusion[rows=true hot/warm/cold]": cm.tolist()}
    res[name] = m
    print(f"\n{name}: acc {m['accuracy']}  macroF1 {m['macro_f1']}  hot recall {m['hot_recall']}  hot precision {m['hot_precision']}  hot->cold errors {m['hot_predicted_cold']}")
    print("   confusion (rows true hot/warm/cold; cols predicted):", cm.tolist())
Path("results").mkdir(exist_ok=True); json.dump(res, open("results/lead_eval.json", "w"), indent=1)
print("\nsaved results/lead_eval.json" + ("   <- SMOKE TEST: do not report as a result" if smoke else ""))
