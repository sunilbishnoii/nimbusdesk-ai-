import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Zap,
  User,
  ChevronDown,
  CalendarCheck,
  DollarSign,
  Sparkles,
  MessageCircle,
  BookOpen,
  Calendar,
  Clock,
  Flame,
  CheckCircle,
} from "lucide-react";
import { api } from "../api";
import type { Lead, Appointment } from "../types";
import {
  EntityChips,
  Meter,
  ScoreBar,
  TierBadge,
  AppointmentSlotPicker,
  HotLeadCelebrationToast,
  ConfettiCelebration,
} from "../components/ui";

interface ChatMsg {
  id: number;
  role: "user" | "bot";
  text: string;
  lead?: Lead;
  time: string;
  isAppointmentRequest?: boolean;
}

function formatTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getGreetingTime() {
  const hr = new Date().getHours();
  if (hr < 12) return "Good morning";
  if (hr < 17) return "Good afternoon";
  return "Good evening";
}

function getFormattedDate() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const QUICK_PROMPTS = [
  { text: "Hi, I'm Rahul from TechCorp. We have 20 agents and need a CRM automation solution.", label: "👋 New Lead Intro" },
  { text: "Hi, I'm Priya Nair from Zenith. We have 25 agents, budget $2000/mo and want a demo this week. priya@zenith.in", label: "🔥 Hot Lead ($24k ARR)" },
  { text: "What are your pricing plans for team collaboration?", label: "💰 Pricing & Plans" },
  { text: "Do you integrate with Salesforce and HubSpot?", label: "⚡ Integrations & RAG" },
];

