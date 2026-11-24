"""Regenerate docs/openapi.json and docs/examples/*.json from the REAL backend. Run from backend/ after any API change:
    python scripts/export_contract.py     then commit the docs/ changes and tell the frontend owner."""
import json, os, sys, tempfile
sys.path.insert(0, ".")
os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "ex.db")
from fastapi.testclient import TestClient
from app.main import app
ex = "../docs/examples/"; os.makedirs(ex, exist_ok=True)
with TestClient(app) as c:
    for n, t in {"enquiry_hot": "Hi, I'm Priya Nair from Zenith Retail. We have 25 agents, budget $2000/month and want a demo this week. priya@zenith.in",
                 "enquiry_warm": "Do you integrate with Salesforce and HubSpot? We might need it later this year.",
                 "enquiry_refused": "What is the weather in Paris today?",
                 "enquiry_complaint": "I was charged twice this month and I am very unhappy."}.items():
        json.dump(c.post("/enquiry", json={"text": t}).json(), open(ex + n + ".json", "w"), indent=2, ensure_ascii=False)
    for t in ["Please send the contract for Enterprise, 120 seats, sign this month. legal@novacare.org", "How do I reset my password?",
              "What does the Growth plan cost per agent?", "Can we book a demo tomorrow? 70 agents, Salesforce integration. sara@eastgate.co"]:
        c.post("/enquiry", json={"text": t})
    for n, path in {"lead_list": "/leads", "analytics": "/analytics", "health": "/health"}.items():
        json.dump(c.get(path).json(), open(ex + n + ".json", "w"), indent=2, ensure_ascii=False)
json.dump(app.openapi(), open("../docs/openapi.json", "w"), indent=2)
print("docs/openapi.json and docs/examples/ regenerated")
