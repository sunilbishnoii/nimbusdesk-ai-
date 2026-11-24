import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquareText, Users, BarChart3, Zap, DollarSign } from "lucide-react";
import Analytics from "./pages/Analytics";
import Console from "./pages/Console";
import Leads from "./pages/Leads";
import { api } from "./api";

type Tab = "console" | "leads" | "analytics";

const TABS: { key: Tab; label: string; icon: typeof MessageSquareText }[] = [
  { key: "console", label: "AI Lead Console", icon: MessageSquareText },
  { key: "leads", label: "Lead Pipeline", icon: Users },
  { key: "analytics", label: "Revenue & Analytics", icon: BarChart3 },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("console");
  const [version, setVersion] = useState(0);
  const [apiOnline, setApiOnline] = useState(true);
  const [pipelineRev, setPipelineRev] = useState<number>(142500);

  const bump = () => setVersion((v) => v + 1);

  // Periodic health check & pipeline value update
  useEffect(() => {
    async function checkHealth() {
      try {
        await api.health();
        setApiOnline(true);
        const data = await api.analytics();
        if (data.total_revenue) {
          setPipelineRev(data.total_revenue);
        }
      } catch {
        setApiOnline(false);
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 8000);
    return () => clearInterval(interval);
  }, [version]);

  return (
    <>
      {/* ── Top Floating Navigation Bar ─────────────────────────── */}
      <header className="top-nav">
        <div className="brand">
          <div className="logo-badge">
            <Zap size={20} />
          </div>
          <div>
            <div className="brand-title">
              NimbusDesk
              <span className="brand-badge">RAG AI 2.0</span>
            </div>
          </div>
        </div>

        {/* Floating Pill Nav Tabs */}
        <nav className="nav-tabs-wrapper">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`nav-tab-btn ${key === tab ? "active" : ""}`}
              onClick={() => setTab(key)}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {/* Live Telemetry & Revenue */}
        <div className="nav-telemetry">
          <div className="revenue-pill" title="Total active pipeline revenue identified by NLP">
            <DollarSign size={14} />
            <span>${pipelineRev.toLocaleString()} ARR</span>
          </div>

          <div className="live-beacon">
            <span
              className="beacon-pulse"
              style={{
                background: apiOnline ? "#10B981" : "#EF4444",
              }}
            />
            <span>{apiOnline ? "API Live" : "API Offline"}</span>
          </div>
        </div>
      </header>

      {/* ── Main View ─────────────────────────────────────────── */}
      <main className={tab === "console" ? "" : "main-content"}>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {tab === "console" && <Console onSaved={bump} />}
            {tab === "leads" && <Leads version={version} />}
            {tab === "analytics" && <Analytics version={version} onSeeded={bump} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </>
  );
}
