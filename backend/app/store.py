import json
import sqlite3
from datetime import datetime, timezone
from . import config

SCHEMA = """CREATE TABLE IF NOT EXISTS enquiries(
 id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT, channel TEXT, text TEXT,
 name TEXT, email TEXT, phone TEXT, company TEXT, intent TEXT, intent_conf REAL,
 entities TEXT, answer TEXT, sources TEXT, grounding REAL, refused INTEGER,
 score INTEGER, tier TEXT, explanation TEXT, needs_human INTEGER, status TEXT DEFAULT 'new', latency_ms REAL)"""


def conn():
    config.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(config.DB_PATH)
    c.row_factory = sqlite3.Row
    c.execute(SCHEMA)
    return c


def save(rec: dict) -> int:
    with conn() as c:
        cur = c.execute(
            """INSERT INTO enquiries(created_at,channel,text,name,email,phone,company,intent,intent_conf,entities,answer,
            sources,grounding,refused,score,tier,explanation,needs_human,latency_ms) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (datetime.now(timezone.utc).isoformat(timespec="seconds"), rec["channel"], rec["text"], rec.get("name"),
             rec.get("email"), rec.get("phone"), rec.get("company"), rec["intent"], rec["intent_conf"],
             json.dumps(rec["entities"]), rec["answer"], json.dumps(rec["sources"]), rec["grounding"],
             int(rec["refused"]), rec["score"], rec["tier"], json.dumps(rec["explanation"]),
             int(rec["needs_human"]), rec["latency_ms"]))
        return cur.lastrowid


def _row(r):
    d = dict(r)
    for k in ("entities", "sources", "explanation"):
        d[k] = json.loads(d[k])
    d["refused"] = bool(d["refused"]); d["needs_human"] = bool(d["needs_human"])
    return d


def get(i):
    with conn() as c:
        r = c.execute("SELECT * FROM enquiries WHERE id=?", (i,)).fetchone()
    return _row(r) if r else None


def list_leads(tier=None, min_score=0, limit=100):
    q, a = "SELECT * FROM enquiries WHERE score>=?", [min_score]
    if tier:
        q += " AND tier=?"; a.append(tier)
    with conn() as c:
        rows = c.execute(q + " ORDER BY score DESC, id DESC LIMIT ?", a + [limit]).fetchall()
    return [_row(r) for r in rows]


def set_status(i, status):
    with conn() as c:
        c.execute("UPDATE enquiries SET status=? WHERE id=?", (status, i))


def analytics():
    with conn() as c:
        r = lambda q: c.execute(q).fetchall()
        tot = r("SELECT COUNT(*) n, AVG(grounding) g, AVG(refused) rf, AVG(latency_ms) l, AVG(needs_human) h FROM enquiries")[0]
        return {"total": tot["n"], "avg_grounding": tot["g"], "refusal_rate": tot["rf"], "avg_latency_ms": tot["l"],
                "human_escalation_rate": tot["h"],
                "by_tier": {x["tier"]: x["n"] for x in r("SELECT tier, COUNT(*) n FROM enquiries GROUP BY tier")},
                "by_intent": {x["intent"]: x["n"] for x in r("SELECT intent, COUNT(*) n FROM enquiries GROUP BY intent")}}
