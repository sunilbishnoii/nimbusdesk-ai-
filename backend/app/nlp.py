"""NLP layer: intent classification + rule/regex entity & lead-signal extraction."""
import json
import re
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from . import config


class IntentClassifier:
    def __init__(self, path=config.DATA_DIR / "intents.json"):
        data = json.loads(path.read_text(encoding="utf-8"))
        X = [t for lab, ts in data.items() for t in ts]
        y = [lab for lab, ts in data.items() for _ in ts]
        self.model = make_pipeline(TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True),
                                   LogisticRegression(max_iter=1000, C=10))
        self.model.fit(X, y)

    def predict(self, text: str):
        probs = self.model.predict_proba([text])[0]
        i = probs.argmax()
        return str(self.model.classes_[i]), float(probs[i])


_MULT = {"k": 1e3, "thousand": 1e3, "lakh": 1e5, "lakhs": 1e5, "lac": 1e5, "m": 1e6, "million": 1e6, "cr": 1e7, "crore": 1e7}
_BUDGET = re.compile(r"(?:budget\s*(?:of|is|around|about)?\s*)?(₹|rs\.?|inr|\$|usd|eur|€)\s?([\d][\d,]*(?:\.\d+)?)\s?(k|thousand|lakhs?|lac|crore|cr|million|m)?\b", re.I)
_BUDGET_SUFFIX = re.compile(r"\b([\d][\d,]*(?:\.\d+)?)\s?(k|lakhs?|lac|crore|cr)?\s?(usd|inr|dollars|rupees)\b", re.I)
_TEAM = re.compile(r"\b(\d{1,5})[\s-]*(?:agents?|users?|seats?|employees?|people|members?|reps?)\b", re.I)
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE = re.compile(r"(?<!\d)(?:\+?\d{1,3}[\s-]?)?[6-9]\d{9}(?!\d)|\+\d{1,3}[\s-]?\d{6,12}")
_NAME = re.compile(r"(?:my name is|i am|i'm|this is)\s+([a-zA-Z]+(?:\s[a-zA-Z]+)?)", re.I)
_COMPANY = re.compile(r"\b(?:from|at|with)\s+([a-zA-Z][\w&]+(?:\s[a-zA-Z][\w&]+){0,2})(?=[,.\s]|$)", re.I)

_TIMELINES = [
    ("immediate", 1.0, r"\b(asap|immediately|right away|today|tomorrow|this week|next week|within (?:a|1|2|\d)\s?days?|within (?:1|2)\s?weeks?)\b"),
    ("this_month", 0.8, r"\b(this month|next month|within a month|in 30 days|end of (?:the )?month|in (?:3|4)\s?weeks)\b"),
    ("this_quarter", 0.5, r"\b(this quarter|next quarter|q[1-4]\b|in (?:2|3|4|5|6)\s?months|couple of months)\b"),
    ("exploring", 0.15, r"\b(just (?:exploring|looking|browsing|curious)|no rush|someday|in the future|researching|early stage)\b"),
]
_URGENT = re.compile(r"\b(urgent(?:ly)?|asap|critical|deadline|going live|go live|launch(?:ing)?|immediately|emergency)\b", re.I)


def _amount(num, mult):
    v = float(num.replace(",", ""))
    return v * _MULT.get((mult or "").lower(), 1)


def extract_entities(text: str) -> dict:
    e = {}
    if m := _EMAIL.search(text): e["email"] = m.group()
    if m := _PHONE.search(text): e["phone"] = m.group().strip()
    if m := _NAME.search(text):
        parts = [p for p in m.group(1).split() if p.lower() not in ("and", "from", "at", "with", "who", "wanted", "want", "seeking", "looking", "need")]
        if parts: e["name"] = " ".join(parts).title()
    if m := _COMPANY.search(text): e["company"] = m.group(1)
    if m := _TEAM.search(text): e["team_size"] = int(m.group(1))
    if m := _BUDGET.search(text):
        cur = m.group(1).lower()
        cur = "INR" if cur in ("₹", "rs", "rs.", "inr") else "EUR" if cur in ("eur", "€") else "USD"
        e["budget"] = {"amount": _amount(m.group(2), m.group(3)), "currency": cur, "text": m.group(0).strip()}
    elif m := _BUDGET_SUFFIX.search(text):
        cur = "INR" if m.group(3).lower() in ("inr", "rupees") else "USD"
        e["budget"] = {"amount": _amount(m.group(1), m.group(2)), "currency": cur, "text": m.group(0).strip()}
    low = text.lower()
    for label, score, pat in _TIMELINES:
        if m := re.search(pat, low):
            e["timeline"] = {"label": label, "score": score, "phrase": m.group()}
            break
    if m := _URGENT.search(text): e["urgency_phrase"] = m.group().lower()
    prods = [p for p, kws in config.PRODUCT_KEYWORDS.items() if any(re.search(rf"\b{re.escape(k)}", low) for k in kws)]
    if prods: e["products"] = prods
    return e
