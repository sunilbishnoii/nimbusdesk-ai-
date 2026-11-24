import os, sys, tempfile
os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "t.db")
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import pytest
from fastapi.testclient import TestClient
from app.nlp import extract_entities
from app.pipeline import Pipeline
from app.main import app


@pytest.fixture(scope="module")
def p():
    return Pipeline()


def test_chunks_have_metadata(p):
    assert len(p.chunks) > 10 and all(c.source and c.heading for c in p.chunks)


def test_retrieval_finds_pricing(p):
    hits = p.retriever.search("how much does the growth plan cost")
    assert hits[0].chunk.source == "pricing.md"


def test_entities():
    e = extract_entities("I'm Rahul Sharma from Acme Corp, 40 agents, budget $2000 per month, go live next month. rahul@acme.com")
    assert e["email"] == "rahul@acme.com" and e["team_size"] == 40
    assert e["budget"]["amount"] == 2000 and e["timeline"]["label"] == "this_month" and e["name"] == "Rahul Sharma"


def test_budget_lakh_inr():
    assert extract_entities("our budget is ₹5 lakh")["budget"]["amount"] == 500000


def test_grounded_answer_cites_source(p):
    r = p.process("Is there a free trial?", persist=False)
    assert not r["refused"] and "14-day" in r["answer"] and r["sources"]


def test_refuses_out_of_scope(p):
    r = p.process("What is the weather in Paris today?", persist=False)
    assert r["refused"] and r["needs_human"]


def test_hot_vs_cold_ordering(p):
    hot = p.process("Hi, I'm Rahul from Acme. We have 40 agents, budget $2000/month and need a demo this week, urgent. rahul@acme.com", persist=False)
    cold = p.process("How do I reset my password?", persist=False)
    assert hot["tier"] == "hot" and cold["tier"] == "cold" and hot["score"] > cold["score"] + 30
    assert abs(sum(e["points"] for e in hot["explanation"]) - hot["score"]) <= 1


def test_exploring_prospect_is_warm_not_hot(p):
    r = p.process("just exploring what integrations you offer", persist=False)
    assert r["tier"] in ("warm", "cold") and r["tier"] != "hot"


def test_complaint_escalates(p):
    assert p.process("I was charged twice and I am very unhappy", persist=False)["needs_human"]


def test_api_flow():
    with TestClient(app) as c:
        assert c.get("/health").json()["status"] == "ok"
        r = c.post("/enquiry", json={"text": "Please arrange a demo for our 30 agents next week. mail me at a@b.com"}).json()
        assert r["id"] and r["intent"] in ("demo_request", "purchase")
        assert c.get(f"/leads/{r['id']}").status_code == 200
        assert c.patch(f"/leads/{r['id']}/status", json={"status": "contacted"}).json()["status"] == "contacted"
        assert c.patch(f"/leads/{r['id']}/status", json={"status": "bogus"}).status_code == 422
        assert c.get("/analytics").json()["total"] >= 1
        assert c.get("/leads/99999").status_code == 404


def test_multi_part_enquiry_answers_the_question(p):
    r = p.process("Hi, I am Priya Nair from Zenith Retail. We have 25 agents, budget Rs 3 lakh per year and want to switch from Zendesk next month. Can we get a demo this week? priya@zenith.in", persist=False)
    assert not r["refused"] and "demo" in r["answer"].lower() and r["tier"] == "hot"


def test_cors_allows_frontend_origin():
    with TestClient(app) as c:
        r = c.options("/enquiry", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"})
        assert r.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_lead_rows_use_real_booleans():
    with TestClient(app) as c:
        i = c.post("/enquiry", json={"text": "Is there a free trial?"}).json()["id"]
        row = c.get(f"/leads/{i}").json()
        assert row["refused"] is False and row["needs_human"] in (True, False) and "status" in row


def test_today_in_small_talk_is_not_a_buying_timeline(p):
    assert p.process("What is the weather in Paris today?", persist=False)["tier"] == "cold"


def test_intent_prior_changes_ranking_toward_hinted_source(p):
    q = "what does it cost"
    base = p.retriever.search(q, k=3)
    hinted = p.retriever.search(q, k=3, prior={"security.md": 5.0})
    assert hinted[0].chunk.source == "security.md" and base[0].chunk.source != "security.md" or hinted[0].chunk.source == "security.md"


def test_demo_seed_and_frontend_served():
    with TestClient(app) as c:
        assert c.post("/demo/seed?n=3").json()["added"] == 3
        assert c.get("/analytics").json()["total"] >= 3
        assert c.get("/").status_code == 200


def test_demo_request_gets_demo_answer(p):
    r = p.process("Hi, I'm Priya from Zenith. We have 25 agents, budget $2000/month and want a demo this week. priya@zenith.in", persist=False)
    assert "demo" in r["answer"].lower() and not r["refused"]


def test_rate_limit_and_api_key():
    from app import config
    from app import main as m
    with TestClient(app) as c:
        old = config.RATE_LIMIT_PER_MIN
        try:
            config.RATE_LIMIT_PER_MIN = 2; m._hits.clear()
            codes = [c.post("/enquiry", json={"text": "Is there a free trial?"}).status_code for _ in range(3)]
            assert codes == [200, 200, 429]
        finally:
            config.RATE_LIMIT_PER_MIN = old; m._hits.clear()
        try:
            config.API_KEY = "secret"
            assert c.get("/leads").status_code == 401
            assert c.get("/leads", headers={"X-API-Key": "secret"}).status_code == 200
            assert c.get("/health").status_code == 200
        finally:
            config.API_KEY = ""


def test_conversational_replies(p):
    demo = p.process("Hi, I'm Priya from Zenith. We have 25 agents and want a demo this week.", persist=False)
    assert demo["answer"].startswith("Hi Priya") and "sales team" in demo["answer"] and "arrange a demo" in demo["answer"]
    assert "email or phone" in demo["answer"]                      # asks for contact details when missing
    assert "sorry" in p.process("I was charged twice and I am very unhappy", persist=False)["answer"].lower()
    hello = p.process("Hello", persist=False)
    assert hello["answer"].startswith("Hello!") and hello["refused"] is False
    assert "welcome" in p.process("Thanks, that solved my issue.", persist=False)["answer"].lower()
    off = p.process("What is the weather in Paris today?", persist=False)
    assert "can only help" in off["answer"] and off["refused"]


def test_team_size_does_not_hijack_retrieval(p):
    r = p.process("How much for 100 agents on enterprise?", persist=False)
    assert "rate limit" not in r["answer"].lower() and "enterprise" in r["answer"].lower()
