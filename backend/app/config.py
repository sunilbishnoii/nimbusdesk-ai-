"""Central configuration. All tunable research parameters live here."""
import os
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
KB_DIR = BASE / "kb"
DATA_DIR = BASE / "data"
DB_PATH = Path(os.getenv("DB_PATH", DATA_DIR / "leads.db"))

# --- chunking ---
CHUNK_WORDS = 70      # target words per chunk
CHUNK_OVERLAP = 20    # words of sentence overlap between chunks

# --- retrieval ---
TOP_K = 3
CANDIDATES = 10       # candidates taken from each retriever before fusion
RRF_K = 60            # reciprocal rank fusion constant

# --- generation / grounding ---
GROUNDING_THRESHOLD = float(os.getenv("GROUNDING_THRESHOLD", "0.30"))
LLM_BACKEND = os.getenv("LLM_BACKEND", "extractive")   # extractive | anthropic
LLM_MODEL = os.getenv("LLM_MODEL", "claude-sonnet-5-5")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# --- lead scoring (PROVISIONAL weights: replace by weights learned from real
#     conversion data once available; they must sum to 1.0) ---
SCORE_WEIGHTS = {
    "intent": 0.25, "timeline": 0.20, "budget_fit": 0.15,
    "requirement_fit": 0.15, "urgency": 0.10, "contact": 0.10, "grounding": 0.05,
}
INTENT_VALUE = {"purchase": 1.0, "demo_request": 1.0, "pricing": 0.8,
                "product_info": 0.5, "support": 0.1, "complaint": 0.05, "other": 0.1}
# PROVISIONAL thresholds: placed at the midpoints between the median scores of the authored synthetic set
# (hot~58, warm~29, cold~12). They are NOT validated: re-fit on a dev split of HUMAN-labelled data and report on a held-out split.
TIER_HOT, TIER_WARM = 45, 22
ESCALATE_INTENTS = {"complaint"}
COMMERCIAL_INTENTS = {"purchase", "demo_request", "pricing", "product_info"}

FX_INR_PER_USD = 83.0
MIN_PRICE_PER_AGENT_USD = 15.0    # cheapest plan, used for budget-fit check

PRODUCT_KEYWORDS = {
    "shared inbox": ["shared inbox", "inbox"],
    "live chat": ["live chat", "chat widget", "chatbot", "chat"],
    "automation": ["automation", "automate", "workflow", "rules"],
    "analytics": ["analytics", "report", "dashboard"],
    "ai replies": ["ai reply", "ai suggestion", "ai assistant"],
    "api / integrations": ["api", "webhook", "integration", "salesforce", "hubspot", "slack", "shopify", "whatsapp"],
    "enterprise security": ["sso", "single sign", "audit log", "saml"],
}

# Intent-aware retrieval: the classifier's predicted intent nudges retrieval toward the documents that usually answer it.
# Bonus added to the rerank score = INTENT_PRIOR_WEIGHT * classifier confidence. Set to 0 to disable.
INTENT_PRIOR_WEIGHT = 0.3
INTENT_SOURCES = {"pricing": ["pricing.md"], "product_info": ["features.md", "integrations.md", "security.md"],
                  "demo_request": ["onboarding.md"], "purchase": ["pricing.md", "onboarding.md"],
                  "support": ["support_policy.md", "onboarding.md"], "complaint": ["support_policy.md"], "other": []}

# Intent-aware query expansion: for these intents the customer's *request* (not their details) should drive retrieval.
INTENT_QUERY_HINT = {"demo_request": "product demo"}

# Basic hardening (both optional): set API_KEY to require an X-API-Key header; RATE_LIMIT_PER_MIN caps POSTs per client IP.
API_KEY = os.getenv("API_KEY", "")
RATE_LIMIT_PER_MIN = int(os.getenv("RATE_LIMIT_PER_MIN", "120"))
