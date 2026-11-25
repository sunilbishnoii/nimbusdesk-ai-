"""End-to-end pipeline: enquiry -> intent/entities -> hybrid retrieval -> grounded answer
-> lead extraction -> explainable scoring -> storage."""
import time
from . import config, store
from .ingest import build_chunks
from .leads import score_lead
from .nlp import IntentClassifier, extract_entities
from .compose import compose_reply, small_talk_kind
from .rag import answer, get_llm
from .retrieval import HybridRetriever


class Pipeline:
    def __init__(self):
        self.reload()

    def reload(self):
        self.chunks = build_chunks()
        self.retriever = HybridRetriever(self.chunks)
        self.intent_clf = IntentClassifier()
        self.llm = get_llm()

    def process(self, text, channel="web", name=None, email=None, phone=None, company=None, lead_id=None, persist=True):
        t0 = time.perf_counter()
        intent, iconf = self.intent_clf.predict(text)
        ent = extract_entities(text)
        if name: ent.setdefault("name", name)
        if email: ent.setdefault("email", email)
        if phone: ent.setdefault("phone", phone)
        if company: ent.setdefault("company", company)
        small = small_talk_kind(text)
        if small or intent == "complaint":      # nothing to look up: greetings, thanks, complaints get a direct reply
            rag = {"answer": "", "grounding_confidence": 0.0, "refused": False, "sources": []}
        else:
            prior = {src: config.INTENT_PRIOR_WEIGHT * iconf for src in config.INTENT_SOURCES.get(intent, [])}
            rag = answer(text, self.retriever, self.llm, prior=prior or None, hint=config.INTENT_QUERY_HINT.get(intent, ""))
        grounded_ok = bool(rag["answer"]) and not rag["refused"]
        lead = score_lead(intent, iconf, ent, rag["grounding_confidence"], grounded_ok)
        needs_human = rag["refused"] or intent in config.ESCALATE_INTENTS or lead["tier"] == "hot"
        reply = compose_reply(text, intent, ent, rag, lead["tier"], small)
        rec = {"channel": channel, "text": text, "intent": intent, "intent_conf": round(iconf, 3), "entities": ent,
               "answer": reply, "sources": rag["sources"], "grounding": rag["grounding_confidence"],
               "refused": rag["refused"], "needs_human": needs_human, "latency_ms": 0.0,
               "name": ent.get("name"), "email": ent.get("email"), "phone": ent.get("phone"),
               "company": ent.get("company"), **lead}
        rec["latency_ms"] = round((time.perf_counter() - t0) * 1000, 1)
        if persist:
            rec["id"] = store.save(rec)
        return rec
