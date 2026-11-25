import os
from contextlib import asynccontextmanager
import csv
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import time
from collections import defaultdict, deque
from fastapi import Request
from fastapi.responses import JSONResponse
from . import config, store
from .pipeline import Pipeline

state = {}


@asynccontextmanager
async def lifespan(app):
    state["p"] = Pipeline()
    yield


app = FastAPI(title="NLP-RAG Customer Enquiry & Lead Management", version="0.1.0", lifespan=lifespan)


_hits: dict = defaultdict(deque)


@app.middleware("http")
async def guard(request: Request, call_next):
    path = request.url.path
    if config.API_KEY and request.method != "OPTIONS" and path not in ("/", "/health") and not path.startswith("/assets"):
        if request.headers.get("x-api-key") != config.API_KEY:
            return JSONResponse({"detail": "invalid or missing API key"}, status_code=401)
    if request.method == "POST" and path in ("/enquiry", "/demo/seed"):
        q, now = _hits[request.client.host if request.client else "?"], time.time()
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= config.RATE_LIMIT_PER_MIN:
            return JSONResponse({"detail": "rate limit exceeded, try again in a minute"}, status_code=429)
        q.append(now)
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","),
    allow_methods=["*"], allow_headers=["*"],
)


class Enquiry(BaseModel):
    text: str = Field(min_length=2, max_length=4000)
    channel: str = "web"
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    company: str | None = None
    lead_id: int | None = None


class Status(BaseModel):
    status: str = Field(pattern="^(new|contacted|qualified|won|lost)$")


@app.get("/health")
def health():
    p = state["p"]
    return {"status": "ok", "chunks": len(p.chunks), "llm": p.llm.name}


@app.post("/enquiry")
def enquiry(e: Enquiry):
    return state["p"].process(e.text, e.channel, e.name, e.email, e.phone, e.company, e.lead_id)


@app.get("/leads")
def leads(tier: str | None = None, min_score: int = 0, limit: int = 100):
    return store.list_leads(tier, min_score, limit)


@app.get("/leads/{lead_id}")
def lead(lead_id: int):
    r = store.get(lead_id)
    if not r:
        raise HTTPException(404, "not found")
    return r


@app.patch("/leads/{lead_id}/status")
def set_status(lead_id: int, s: Status):
    if not store.get(lead_id):
        raise HTTPException(404, "not found")
    store.set_status(lead_id, s.status)
    return {"id": lead_id, "status": s.status}


@app.get("/analytics")
def analytics():
    return store.analytics()


@app.post("/kb/reload")
def kb_reload():
    state["p"].reload()
    return {"chunks": len(state["p"].chunks)}


@app.post("/demo/seed")
def demo_seed(n: int = 15):
    """Run sample enquiries (data/eval/leads_enquiries.csv) through the REAL pipeline so a demo dashboard has content."""
    n = max(1, min(n, 40))
    src = Path(__file__).parent.parent / "data" / "eval" / "leads_enquiries.csv"
    rows = list(csv.DictReader(open(src, encoding="utf-8-sig")))
    step = max(1, len(rows) // n)
    for r in rows[::step][:n]:
        state["p"].process(r["text"], r["channel"])
    return {"added": len(rows[::step][:n])}


STATIC = Path(__file__).parent.parent / "static"
if (STATIC / "assets").exists():
    app.mount("/assets", StaticFiles(directory=STATIC / "assets"), name="assets")


@app.get("/", response_class=HTMLResponse)
def ui():
    if (STATIC / "index.html").exists():
        return FileResponse(STATIC / "index.html")
    return (Path(__file__).parent / "ui.html").read_text(encoding="utf-8")
