"""Transparent, explainable lead scoring. Every point of the score is traceable to a
feature, a weight and the evidence phrase that produced it."""
from . import config

LABELS = {"intent": "Intent strength", "timeline": "Purchase timeline", "budget_fit": "Budget / commercial fit",
          "requirement_fit": "Requirement fit", "urgency": "Urgency", "contact": "Contact provided",
          "grounding": "Retrieval-grounding confidence"}


def _budget_fit(ent):
    b = ent.get("budget")
    if not b:
        return 0.0, "no budget stated"
    usd = b["amount"] / config.FX_INR_PER_USD if b["currency"] == "INR" else b["amount"]
    team = ent.get("team_size")
    if team:
        need = team * config.MIN_PRICE_PER_AGENT_USD
        return (1.0 if usd >= need else 0.4), f"{b['text']} vs ~${need:.0f}/mo minimum for {team} agents"
    return 0.7, f"{b['text']} (team size unknown)"


def score_lead(intent, intent_conf, ent, grounding_conf, grounded_ok):
    f, ev = {}, {}
    f["intent"] = config.INTENT_VALUE.get(intent, 0.1) * (0.6 + 0.4 * intent_conf)
    ev["intent"] = f"{intent} (confidence {intent_conf:.2f})"
    tl = ent.get("timeline")
    f["timeline"] = tl["score"] if tl else 0.2
    ev["timeline"] = f"\"{tl['phrase']}\" -> {tl['label']}" if tl else "no timeline stated"
    f["budget_fit"], ev["budget_fit"] = _budget_fit(ent)
    req = 0.6 if ent.get("products") else 0.0
    req += 0.2 if ent.get("team_size") else 0.0
    req += 0.2 if grounded_ok else 0.0
    f["requirement_fit"] = req
    ev["requirement_fit"] = ", ".join(filter(None, [
        "products: " + "/".join(ent["products"]) if ent.get("products") else "",
        f"team size {ent['team_size']}" if ent.get("team_size") else "",
        "answerable from KB" if grounded_ok else ""])) or "no concrete requirement detected"
    f["urgency"] = 1.0 if ent.get("urgency_phrase") else 0.0
    # Time words ("today", "urgent") only signal buying urgency when the enquiry is commercial; a support
    # ticket or small talk saying "today" is not a purchase timeline.
    gate = 1.0 if intent in config.COMMERCIAL_INTENTS else 0.25
    f["timeline"] *= gate
    f["urgency"] *= gate
    ev["urgency"] = f"\"{ent['urgency_phrase']}\"" if ent.get("urgency_phrase") else "no urgency language"
    f["contact"] = 1.0 if (ent.get("email") or ent.get("phone")) else 0.5 if ent.get("name") else 0.0
    ev["contact"] = "email/phone given" if f["contact"] == 1.0 else "name only" if f["contact"] else "none"
    f["grounding"] = grounding_conf
    ev["grounding"] = f"{grounding_conf:.2f}"
    parts = []
    total = 0.0
    for k, w in config.SCORE_WEIGHTS.items():
        c = round(100 * w * min(1.0, f[k]), 1)
        total += c
        parts.append({"feature": LABELS[k], "value": round(min(1.0, f[k]), 2), "weight": w, "points": c, "evidence": ev[k]})
    score = round(total)
    tier = "hot" if score >= config.TIER_HOT else "warm" if score >= config.TIER_WARM else "cold"
    return {"score": score, "tier": tier, "explanation": parts}
