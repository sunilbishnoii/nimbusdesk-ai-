import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Users,
  X,
  BookOpen,
  Shield,
  MessageSquare,
  Inbox,
  CalendarCheck,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { api } from "../api";
import type { Lead, LeadStatus, Tier } from "../types";
import {
  Card,
  EntityChips,
  Meter,
  ScoreBar,
  TierBadge,
  RefusedBanner,
} from "../components/ui";

const STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "won", "lost"];

export default function Leads({ version }: { version: number }) {
  const [rows, setRows] = useState<Lead[]>([]);
  const [tier, setTier] = useState<Tier | "">("");
  const [min, setMin] = useState(0);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Lead | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(
    () =>
      api
        .leads({ tier: tier || undefined, min_score: min || undefined, limit: 200 })
        .then(setRows)
        .catch((e) => setErr(String(e))),
    [tier, min]
  );

  useEffect(() => {
    load();
  }, [load, version]);

  const shown = useMemo(
    () =>
      rows.filter(
        (l) =>
          !q ||
          (l.text + (l.email ?? "") + (l.name ?? "") + (l.company ?? "") + (l.appointment?.service ?? ""))
            .toLowerCase()
            .includes(q.toLowerCase())
      ),
    [rows, q]
  );

  async function setStatus(l: Lead, s: LeadStatus) {
    await api.setStatus(l.id, s);
    setRows((r) => r.map((x) => (x.id === l.id ? { ...x, status: s } : x)));
    if (open?.id === l.id) setOpen({ ...open, status: s });
  }

  return (
    <>
      <Card
        title="Active Lead Pipeline & Bookings"
        icon={<Users size={18} style={{ color: "var(--primary)" }} />}
        right={<span className="dimmed small mono">{shown.length} verified leads</span>}
        flush
      >
        {/* Filters */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", background: "var(--bg-inset)" }}>
          <div className="flex items-center gap-md" style={{ flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
              <Search
                size={16}
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-tertiary)",
                }}
              />
              <input
                placeholder="Search by prospect name, service (e.g. carpenter), email, text..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                style={{ paddingLeft: 40, width: "100%", borderRadius: 20 }}
              />
            </div>

            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as Tier | "")}
              style={{ borderRadius: 20, padding: "9px 28px 9px 14px" }}
            >
              <option value="">All Tiers</option>
              <option value="hot">🔥 Hot Leads</option>
              <option value="warm">🌤 Warm Prospects</option>
              <option value="cold">❄️ Cold Visitors</option>
            </select>

            <div className="flex items-center gap-sm small" style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
              <span>Min Score:</span>
              <input
                type="range"
                min={0}
                max={100}
                value={min}
                onChange={(e) => setMin(+e.target.value)}
                style={{ width: 100 }}
              />
              <span className="mono" style={{ color: "var(--primary)", fontWeight: 800 }}>{min}</span>
            </div>
          </div>
        </div>

        {err && <p className="error" style={{ padding: "12px 24px" }}>{err}</p>}

        {/* Table */}
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 45 }}>#</th>
              <th>Lead / Prospect</th>
              <th>Enquiry Snippet</th>
              <th>Intent</th>
              <th>Est. Value</th>
              <th>Appointment</th>
              <th>Score</th>
              <th style={{ width: 120 }}>Stage</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((l, i) => (
              <motion.tr
                key={l.id}
                onClick={() => setOpen(l)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.12, delay: i * 0.015 }}
              >
                <td className="mono dimmed">{l.id}</td>
                <td className="cell-name">
                  <div>
                    {l.name ?? l.email ?? <span className="dimmed">Anonymous visitor</span>}
                    {l.needs_human && <span style={{ color: "#EF4444", marginLeft: 6 }}>⚑</span>}
                  </div>
                  {l.company && <div className="dimmed small" style={{ fontWeight: 400 }}>{l.company}</div>}
                </td>
                <td className="cell-clip">{l.text}</td>
                <td style={{ textTransform: "capitalize", fontWeight: 600 }}>
                  {l.intent.replace(/_/g, " ")}
                </td>
                <td className="cell-revenue">
                  ${(l.estimated_revenue || 6500).toLocaleString()}
                </td>
                <td>
                  {l.appointment ? (
                    <span className="chip" style={{ background: "rgba(16, 185, 129, 0.1)", borderColor: "rgba(16, 185, 129, 0.3)", color: "#065F46", padding: "4px 10px", fontSize: 11.5 }}>
                      <CalendarCheck size={12} color="#10B981" />
                      <b>{l.appointment.service}</b> ({l.appointment.time_slot})
                    </span>
                  ) : (
                    <span className="dimmed small">—</span>
                  )}
                </td>
                <td>
                  <TierBadge tier={l.tier} score={l.score} />
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <select
                    className="channel-pill-select"
                    style={{ padding: "5px 22px 5px 10px", fontSize: 12 }}
                    value={l.status ?? "new"}
                    onChange={(e) => setStatus(l, e.target.value as LeadStatus)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </td>
              </motion.tr>
            ))}
            {!shown.length && (
              <tr>
                <td colSpan={8}>
                  <div style={{ padding: 48, textAlign: "center", color: "var(--text-tertiary)" }}>
                    <Inbox size={48} style={{ opacity: 0.3, margin: "0 auto 12px" }} />
                    <p>No leads found matching filters. Send a test message in the AI Console!</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* ── Detail Drawer ───────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="drawer-backdrop"
            onClick={() => setOpen(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.aside
              className="drawer-panel"
              onClick={(e) => e.stopPropagation()}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
            >
              <div className="drawer-header">
                <h3>Lead Details #{open.id}</h3>
                <button className="genz-chip" onClick={() => setOpen(null)}>
                  <X size={18} />
                </button>
              </div>

              <div className="drawer-body">
                <div className="flex items-center justify-between mb-md">
                  <div className="flex items-center gap-sm">
                    <TierBadge tier={open.tier} score={open.score} />
                    <span className="dimmed small">Channel: {open.channel}</span>
                  </div>
                  <div className="mono" style={{ color: "#10B981", fontWeight: 800, fontSize: 16 }}>
                    +${(open.estimated_revenue || 6500).toLocaleString()} ARR
                  </div>
                </div>

                {/* Appointment Status Banner */}
                {open.appointment && (
                  <div className="booking-success-box" style={{ marginBottom: 20 }}>
                    <CalendarCheck size={20} color="#10B981" />
                    <div>
                      <div><b>Confirmed Booking:</b> {open.appointment.service}</div>
                      <div style={{ fontSize: 12, color: "#065F46" }}>
                        Scheduled for {open.appointment.date} at {open.appointment.time_slot}
                      </div>
                    </div>
                  </div>
                )}

                <div className="drawer-section">
                  <div className="drawer-section-title">Enquiry Text</div>
                  <div style={{ background: "var(--bg-inset)", padding: 14, borderRadius: 10, fontSize: 14, lineHeight: 1.6 }}>
                    {open.text}
                  </div>
                </div>

                <div className="drawer-section">
                  <div className="drawer-section-title">Extracted NLP Entities</div>
                  <EntityChips e={open.entities} />
                </div>

                <div className="drawer-section">
                  <div className="drawer-section-title">AI Grounded Response</div>
                  <p style={{ fontSize: 14.5, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                    {open.answer}
                  </p>
                  {open.refused && (
                    <RefusedBanner text="No grounded match found — passed to human support." />
                  )}
                  {open.sources.length > 0 && (
                    <div className="chips mt-sm">
                      {open.sources.map((s) => (
                        <span className="chip" key={s.n}>
                          <BookOpen size={12} />
                          <b>[{s.n}]</b> {s.source} › {s.heading}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-md">
                    <Meter value={open.grounding} label="RAG Grounding Confidence" />
                  </div>
                </div>

                <div className="drawer-section">
                  <div className="drawer-section-title">Explainable Scoring Weights</div>
                  <ScoreBar items={open.explanation} score={open.score} />
                </div>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
