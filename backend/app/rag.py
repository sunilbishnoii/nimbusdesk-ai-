"""RAG generation with hallucination control: grounded prompt, confidence gate, refusal."""
import re
from . import config
from .retrieval import tokenize, coverage


def grounding_confidence(query: str, hits) -> float:
    """Heuristic in [0,1]. Lexical coverage of the query by the top chunks, scaled by the
    semantic similarity of the best chunk. Zero lexical support => zero confidence, because
    dense similarity alone is unreliable on small corpora (it scored an off-topic query 0.75)."""
    if not hits:
        return 0.0
    qt = tokenize(query)
    union = set()
    for h in hits:
        union |= set(tokenize(h.chunk.index_text))
    cov = coverage(qt, union)
    return round(cov * (0.5 + 0.5 * max(0.0, hits[0].dense_cos)), 3)


class ExtractiveLLM:
    """Offline, fully grounded generator: returns the best-matching evidence sentences."""
    name = "extractive"

    def generate(self, query, hits):
        qt = set(tokenize(query))
        cands = []
        for rank, h in enumerate(hits):
            for sent in re.split(r"(?<=[.!?])\s+", h.chunk.text):
                st = set(tokenize(sent))
                if st & qt:
                    cands.append((len(st & qt) / (len(qt) or 1) - 0.05 * rank, rank, sent))
        cands.sort(key=lambda x: -x[0])
        top = cands[0][0] if cands else 0
        picked, seen = [], set()
        for sc, rank, sent in cands:
            if sc >= 0.6 * top and sent not in seen and len(picked) < 2:   # keep only close matches
                picked.append((rank, sent)); seen.add(sent)
        picked.sort()
        return " ".join(f"{s} [{r + 1}]" for r, s in picked)


class AnthropicLLM:
    """Optional LLM backend (set LLM_BACKEND=anthropic and ANTHROPIC_API_KEY)."""
    name = "anthropic"
    SYSTEM = ("You are a customer-enquiry assistant for NimbusDesk. Answer ONLY from the numbered context. "
              "Cite sources like [1]. If the context does not contain the answer, say you do not have that "
              "information and that a team member will follow up. Never invent prices, dates or policies.")

    def generate(self, query, hits):
        import httpx
        ctx = "\n".join(f"[{i + 1}] ({h.chunk.source} / {h.chunk.heading}) {h.chunk.text}" for i, h in enumerate(hits))
        r = httpx.post("https://api.anthropic.com/v1/messages", timeout=60,
                       headers={"x-api-key": config.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01"},
                       json={"model": config.LLM_MODEL, "max_tokens": 400, "system": self.SYSTEM,
                             "messages": [{"role": "user", "content": f"Context:\n{ctx}\n\nCustomer enquiry: {query}"}]})
        r.raise_for_status()
        return "".join(b.get("text", "") for b in r.json()["content"]).strip()


def get_llm():
    return AnthropicLLM() if config.LLM_BACKEND == "anthropic" and config.ANTHROPIC_API_KEY else ExtractiveLLM()


REFUSAL = ("I'm sorry, I don't have reliable information on that. I've passed your enquiry to our team "
           "and someone will follow up with you.")


_QWORDS = re.compile(r"^(how|what|which|who|when|where|why|can|could|do|does|is|are|will|would|should|may)\b", re.I)


def focus_queries(text: str):
    """Real enquiries mix greetings, names and budgets with the actual request, and the request is often a
    statement ("we want a demo this week"), not a question. Score every sentence plus the full text and
    keep the best-supported one, so unrelated words do not dilute grounding."""
    sents = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if len(tokenize(s)) >= 2]
    return sents + [text] if len(sents) > 1 else [text]


_TEAMSIZE = re.compile(r"\b\d[\d,]*\s*(?:agents?|users?|seats?|people|members?|employees?|staff|reps?)\b", re.I)


def answer(query, retriever, llm, prior=None, hint=""):
    query = _TEAMSIZE.sub(" ", query)       # team sizes ("100 agents") are lead details, not search terms (they matched "100 requests")
    best = None
    for q in focus_queries(query):
        # try the customer's own wording AND the wording plus an intent hint (e.g. "product demo"); keep the better-supported one
        for qh in ([q, f"{q} {hint}".strip()] if hint else [q]):
            hits = retriever.search(qh, mode="hybrid_rerank", prior=prior)
            conf = grounding_confidence(qh, hits)
            if best is None or conf > best[0]:
                best = (conf, qh, hits)
    conf, q, hits = best
    if conf < config.GROUNDING_THRESHOLD:
        return {"answer": REFUSAL, "grounding_confidence": conf, "refused": True, "sources": []}
    sources = [{"n": i + 1, "source": h.chunk.source, "heading": h.chunk.heading} for i, h in enumerate(hits)]
    text = llm.generate(q, hits) or REFUSAL
    return {"answer": text, "grounding_confidence": conf, "refused": text == REFUSAL, "sources": sources, "answered_question": q}
