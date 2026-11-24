// Modern Conversational Mock API with Appointment Booking & Pipeline Revenue
import http from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "docs", "examples");
const load = (n) => JSON.parse(readFileSync(join(dir, n), "utf8"));
let rawLeads = load("lead_list.json");

// Enrich initial leads with estimated revenue
let leads = rawLeads.map((l) => {
  let est = 0;
  if (l.entities?.budget?.amount) {
    est = l.entities.budget.amount * 12;
  } else if (l.entities?.team_size) {
    est = l.entities.team_size * 79 * 12;
  } else if (l.tier === "hot") {
    est = 18000;
  } else if (l.tier === "warm") {
    est = 6500;
  } else {
    est = 1200;
  }
  return {
    ...l,
    estimated_revenue: est,
  };
});

let nextId = Math.max(0, ...leads.map((l) => l.id)) + 1;
let appointments = [
  { id: "apt-1", lead_id: 1, customer_name: "Priya Nair", service: "Enterprise Demo", date: "2026-11-25", time_slot: "2:30 PM", status: "confirmed" },
  { id: "apt-2", lead_id: 3, customer_name: "Marcus Vance", service: "Platform Migration Consultation", date: "2026-11-26", time_slot: "11:00 AM", status: "confirmed" },
];

/* ── Entity Extraction ──────────────────────────────────────── */
function extractName(text) {
  const patterns = [
    /(?:i am|i'm|my name is|this is|name's|i'm called)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i,
    /(?:^|\.\s*)hi,?\s+(?:this is\s+)?([A-Za-z]+)/i,
    /([A-Za-z]+)\s+here\b/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const parts = m[1].trim().split(/\s+/).filter(w => !['and', 'from', 'at', 'with', 'who', 'wanted', 'want', 'seeking', 'looking', 'need', 'i', 'the'].includes(w.toLowerCase()));
      if (parts.length > 0) {
        return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
      }
    }
  }
  return null;
}
function extractEmail(text) { const m = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/); return m ? m[0] : null; }
function extractPhone(text) { const m = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/); return m ? m[0] : null; }
function extractCompany(text) {
  const m = text.match(/(?:from|at|company|org|organization)\s+([A-Z][A-Za-z\s&]+?)(?:\.|,|$|\s+(?:we|and|i|our))/i);
  return m ? m[1].trim() : null;
}
function extractService(text) {
  const m = text.match(/(?:appoint[a-z]*|book[a-z]*|schedul[a-z]*|meet[a-z]*|need[a-z]*|want[a-z]*|looking for)\s+(?:with|for|a|an|w|w\/)\s+(?:a\s+|an\s+)?([a-zA-Z\s]+?)(?:\.|,|!|\?|$)/i);
  return m ? m[1].trim().replace(/\s+/g, ' ') : null;
}
function extractBudget(text) {
  const m = text.match(/(?:\$|usd|inr|rs\.?|€)\s?([\d,]+)(?:\s*(?:k|thousand|lakh|per month|\/mo|\/month|annual|year))?/i);
  if (m) {
    let num = parseFloat(m[1].replace(/,/g, ''));
    if (/k|thousand/i.test(m[0])) num *= 1000;
    return { amount: num, text: m[0] };
  }
  return null;
}

/* ── Score & Explanation ──────────────────────────────────────── */
function makeExplanation(score, ent) {
  const intentPts = Math.min(30, Math.round(score * 0.35));
  const cFields = (ent.name?1:0) + (ent.email?1:0) + (ent.phone?1:0) + (ent.company?1:0);
  const contactPts = Math.min(20, cFields * 5);
  const budgetPts = ent.budget ? 15 : 0;
  const timePts = ent.timeline ? 12 : (ent.urgency_phrase ? 8 : 0);
  const remaining = Math.max(0, score - intentPts - contactPts - budgetPts - timePts);
  return [
    { feature: "intent_signal", value: intentPts/30, weight: 0.30, points: intentPts, evidence: "High buyer/booking intent detected" },
    { feature: "contact_completeness", value: cFields/4, weight: 0.20, points: contactPts, evidence: cFields ? `${cFields} direct contact field(s) captured` : "Anonymous visitor" },
    { feature: "budget_velocity", value: budgetPts/15, weight: 0.15, points: budgetPts, evidence: ent.budget ? `Declared budget: ${ent.budget.text}` : "No pricing constraints mentioned" },
    { feature: "timeline_urgency", value: timePts/15, weight: 0.15, points: timePts, evidence: ent.timeline?.phrase ?? ent.urgency_phrase ?? "Flexible timeline" },
    { feature: "nlp_confidence", value: remaining/20, weight: 0.20, points: remaining, evidence: "Grounded semantic context score" },
  ];
}

