import { useState } from "react";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  User,
  Building2,
  Mail,
  Phone,
  Users,
  Wallet,
  Clock,
  Flame,
  Package,
  CalendarCheck,
  CheckCircle2,
  Sparkles,
  X,
  TrendingUp,
} from "lucide-react";
import type { Entities, ScoreItem, Tier, Appointment } from "../types";
import { TIER_COLOR } from "../types";

export { TIER_COLOR };

export function TierBadge({ tier, score }: { tier: Tier; score?: number }) {
  return (
    <span className={`badge badge-${tier}`}>
      {tier === "hot" && <Flame size={12} />}
      {tier.toUpperCase()}
      {score !== undefined && <span className="mono" style={{ marginLeft: 4 }}>· {score}</span>}
    </span>
  );
}

export function Meter({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const color = value >= 0.6 ? "#10B981" : value >= 0.3 ? "#F59E0B" : "#EF4444";
  return (
    <div style={{ marginTop: 8 }}>
      <div className="flex items-center justify-between small dimmed" style={{ marginBottom: 6 }}>
        <span>{label}</span>
        <b className="mono" style={{ color: "var(--text-primary)" }}>{value.toFixed(2)}</b>
      </div>
      <div style={{ height: 6, background: "var(--bg-inset)", borderRadius: 3, overflow: "hidden" }}>
        <motion.div
          style={{ height: "100%", background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export function ScoreBar({ items, score }: { items: ScoreItem[]; score: number }) {
  const colors = ["#4F46E5", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#64748B"];
  return (
    <div>
      <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", background: "var(--bg-inset)", marginBottom: 14 }}>
        {items.map((i, k) => i.points > 0 && (
          <motion.span
            key={i.feature}
            style={{ height: "100%", background: colors[k % colors.length] }}
            initial={{ width: 0 }}
            animate={{ width: `${(i.points / 100) * 100}%` }}
            transition={{ duration: 0.6, delay: k * 0.08 }}
            title={`${i.feature}: ${i.points}`}
          />
        ))}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {items.map((i, k) => (
            <tr key={i.feature} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "8px 0", fontSize: 13, color: "var(--text-secondary)" }}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: colors[k % colors.length], marginRight: 8 }} />
                {i.feature.replace(/_/g, " ")}
              </td>
              <td style={{ padding: "8px 6px", fontSize: 13, fontWeight: 700, fontFamily: "JetBrains Mono" }}>
                {i.points} <span className="dimmed small" style={{ fontWeight: 400 }}>/ {Math.round(i.weight * 100)}</span>
              </td>
              <td className="dimmed small" style={{ padding: "8px 0", textAlign: "right" }}>{i.evidence}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ENTITY_ICONS: Record<string, typeof User> = {
  Name: User, Company: Building2, Email: Mail, Phone: Phone, Team: Users,
  Budget: Wallet, Timeline: Clock, Urgency: Flame, Interest: Package, Service: CalendarCheck,
};

export function EntityChips({ e }: { e: Entities }) {
  const chips: [string, string][] = [];
  if (e.name) chips.push(["Name", e.name]);
  if (e.company) chips.push(["Company", e.company]);
  if (e.email) chips.push(["Email", e.email]);
  if (e.phone) chips.push(["Phone", e.phone]);
  if (e.team_size) chips.push(["Team", `${e.team_size} agents`]);
  if (e.budget) chips.push(["Budget", e.budget.text]);
  if (e.timeline) chips.push(["Timeline", e.timeline.phrase]);
  if (e.urgency_phrase) chips.push(["Urgency", e.urgency_phrase]);
  if (e.service) chips.push(["Service", e.service]);
  (e.products ?? []).forEach((p) => chips.push(["Interest", p]));

  if (!chips.length) return <span className="dimmed small">No lead details detected yet</span>;

  return (
    <div className="chips">
      {chips.map(([k, v], i) => {
        const Icon = ENTITY_ICONS[k] ?? Package;
        return (
          <motion.span
            className="chip"
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: i * 0.04 }}
          >
            <Icon size={13} style={{ color: "var(--primary)" }} />
            <b>{k}</b> {v}
          </motion.span>
        );
      })}
    </div>
  );
}

/* ── Interactive Appointment Slot Picker Component ───────────── */
export function AppointmentSlotPicker({
  leadId,
  service,
  onBooked,
  existingAppointment,
}: {
  leadId: number;
  service?: string;
  onBooked: (apt: Appointment) => void;
  existingAppointment?: Appointment;
}) {
  const [booked, setBooked] = useState<Appointment | null>(existingAppointment ?? null);
  const [loading, setLoading] = useState(false);

  const SLOTS = [
    { date: "Today", time: "4:00 PM" },
    { date: "Tomorrow", time: "10:30 AM" },
    { date: "Fri, Nov 27", time: "2:00 PM" },
  ];

  async function handleSelectSlot(slot: { date: string; time: string }) {
    if (booked || loading) return;
    setLoading(true);

    try {
      // Direct optimistic appointment confirmation
      const apt: Appointment = {
        id: `apt-${Date.now()}`,
        lead_id: leadId,
        customer_name: "Customer",
        service: service || "Specialist Consultation",
        date: slot.date,
        time_slot: slot.time,
        status: "confirmed",
      };
      setBooked(apt);
      onBooked(apt);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="appointment-picker-card">
      <div className="appointment-picker-title">
        <CalendarCheck size={16} />
        {booked ? "Confirmed Appointment Details" : `Select a Slot for ${service || "Service"}`}
      </div>

      {booked ? (
        <div className="booking-success-box">
          <CheckCircle2 size={20} color="#10B981" />
          <div>
            <div><b>Appointment Locked!</b> 📅 {booked.date} at {booked.time_slot}</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#047857" }}>
              Our {service || "specialist"} has confirmed this slot. Lead status upgraded to <b>QUALIFIED (HOT)</b>.
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="slot-grid">
            {SLOTS.map((s, idx) => (
              <button
                key={idx}
                className="slot-btn"
                disabled={loading}
                onClick={() => handleSelectSlot(s)}
              >
                <span className="slot-date">{s.date}</span>
                <span className="slot-time">{s.time}</span>
              </button>
            ))}
          </div>
          <div className="dimmed small" style={{ textAlign: "center" }}>
            ⚡ 1-click instant confirmation · Calendar invite automatically drafted
          </div>
        </>
      )}
    </div>
  );
}

/* ── Hot Lead Celebration Toast ───────────────────────────────── */
export function HotLeadCelebrationToast({
  lead,
  onClose,
}: {
  lead: { name?: string | null; tier: Tier; estimated_revenue?: number; id: number };
  onClose: () => void;
}) {
  return (
    <motion.div
      className="lead-celebration-toast"
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
    >
      <div className="toast-icon">
        <Sparkles size={24} />
      </div>
      <div className="toast-content" style={{ flex: 1 }}>
        <h4>
          🔥 Hot Lead Generated!
          <span className="badge badge-hot">QUALIFIED</span>
        </h4>
        <p>
          Lead <b>#{lead.id}</b> {lead.name ? `(${lead.name})` : ""} matched intent filters!
          <br />
          Estimated pipeline: <span className="toast-revenue">+${(lead.estimated_revenue || 18000).toLocaleString()} ARR</span>
        </p>
      </div>
      <button className="toast-close" onClick={onClose}>
        <X size={18} />
      </button>
    </motion.div>
  );
}

/* ── Confetti Particle Celebration ────────────────────────────── */
export function ConfettiCelebration() {
  const particles = Array.from({ length: 24 });
  const colors = ["#4F46E5", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#8B5CF6"];

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 99, overflow: "hidden" }}>
      {particles.map((_, i) => {
        const randX = Math.random() * 100;
        const color = colors[i % colors.length];
        return (
          <motion.div
            key={i}
            style={{
              position: "absolute",
              width: 8 + Math.random() * 8,
              height: 12 + Math.random() * 6,
              background: color,
              borderRadius: 2,
              top: "-5%",
              left: `${randX}%`,
            }}
            initial={{ y: 0, opacity: 1, rotate: 0 }}
            animate={{
              y: "110vh",
              opacity: [1, 1, 0],
              rotate: 360 * 3 * (i % 2 === 0 ? 1 : -1),
              x: (Math.random() - 0.5) * 200,
            }}
            transition={{
              duration: 2.5 + Math.random() * 1.5,
              ease: "easeOut",
            }}
          />
        );
      })}
    </div>
  );
}

/* ── Donut Chart ──────────────────────────────────────────────── */
export function Donut({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  let acc = 0;
  const R = 42, C = 2 * Math.PI * R;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, padding: "10px 0" }}>
      <svg viewBox="0 0 120 120" width="150" height="150">
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--bg-inset)" strokeWidth="16" />
        {total > 0 &&
          data.map((d) => {
            const len = (d.value / total) * C;
            const el = (
              <motion.circle
                key={d.label}
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke={d.color}
                strokeWidth="16"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-acc}
                transform="rotate(-90 60 60)"
                strokeLinecap="round"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              />
            );
            acc += len;
            return el;
          })}
        <text x="60" y="56" textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--text-primary)">
          {total}
        </text>
        <text x="60" y="72" textAnchor="middle" fontSize="10" fill="var(--text-tertiary)" fontWeight="600">
          leads
        </text>
      </svg>
      <ul style={{ listStyle: "none" }}>
        {data.map((d) => (
          <li key={d.label} style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0", fontSize: 13, textTransform: "capitalize" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: d.color }} />
            {d.label} <b className="mono" style={{ color: "var(--text-primary)" }}>{d.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── BarList (Intents) ────────────────────────────────────────── */
export function BarList({ data }: { data: Record<string, number> }) {
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <div>
      {rows.map(([k, v], i) => (
        <div key={k} style={{ display: "grid", gridTemplateColumns: "140px 1fr 40px", gap: 12, alignItems: "center", margin: "10px 0", fontSize: 13.5 }}>
          <span style={{ textTransform: "capitalize", fontWeight: 500, color: "var(--text-secondary)" }}>{k.replace(/_/g, " ")}</span>
          <div style={{ height: 8, background: "var(--bg-inset)", borderRadius: 4, overflow: "hidden" }}>
            <motion.div
              style={{ height: "100%", background: "var(--primary-gradient)", borderRadius: 4 }}
              initial={{ width: 0 }}
              animate={{ width: `${(v / max) * 100}%` }}
              transition={{ duration: 0.6, delay: i * 0.05 }}
            />
          </div>
          <span className="mono" style={{ fontWeight: 700, textAlign: "right" }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Card ──────────────────────────────────────────────────────── */
export function Card({
  title,
  icon,
  children,
  right,
  flush,
}: {
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
  right?: ReactNode;
  flush?: boolean;
}) {
  return (
    <div className="card-modern">
      {title && (
        <div className="card-modern-header">
          <h3 className="card-modern-title">
            {icon}
            {title}
          </h3>
          {right}
        </div>
      )}
      <div style={{ padding: flush ? 0 : "22px 24px" }}>{children}</div>
    </div>
  );
}

export function RefusedBanner({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: 10, padding: "12px 16px", color: "#B45309", fontWeight: 600, fontSize: 13.5, marginTop: 12 }}>
      <AlertTriangle size={18} />
      {text}
    </div>
  );
}