export default function Console({ onSaved }: { onSaved: () => void }) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: 0,
      role: "bot",
      text: "Hey there! ✨ Welcome to **NimbusDesk Intelligent Lead Engine**.\n\nI combine **NLP entity & intent extraction** with **grounded RAG** to automatically answer enquiries, qualify buyers, and book service appointments.\n\nTry sending a message or tap a quick prompt below!",
      time: formatTime(),
    },
  ]);
  const [input, setInput] = useState("");
  const [channel, setChannel] = useState("web");
  const [loading, setLoading] = useState(false);
  const [activeToast, setActiveToast] = useState<{ id: number; name?: string | null; tier: any; estimated_revenue?: number } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // Multi-Turn NLP Context Memory
  const [sessionEntities, setSessionEntities] = useState<{
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    service?: string | null;
  }>({});
  const [sessionLeadId, setSessionLeadId] = useState<number | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  async function handleBooked(msgId: number, apt: Appointment) {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 4000);

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === msgId && m.lead) {
          return {
            ...m,
            lead: {
              ...m.lead,
              appointment: apt,
              status: "qualified",
              tier: "hot",
              score: Math.min(100, m.lead.score + 25),
            },
          };
        }
        return m;
      })
    );

    onSaved();
  }

  async function send(customText?: string) {
    const msg = (customText ?? input).trim();
    if (!msg || loading) return;

    const userMsg: ChatMsg = {
      id: Date.now(),
      role: "user",
      text: msg,
      time: formatTime(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setLoading(true);

    try {
      // Pass conversational memory context so the bot never forgets the lead
      const lead = await api.submitEnquiry({
        text: msg,
        channel,
        name: sessionEntities.name,
        email: sessionEntities.email,
        phone: sessionEntities.phone,
        company: sessionEntities.company,
        lead_id: sessionLeadId,
      });

      // Update multi-turn session memory
      if (lead.id) setSessionLeadId(lead.id);
      setSessionEntities((prev) => ({
        ...prev,
        ...lead.entities,
        name: lead.name || lead.entities?.name || prev.name,
        email: lead.email || lead.entities?.email || prev.email,
        phone: lead.phone || lead.entities?.phone || prev.phone,
        company: lead.company || lead.entities?.company || prev.company,
        service: lead.entities?.service || prev.service,
      }));

      // Show slot picker ONLY when user explicitly requests an appointment/booking/demo
      const isApt = /\b(appoint[a-z]*|book\s+a[n]?\s+(appoint|slot|demo|meeting)|schedule\s+a[n]?\s+(appoint|demo|meeting|call)|set\s+up\s+a\s+(call|meeting)|carpenter|plumber|electrician|book\s+me\s+in|10[\s-]?min(?:ute)?\s+breif?(?:ing)?|brief(?:ing)?)\b/i.test(msg);

      const botMsg: ChatMsg = {
        id: Date.now() + 1,
        role: "bot",
        text: lead.answer,
        lead,
        time: formatTime(),
        isAppointmentRequest: isApt,
      };

      setMessages((prev) => [...prev, botMsg]);
      onSaved();

      // Trigger Hot Lead celebration if score is high or appointment requested
      if (lead.tier === "hot" || isApt) {
        setActiveToast({
          id: lead.id,
          name: lead.name,
          tier: lead.tier,
          estimated_revenue: lead.estimated_revenue || 24000,
        });
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3500);
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "bot",
          text: `⚠️ Could not reach backend server: ${String(e)}`,
          time: formatTime(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      {showConfetti && <ConfettiCelebration />}

      <AnimatePresence>
        {activeToast && (
          <HotLeadCelebrationToast
            lead={activeToast}
            onClose={() => setActiveToast(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Dynamic Hero Welcoming Banner ─────────────────────── */}
      <div className="hero-welcome">
        <div className="hero-left">
          <div className="hero-greeting">
            {getGreetingTime()}, Builder 👋
            <span className="brand-badge">LIVE AI AGENT</span>
          </div>
          <div className="hero-sub">
            Autonomous NLP & Grounded RAG Lead Extraction Engine · Ready to convert visitors into qualified pipeline
          </div>
        </div>
        <div className="hero-right">
          <div className="date-badge">
            <Calendar size={15} style={{ color: "var(--primary)" }} />
            <span>{getFormattedDate()}</span>
          </div>
        </div>
      </div>

      {/* ── Chat Container ─────────────────────────────────────── */}
      <div className="chat-container">
        <div className="chat-messages">
          {messages.map((msg) => (
            <MessageRow
              key={msg.id}
              msg={msg}
              onBooked={(apt) => handleBooked(msg.id, apt)}
            />
          ))}

          {loading && (
            <div className="chat-msg chat-msg-bot">
              <div className="chat-avatar bot-avatar">
                <Zap size={18} />
              </div>
              <div className="typing-dots">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* ── Chat Input ────────────────────────────────────────── */}
        <div className="chat-input-area">
          <div className="suggestions-row">
            {QUICK_PROMPTS.map((p, i) => (
              <button
                key={i}
                className="genz-chip"
                onClick={() => send(p.text)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {Boolean(sessionEntities.name || sessionEntities.company || sessionEntities.email || sessionEntities.phone) && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", background: "rgba(99, 102, 241, 0.08)", border: "1px solid rgba(99, 102, 241, 0.2)", borderRadius: 10, fontSize: 12, color: "var(--primary)", marginBottom: 10, width: "fit-content" }}>
              <Sparkles size={13} />
              <span><b>NLP Session Memory:</b> {[sessionEntities.name && `Name: ${sessionEntities.name}`, sessionEntities.company && `Company: ${sessionEntities.company}`, sessionEntities.email && `Email: ${sessionEntities.email}`, sessionEntities.phone && `Phone: ${sessionEntities.phone}`].filter(Boolean).join(" · ")}</span>
            </div>
          )}

          <div className="chat-input-box">
            <select
              className="channel-pill-select"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              <option value="web">🌐 Web Chat</option>
              <option value="chat">💬 Live Chat</option>
              <option value="email">✉️ Inbound Email</option>
            </select>

            <textarea
              ref={textareaRef}
              className="genz-textarea"
              value={input}
              onChange={handleInput}
              onKeyDown={onKeyDown}
              placeholder="Ask about pricing, features, integrations, or type 'book a demo' to schedule..."
              rows={1}
            />

            <button
              className="send-action-btn"
              disabled={!input.trim() || loading}
              onClick={() => send()}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function MessageRow({
  msg,
  onBooked,
}: {
  msg: ChatMsg;
  onBooked: (apt: Appointment) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (msg.role === "user") {
    return (
      <div className="chat-msg chat-msg-user">
        <div className="chat-avatar user-avatar">
          <User size={18} />
        </div>
        <div className="chat-bubble-wrap">
          <div className="chat-bubble user-bubble">{msg.text}</div>
          <div className="chat-time">{msg.time}</div>
        </div>
      </div>
    );
  }

  const lead = msg.lead;
  // Slot picker only shown when the flag was explicitly set by the send() function
  const isApt = msg.isAppointmentRequest === true;

  return (
    <div className="chat-msg chat-msg-bot">
      <div className="chat-avatar bot-avatar">
        <Zap size={18} />
      </div>
      <div className="chat-bubble-wrap">
        <div className="chat-bubble bot-bubble">
          {msg.text}

          {/* Interactive Appointment Slot Picker */}
          {lead && isApt && (
            <AppointmentSlotPicker
              leadId={lead.id}
              service={lead.entities?.service || "General Consultation"}
              onBooked={onBooked}
              existingAppointment={lead.appointment}
            />
          )}

          {/* Collapsible Lead Intelligence Insights */}
          {lead && (
            <div style={{ marginTop: 14 }}>
              <button
                className="genz-chip"
                style={{
                  background: "var(--bg-inset)",
                  border: "1px solid var(--border)",
                  fontSize: 12,
                }}
                onClick={() => setExpanded(!expanded)}
              >
                <TierBadge tier={lead.tier} score={lead.score} />
                <span>{expanded ? "Hide NLP & Lead Intelligence" : "Inspect Lead Signals"}</span>
                {lead.estimated_revenue && (
                  <span className="mono" style={{ color: "#10B981", fontWeight: 700 }}>
                    +${lead.estimated_revenue.toLocaleString()}
                  </span>
                )}
                <ChevronDown
                  size={14}
                  style={{
                    transform: expanded ? "rotate(180deg)" : "none",
                    transition: "transform 0.2s",
                  }}
                />
              </button>
            </div>
          )}
        </div>

        {/* Detailed Expandable Section */}
        <AnimatePresence>
          {expanded && lead && (
            <motion.div
              style={{
                width: "100%",
                background: "white",
                border: "1px solid var(--border)",
                borderRadius: 16,
                padding: "18px 22px",
                boxShadow: "var(--shadow-md)",
              }}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="flex items-center justify-between mb-sm">
                <div className="flex items-center gap-sm">
                  <TierBadge tier={lead.tier} score={lead.score} />
                  <span className="small dimmed">
                    Intent: <b style={{ color: "var(--text-primary)" }}>{lead.intent.replace(/_/g, " ")}</b> ({Math.round(lead.intent_conf * 100)}%)
                  </span>
                </div>
                {lead.estimated_revenue && (
                  <span className="mono" style={{ color: "#10B981", fontWeight: 800, fontSize: 13 }}>
                    Est. Value: ${lead.estimated_revenue.toLocaleString()}
                  </span>
                )}
              </div>

              <div className="mt-sm mb-md">
                <EntityChips e={lead.entities} />
              </div>

              <Meter value={lead.grounding} label="RAG Grounding Confidence" />

              {lead.sources.length > 0 && (
                <div className="chips mt-sm">
                  {lead.sources.map((s) => (
                    <span className="chip" key={s.n}>
                      <BookOpen size={12} />
                      <b>[{s.n}]</b> {s.source} › {s.heading}
                    </span>
                  ))}
                </div>
              )}

              <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", margin: "16px 0 8px" }}>
                Scoring Breakdown
              </h4>
              <ScoreBar items={lead.explanation} score={lead.score} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="chat-time">{msg.time}</div>
      </div>
    </div>
  );
}
