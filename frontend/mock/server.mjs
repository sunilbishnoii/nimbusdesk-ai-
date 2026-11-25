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

/* ── Conversational Generator with Multi-Turn Memory ────────── */
let activeSession = {
  name: null,
  email: null,
  phone: null,
  company: null,
  budget: null,
  service: null,
  lead_id: null,
};

function generateResponse(reqData, channel = "web") {
  const text = typeof reqData === "string" ? reqData : reqData.text;
  const incomingChannel = (typeof reqData === "object" && reqData.channel) ? reqData.channel : channel;
  const lower = text.toLowerCase().trim();

  // Merge session memory with incoming request params and regex extraction
  const extractedName = extractName(text);
  const extractedEmail = extractEmail(text);
  const extractedPhone = extractPhone(text);
  const extractedCompany = extractCompany(text);
  const extractedBudget = extractBudget(text);
  const extractedService = extractService(text);

  if (typeof reqData === "object") {
    if (reqData.name) activeSession.name = reqData.name;
    if (reqData.email) activeSession.email = reqData.email;
    if (reqData.phone) activeSession.phone = reqData.phone;
    if (reqData.company) activeSession.company = reqData.company;
  }

  if (extractedName) activeSession.name = extractedName;
  if (extractedEmail) activeSession.email = extractedEmail;
  if (extractedPhone) activeSession.phone = extractedPhone;
  if (extractedCompany) activeSession.company = extractedCompany;
  if (extractedBudget) activeSession.budget = extractedBudget;
  if (extractedService) activeSession.service = extractedService;

  const name = activeSession.name;
  const email = activeSession.email;
  const phone = activeSession.phone;
  const company = activeSession.company;
  const budget = activeSession.budget;
  const service = activeSession.service;

  const entities = { name, email, phone, company, budget, service };
  const greeting = name ? `Hey ${name}! ` : "Hey there! ";

  // ── CONTACT INFORMATION SHARING (Email / Phone Number) ──
  if (/\b(?:my\s+(?:email|mail|phone|number|contact)|call\s+me|reach\s+me|contact\s+me|[\w.+-]+@[\w-]+\.[\w.]+|(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})\b/i.test(lower)) {
    const contactParts = [];
    if (email) contactParts.push(`email **${email}**`);
    if (phone) contactParts.push(`phone **${phone}**`);
    const contactText = contactParts.length ? contactParts.join(" and ") : "your contact details";
    const answer = `${greeting}Thank you! I have linked ${contactText} to your lead profile in our system. 📋✨\n\nOur team now has your direct line to share personalized details. Would you also like to schedule a quick 10-minute briefing or product walkthrough?`;
    const score = 88;
    const row = makeLead(text, incomingChannel, {
      intent: "purchase", intent_conf: 0.95,
      entities, answer, grounding: 0.94, needs_human: true,
      score, name, email, phone, company,
      estimated_revenue: calculateEstimatedRevenue(score, entities),
    });
    leads.unshift(row);
    activeSession.lead_id = row.id;
    return row;
  }

  // ── EXPLICIT APPOINTMENT / BOOKING (must say appoint/book/schedule clearly) ──
  if (/\b(appoint[a-z]*|book\s+a[n]?\s+appoint|book\s+a\s+slot|book\s+a\s+demo|schedule\s+a[n]?\s+appoint|book\s+me\s+in|carpenter|plumber|electrician|handyman|service\s+visit)\b/i.test(lower)) {
    const sName = service || "General Consultation";
    const answer = `${greeting}I've found available slots for your **${sName}** request! 📅\n\nHere are 3 available time slots — tap to confirm:\n\n👉 Pick a preferred slot below to instantly confirm, or tell me a time that works better for you!`;
    const score = (email || phone) ? 88 : (name ? 75 : 65);
    const row = makeLead(text, incomingChannel, {
      intent: "demo_request", intent_conf: 0.94,
      entities: { ...entities, urgency_phrase: `appointment for ${sName}`, service: sName },
      answer, grounding: 0.92, needs_human: true,
      score, name, email, phone, company,
      estimated_revenue: calculateEstimatedRevenue(score, entities, sName),
    });
    leads.unshift(row);
    activeSession.lead_id = row.id;
    return row;
  }

  // ── EXPLICIT DEMO / MEETING REQUEST ──
  if (/\b(book\s+a\s+demo|schedule\s+a\s+demo|set\s+up\s+a\s+(call|meeting)|book\s+a\s+meeting|want\s+a\s+demo|request\s+a\s+demo|live\s+demo)\b/i.test(lower)) {
    const sName = "Live Product Demo";
    const answer = `${greeting}Awesome, let's lock in your live demo! 🗓️⚡\n\nI've opened 3 slots on our product specialist's calendar. Tap your preferred time to confirm:`;
    const score = (email || phone) ? 90 : 80;
    const row = makeLead(text, incomingChannel, {
      intent: "demo_request", intent_conf: 0.95,
      entities: { ...entities, urgency_phrase: "live demo request", service: sName },
      answer, grounding: 0.94, needs_human: true,
      score, name, email, phone, company,
      estimated_revenue: 24000,
    });
    leads.unshift(row);
    activeSession.lead_id = row.id;
    return row;
  }

  // ── BRIEFING / 10-MINUTE CALL ──
  if (/\b(brief(?:ing)?|10[\s-]?min(?:ute)?(?:\s+brief(?:ing)?|\s+call)?|quick\s+10|schedule\s+a\s+brief|10\s+minute\s+breif)\b/i.test(lower)) {
    const sName = "10-Minute Briefing";
    const answer = `${greeting}Awesome, let's lock in that 10-minute briefing! 🗓️⚡\n\nI've opened 3 immediate slots on our specialist's calendar below. Tap your preferred time to confirm:`;
    const score = (email || phone) ? 90 : 80;
    const row = makeLead(text, incomingChannel, {
      intent: "demo_request", intent_conf: 0.95,
      entities: { ...entities, urgency_phrase: "10-minute briefing", service: sName },
      answer, grounding: 0.94, needs_human: true,
      score, name, email, phone, company,
      estimated_revenue: 24000,
    });
    leads.unshift(row);
    activeSession.lead_id = row.id;
    return row;
  }

  // ── HOW NLP & LEAD SCORING WORKS ──
  if (/\b(how\s+does\s+(?:it|nlp|scoring|classifier|the\s+bot|lead\s+qualif)|explain\s+scoring|intent\s+classif|lead\s+scoring|how\s+do\s+you\s+qualify|explain\s+nlp)\b/i.test(lower)) {
    const answer = `${greeting}NimbusDesk qualifies leads in real-time through a 3-stage NLP pipeline:\n\n1. 🧠 **TF-IDF + Logistic Regression**: Classifies visitor intent across 6 commercial and support categories with probability confidence.\n2. 🔍 **Entity & Lead Signal Extraction**: Extracts decision-makers, email addresses, phone numbers, target companies, budgets, and urgency timelines.\n3. 📊 **Explainable Scoring (0-100)**: Evaluates weighted features (intent 30%, contact completeness 20%, budget velocity 15%, timeline 15%, context 20%) to dynamically assign **Hot**, **Warm**, or **Cold** tiers.\n\nWould you like to simulate a lead or see how pricing tiers compare?`;
    const row = makeLead(text, incomingChannel, {
      intent: "product_info", intent_conf: 0.97,
      entities, answer, grounding: 0.96,
      score: 75, name, email, phone, company,
      estimated_revenue: calculateEstimatedRevenue(75, entities),
    });
    leads.unshift(row);
    return row;
  }

  // ── HOW RAG & HYBRID RETRIEVAL WORKS ──
  if (/\b(how\s+does\s+rag\s+work|grounding|hallucinat|retrieval|hybrid\s+search|bm25|lsa|zero\s+hallucinat)\b/i.test(lower)) {
    const answer = `${greeting}Our Grounded RAG architecture guarantees zero hallucinations:\n\n• **Hybrid Search (BM25 + Dense LSA)**: Merges exact keyword matching with latent semantic vector representations.\n• **Reciprocal Rank Fusion (RRF)**: Fuses ranking lists with intent prior weight boosts.\n• **Grounding Verification Score**: Every response is mathematically scored for groundedness against our verified markdown knowledge base (threshold > 0.85). If unsupported, it transparently refers to a human agent.\n\nWould you like to know more about our integrations or enterprise security?`;
    const row = makeLead(text, incomingChannel, {
      intent: "product_info", intent_conf: 0.96,
      entities, answer, grounding: 0.98,
      score: 70, name, email, phone, company,
      estimated_revenue: calculateEstimatedRevenue(70, entities),
    });
    leads.unshift(row);
    return row;
  }

  // ── PRICING / PLANS / COST ──
  if (/\b(pricing|price|cost|plan|tier|quote|budget|how\s+much|per\s+month|monthly|annual|enterprise\s+plan|starter|growth)\b/i.test(lower)) {
    const answer = `${greeting}Great question! Here's a quick overview of **NimbusDesk** plans:\n\n• **Starter** — $29/agent/mo · Up to 5 agents · NLP intent routing & contact extraction\n• **Growth** — $89/agent/mo · Up to 25 agents · Hybrid RAG + Automated Appointment Slot Scheduling + Lead Scoring\n• **Enterprise** — Custom pricing · Unlimited agents · Dedicated SLMs, SOC-2, Custom Webhook pipelines\n\nAll plans include a **14-day free trial**. Would you like a custom quote for ${company || 'your team'}?`;
    const score = (email || phone) ? 88 : (name ? 78 : 68);
    const row = makeLead(text, incomingChannel, {
      intent: "pricing", intent_conf: 0.96,
      entities, answer, grounding: 0.95,
      sources: [{ n: 1, source: "pricing.md", heading: "Tier overview & SLAs" }],
      score, name, email, phone, company,
      estimated_revenue: calculateEstimatedRevenue(score, entities),
    });
    leads.unshift(row);
    return row;
  }

  // ── FEATURES / INTEGRATIONS / HOW IT WORKS ──
  if (/\b(feature|integrat|salesforce|hubspot|slack|zendesk|api|how\s+does|what\s+(can|does)|support|ticket|inbox|live\s+chat|automation|workflow|ai\s+reply|crm)\b/i.test(lower)) {
    const answer = `${greeting}NimbusDesk seamlessly connects with your existing stack:\n\n🔗 **CRM Integrations**: Two-way sync with Salesforce, HubSpot, and Zoho\n💬 **Messaging**: Live Chat widget, Slack, Zendesk, and Intercom\n⚡ **Webhooks & REST API**: Stream qualified leads and appointment bookings in real-time\n🧠 **AI Ingestion**: Point NimbusDesk to your documentation or knowledge base for automatic vector chunking\n\nWould you like to book a demo to see the Salesforce & HubSpot sync in action?`;
    const score = (email || phone) ? 78 : (name ? 68 : 55);
    const row = makeLead(text, incomingChannel, {
      intent: "product_info", intent_conf: 0.93,
      entities, answer, grounding: 0.92,
      sources: [{ n: 1, source: "features.md", heading: "Platform capabilities" }],
      score, name, email, phone, company,
      estimated_revenue: calculateEstimatedRevenue(score, entities),
    });
    leads.unshift(row);
    return row;
  }

  // ── FREE TRIAL / SIGN UP / GET STARTED ──
  if (/\b(free\s+trial|trial|sign\s+up|get\s+start|onboard|register|create\s+account|try\s+it|demo\s+account)\b/i.test(lower)) {
    const answer = `${greeting}You can start your **14-day free trial** in under 2 minutes — no credit card required! 🎉\n\n1. Visit **app.nimbusdesk.io/signup**\n2. Add your team agents\n3. Connect your inbox or ticketing system\n4. Let the NLP engine start qualifying leads automatically\n\nWant me to schedule a quick onboarding call to get you set up faster?`;
    const score = (email || phone) ? 85 : (name ? 70 : 58);
    const row = makeLead(text, incomingChannel, {
      intent: "pricing", intent_conf: 0.91,
      entities, answer, grounding: 0.93,
      score, name, email, phone, company,
      estimated_revenue: calculateEstimatedRevenue(score, entities),
    });
    leads.unshift(row);
    return row;
  }

  // ── EMAIL OVERVIEW / SEND DETAILS ──
  if (/\b(email|mail|send|overview|brochure|packet|deck|summary|whitepaper)\b/i.test(lower) && !/appoint|meet|book/i.test(lower)) {
    const emailFound = email || entities.email;
    const answer = emailFound
      ? `${greeting}I've dispatched a personalized overview packet to **${emailFound}**! 📄✨\n\nIt includes our feature breakdown, pricing tiers, and a case study. Would you like to also schedule a 10-minute live walkthrough?`
      : `${greeting}Happy to send that over! 📄\n\nPlease share your email address and I'll send the executive summary and technical architecture guide right away.`;
    const row = makeLead(text, incomingChannel, {
      intent: "product_info", intent_conf: 0.92,
      entities: { ...entities, urgency_phrase: "overview packet requested" },
      answer, grounding: 0.91,
      score: 65, name, email, phone, company,
      estimated_revenue: 12000,
    });
    leads.unshift(row);
    return row;
  }

  // ── AFFIRMATIVE follow-up ──
  if (/^(yes|sure|yeah|yep|ok|okay|definitely|sounds good|please do|go ahead)\b/i.test(lower)) {
    const answer = `${greeting}Awesome! What would you like to do next? 😊\n\n• 📅 **Book a demo** — say "book a demo" or "schedule a meeting"\n• 💰 **Compare pricing** — I can break down Starter vs Growth\n• 📄 **Get an email overview** — share your email address\n• 🧠 **Technical questions** — ask about our NLP or RAG architecture`;
    const row = makeLead(text, incomingChannel, {
      intent: "product_info", intent_conf: 0.75,
      entities, answer, grounding: 0.80,
      score: 45, name, email, phone, company,
      estimated_revenue: calculateEstimatedRevenue(45, entities),
    });
    leads.unshift(row);
    return row;
  }

  // ── COMPLAINTS / ISSUES ──
  if (/\b(charged|unhappy|refund|cancel|crash|disappoint|angry|broken|bug|issue|problem|not\s+working|failed|error)\b/i.test(lower)) {
    const answer = `${greeting}I sincerely apologize for the trouble — that should not have happened. 🤍\n\nYour ticket has been flagged as **P1 High Priority** and assigned to our senior success team. A specialist will follow up with you within 1 hour.\n\nTicket reference: **#ND-${Math.floor(1000 + Math.random() * 9000)}**`;
    const row = makeLead(text, incomingChannel, {
      intent: "complaint", intent_conf: 0.95,
      entities, answer, grounding: 0.85, needs_human: true,
      score: 30, name, email, phone, company,
    });
    leads.unshift(row);
    return row;
  }

  // ── GREETING ──
  if (/^(hi|hello|hey|yo|namaste|sup|good\s+(morning|afternoon|evening))/i.test(lower) && lower.length < 40) {
    const answer = `${greeting}Welcome to **NimbusDesk** — the AI-powered Lead Intelligence Platform! ✨\n\nI can help you with:\n\n• 💬 Answering questions about features, pricing, and integrations\n• 📅 Booking a demo or consultation\n• 🧠 Explaining how our NLP entity extraction & lead scoring works\n• 🎫 Raising a support ticket\n\nWhat can I help you with today?`;
    const row = makeLead(text, incomingChannel, {
      intent: "product_info", intent_conf: 0.82,
      entities, answer, grounding: 0.90,
      score: 25, name, email, phone, company,
    });
    leads.unshift(row);
    return row;
  }

  // ── CONVERSATIONAL FALLBACK (NEVER DEAD-END OR SAY "I DON'T KNOW") ──
  const answer = `${greeting}I'm actively following your conversation! ${company ? `I've noted you're with **${company}**.` : ''}\n\nI can help you explore our **NLP lead scoring**, explain our **grounded RAG engine**, compare **pricing tiers**, or book a **10-minute briefing** with our team.\n\nWhat would you like to dive into?`;
  const score = (email || company) ? 65 : 45;
  const row = makeLead(text, incomingChannel, {
    intent: "product_info", intent_conf: 0.76,
    entities, answer, grounding: 0.85,
    score, name, email, phone, company,
  });
  leads.unshift(row);
  return row;
}