function calculateEstimatedRevenue(score, ent, service) {
  if (ent.budget?.amount) {
    return ent.budget.amount * 12;
  }
  if (ent.team_size) {
    return ent.team_size * 89 * 12;
  }
  if (service) {
    return /enterprise|software|integration/i.test(service) ? 35000 : 750;
  }
  if (score >= 70) return 24000;
  if (score >= 40) return 9600;
  return 1800;
}

function makeLead(text, channel, overrides) {
  const ent = overrides.entities || {};
  const score = overrides.score ?? 35;
  const service = ent.service || extractService(text);
  const revenue = overrides.estimated_revenue || calculateEstimatedRevenue(score, ent, service);

  return {
    id: nextId++, text, channel,
    intent: "other", intent_conf: 0.75,
    entities: {}, answer: "", sources: [],
    grounding: 0, refused: false, needs_human: false,
    score, tier: score >= 70 ? "hot" : score >= 40 ? "warm" : "cold",
    explanation: makeExplanation(score, ent),
    latency_ms: Math.floor(45 + Math.random() * 140),
    name: null, email: null, phone: null, company: null,
    created_at: new Date().toISOString(), status: "new",
    estimated_revenue: revenue,
    ...overrides,
  };
}

/* ── Conversational Generator ────────────────────────────────── */
function generateResponse(text, channel) {
  const lower = text.toLowerCase().trim();
  const name = extractName(text);
  const email = extractEmail(text);
  const phone = extractPhone(text);
  const company = extractCompany(text);
  const budget = extractBudget(text);
  const service = extractService(text);
  const entities = { name, email, phone, company, budget, service };
  const greeting = name ? `Hey ${name}! ` : "Hey there! ";

  // 1. BRIEFING / 10-MINUTE CALL / APPOINTMENT FOLLOW-UP
  if (/brief|breif|10\s*min|15\s*min|quick\s*call|call\b|sync\b|calendar|consult/i.test(lower)) {
    const sName = "10-Minute Briefing";
    const answer = `${greeting}Awesome, let's lock in that 10-minute briefing! 🗓️⚡\n\nI've opened 3 immediate slots on our specialist's calendar below. Tap your preferred time to confirm, or tell me another time that works:`;
    const score = (email || phone) ? 90 : 80;
    const row = makeLead(text, channel, {
      intent: "demo_request", intent_conf: 0.95,
      entities: { ...entities, urgency_phrase: "10-minute briefing", service: sName },
      answer, grounding: 0.94, needs_human: true,
      score, name, email, phone, company,
      estimated_revenue: 24000,
    });
    leads.unshift(row);
    return row;
  }

  // 2. EMAIL OVERVIEW / SEND DETAILS
  if (/(?:email|mail|send|overview|packet|deck|summary)\b/i.test(lower) && !/appoint|meet|book/i.test(lower)) {
    const emailFound = email || entities.email;
    const answer = emailFound
      ? `${greeting}I've dispatched your personalized executive overview packet to **${emailFound}**! 📄✨\n\nWould you also like to schedule a 10-minute live demo to see the models in action?`
      : `${greeting}You got it! 📄\n\nPlease drop your email address below, and I'll send over the executive summary and technical architecture guide right away!`;
    const row = makeLead(text, channel, {
      intent: "product_info", intent_conf: 0.92,
      entities: { ...entities, urgency_phrase: "overview packet requested" },
      answer, grounding: 0.91,
      score: 65, name, email, phone, company,
      estimated_revenue: 12000,
    });
    leads.unshift(row);
    return row;
  }

  // 3. AFFIRMATIVE ("yes", "sure", "ok", "sounds good", "option 1")
  if (/^(yes|sure|yeah|yep|ok|okay|definitely|let's do it|sounds good|first option|option 1|please do)\b/i.test(lower)) {
    const answer = `${greeting}Fantastic, let's get you on the schedule! 🚀\n\nPick one of our open availability slots below, or let me know your preferred day and time:`;
    const row = makeLead(text, channel, {
      intent: "demo_request", intent_conf: 0.93,
      entities: { ...entities, urgency_phrase: "agreed to schedule meeting", service: "10-Minute Briefing" },
      answer, grounding: 0.92, needs_human: true,
      score: 82, name, email, phone, company,
      estimated_revenue: 24000,
    });
    leads.unshift(row);
    return row;
  }

  // 4. APPOINTMENT / BOOKING / SERVICE REQUEST (e.g. carpenter, specialist)
  if (/appoint[a-z]*|schedule|book|booking|meet|meeting|carpenter|plumber|electrician/i.test(lower)) {
    const sName = service || (/carpenter/i.test(lower) ? "Carpenter Service" : "Specialist Consultation");
    const answer = `${greeting}I've set up an appointment slot for your **${sName}** right away! ⚡\n\nI found 3 immediate openings for you:\n\n👉 Pick a preferred slot below to instantly confirm, or let me know a custom time!`;
    const score = (email || phone) ? 88 : (name ? 75 : 65);
    const row = makeLead(text, channel, {
      intent: "demo_request", intent_conf: 0.94,
      entities: { ...entities, urgency_phrase: `appointment for ${sName}`, service: sName },
      answer, grounding: 0.92, needs_human: true,
      score, name, email, phone, company,
      estimated_revenue: calculateEstimatedRevenue(score, entities, sName),
    });
    leads.unshift(row);
    return row;
  }

  // 2. DEMO / PRICING / ENTERPRISE
  if (/demo|buy|contract|quote|purchase|upgrade|pricing|price|cost|tier/i.test(lower)) {
    const answer = `${greeting}Excited to have you exploring NimbusDesk! 🚀\n\nHere's our intelligent tier lineup:\n\n• **Starter**: $29/mo (Up to 5 agents, Core NLP intent routing)\n• **Growth**: $89/mo (Up to 25 agents, Hybrid RAG + Lead Scoring)\n• **Enterprise**: Custom (Unlimited agents, SOC-2, Custom fine-tuned SLMs)\n\nWant to schedule a live product walk-through or get a tailored quote for your team?`;
    const score = (email || phone) ? 92 : (name ? 82 : 74);
    const row = makeLead(text, channel, {
      intent: "pricing", intent_conf: 0.96,
      entities, answer, grounding: 0.95,
      sources: [{ n: 1, source: "pricing.md", heading: "Tier overview & SLAs" }],
      score, name, email, phone, company,
      estimated_revenue: calculateEstimatedRevenue(score, entities),
    });
    leads.unshift(row);
    return row;
  }

  // 3. COMPLAINTS / ISSUES
  if (/charged|unhappy|refund|cancel|crash|disappoint|angry|broken|bug|issue|problem/i.test(lower)) {
    const answer = `${greeting}I hear you, and I sincerely apologize for the friction. 🤍\n\nI have automatically prioritized your ticket as **P1 High Priority** for our senior success leads. A team member is actively reviewing your account log right now.\n\nTicket reference: **#ND-${Math.floor(1000 + Math.random() * 9000)}**`;
    const row = makeLead(text, channel, {
      intent: "complaint", intent_conf: 0.95,
      entities, answer, grounding: 0.85, needs_human: true,
      score: 30, name, email, phone, company,
    });
    leads.unshift(row);
    return row;
  }

  // 4. GENERAL GREETING / INQUIRY
  if (/^(hi|hello|hey|yo|namaste|sup|good)/i.test(lower) && lower.length < 35) {
    const answer = `${greeting}Welcome to **NimbusDesk** · The next-gen NLP & RAG Lead Automation Engine. ✨\n\nHow can I accelerate your day?\n\n• 📅 Book an expert service or appointment\n• ⚡ Get real-time pricing and plan recommendations\n• 🧠 Ask technical questions about our RAG architecture`;
    const row = makeLead(text, channel, {
      intent: "product_info", intent_conf: 0.82,
      entities, answer, grounding: 0.90,
      score: 20, name, email, phone, company,
    });
    leads.unshift(row);
    return row;
  }

  // 5. DEFAULT FALLBACK
  const answer = `${greeting}Thanks for reaching out! 🙏\n\nI've analyzed your enquiry through our semantic classifier and mapped it to our knowledge base. Would you like to schedule a quick 10-minute briefing or have me email you a personalized overview?`;
  const score = (email || company) ? 65 : 45;
  const row = makeLead(text, channel, {
    intent: "product_info", intent_conf: 0.78,
    entities, answer, grounding: 0.75,
    score, name, email, phone, company,
  });
  leads.unshift(row);
  return row;
}

/* ── Analytics ───────────────────────────────────────────────── */
function analytics() {
  const n = leads.length || 1;
  const c = (k) => leads.reduce((a, l) => a + (l[k] ? 1 : 0), 0) / n;
  const count = (f) => leads.reduce((a, l) => ((a[l[f]] = (a[l[f]] ?? 0) + 1), a), {});
  const totalRev = leads.reduce((acc, l) => acc + (l.estimated_revenue || 0), 0);

  return {
    total: leads.length,
    avg_grounding: leads.reduce((a, l) => a + l.grounding, 0) / n,
    refusal_rate: c("refused"),
    avg_latency_ms: leads.reduce((a, l) => a + l.latency_ms, 0) / n,
    human_escalation_rate: c("needs_human"),
    by_tier: count("tier"),
    by_intent: count("intent"),
    total_revenue: totalRev,
    appointments_count: appointments.length,
  };
}

/* ── HTTP Server ─────────────────────────────────────────────── */
const send = (res, code, body) => {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(body));
};

const body = (req) => new Promise((ok) => {
  let s = "";
  req.on("data", (d) => (s += d));
  req.on("end", () => ok(s ? JSON.parse(s) : {}));
});

http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  const p = u.pathname;

  if (req.method === "OPTIONS") return send(res, 204, {});
  if (p === "/health") return send(res, 200, { status: "ok", chunks: 28, llm: "GenZ-NLP-RAG-Engine-v2" });
  if (p === "/analytics") return send(res, 200, analytics());

  if (p === "/enquiry" && req.method === "POST") {
    const b = await body(req);
    if (!b.text || b.text.length < 2) return send(res, 422, { detail: "text too short" });
    await new Promise(r => setTimeout(r, 200 + Math.random() * 350));
    return send(res, 200, generateResponse(b.text, b.channel ?? "web"));
  }

  // Appointment Booking
  const bookMatch = p.match(/^\/leads\/(\d+)\/book$/);
  if (bookMatch && req.method === "POST") {
    const leadId = +bookMatch[1];
    const b = await body(req);
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return send(res, 404, { detail: "Lead not found" });

    const newApt = {
      id: `apt-${Date.now()}`,
      lead_id: leadId,
      customer_name: lead.name || "Customer",
      service: b.service || lead.entities?.service || "Consultation",
      date: b.date || new Date().toISOString().split("T")[0],
      time_slot: b.slot || "2:00 PM",
      status: "confirmed",
    };
    appointments.unshift(newApt);
    lead.appointment = newApt;
    lead.status = "qualified";
    lead.score = Math.min(100, lead.score + 20);
    lead.tier = "hot";
    return send(res, 200, lead);
  }

  if (p === "/leads" && req.method === "GET") {
    const tier = u.searchParams.get("tier"), min = Number(u.searchParams.get("min_score") ?? 0);
    return send(res, 200, leads.filter((l) => (!tier || l.tier === tier) && l.score >= min).sort((a, b) => b.score - a.score));
  }

  let m = p.match(/^\/leads\/(\d+)$/);
  if (m) {
    const l = leads.find((x) => x.id === +m[1]);
    return l ? send(res, 200, l) : send(res, 404, { detail: "not found" });
  }

  m = p.match(/^\/leads\/(\d+)\/status$/);
  if (m && req.method === "PATCH") {
    const l = leads.find((x) => x.id === +m[1]);
    const b = await body(req);
    if (!l) return send(res, 404, { detail: "not found" });
    l.status = b.status;
    return send(res, 200, { id: l.id, status: l.status });
  }

  if (p === "/demo/seed" && req.method === "POST") {
    return send(res, 200, { added: 15 });
  }

  send(res, 404, { detail: "not found" });
}).listen(8000, () => console.log("Gen-Z NLP-RAG Mock Server on http://127.0.0.1:8000"));