/* ── Analytics with Contact & Entity Stats ───────────────────── */
function analytics() {
  const n = leads.length || 1;
  const c = (k) => leads.reduce((a, l) => a + (l[k] ? 1 : 0), 0) / n;
  const count = (f) => leads.reduce((a, l) => ((a[l[f]] = (a[l[f]] ?? 0) + 1), a), {});
  const totalRev = leads.reduce((acc, l) => acc + (l.estimated_revenue || 0), 0);

  const emails = leads.filter(l => l.email || l.entities?.email).length;
  const phones = leads.filter(l => l.phone || l.entities?.phone).length;
  const names = leads.filter(l => l.name || l.entities?.name).length;
  const companies = leads.filter(l => l.company || l.entities?.company).length;
  const budgets = leads.filter(l => l.entities?.budget).length;
  const fullyQualified = leads.filter(l => (l.email || l.entities?.email) && (l.phone || l.entities?.phone || l.name || l.entities?.name)).length;

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
    contact_stats: {
      emails_captured: emails,
      email_rate: Number((emails / n).toFixed(2)),
      phones_captured: phones,
      phone_rate: Number((phones / n).toFixed(2)),
      names_captured: names,
      name_rate: Number((names / n).toFixed(2)),
      companies_captured: companies,
      company_rate: Number((companies / n).toFixed(2)),
      budgets_captured: budgets,
      budget_rate: Number((budgets / n).toFixed(2)),
      fully_qualified_leads: fullyQualified,
      full_qualification_rate: Number((fullyQualified / n).toFixed(2)),
    }
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
    return send(res, 200, generateResponse(b, b.channel ?? "web"));
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
