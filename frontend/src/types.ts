// Mirrors docs/API_CONTRACT.md. If the backend changes, the contract changes first (see CONTRIBUTING.md).
export type Tier = "hot" | "warm" | "cold";
export type LeadStatus = "new" | "contacted" | "qualified" | "won" | "lost";

export const TIER_COLOR: Record<Tier, string> = {
  hot: "#EF4444",
  warm: "#F59E0B",
  cold: "#3B82F6",
};

export interface EnquiryRequest {
  text: string;
  channel?: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  lead_id?: number | null;
}

export interface Source {
  n: number;
  source: string;
  heading: string;
}

export interface ScoreItem {
  feature: string;
  value: number;
  weight: number;
  points: number;
  evidence: string;
}

export interface Entities {
  email?: string;
  phone?: string;
  name?: string;
  company?: string;
  team_size?: number;
  budget?: { amount: number; currency: "USD" | "INR" | "EUR"; text: string };
  timeline?: { label: string; score: number; phrase: string };
  urgency_phrase?: string;
  products?: string[];
  service?: string;
}

export interface Appointment {
  id: string;
  lead_id?: number;
  customer_name: string;
  service: string;
  date: string;
  time_slot: string;
  status: "confirmed" | "pending";
}

export interface Lead {
  id: number;
  channel: string;
  text: string;
  intent: string;
  intent_conf: number;
  entities: Entities;
  answer: string;
  sources: Source[];
  grounding: number;
  refused: boolean;
  needs_human: boolean;
  score: number;
  tier: Tier;
  explanation: ScoreItem[];
  latency_ms: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  created_at?: string;
  status?: LeadStatus;
  answered_question?: string;
  estimated_revenue?: number;
  appointment?: Appointment;
}

export interface ContactStats {
  emails_captured: number;
  email_rate: number;
  phones_captured: number;
  phone_rate: number;
  names_captured: number;
  name_rate: number;
  companies_captured: number;
  company_rate: number;
  budgets_captured: number;
  budget_rate: number;
  fully_qualified_leads: number;
  full_qualification_rate: number;
}

export interface Analytics {
  total: number;
  avg_grounding: number | null;
  refusal_rate: number | null;
  avg_latency_ms: number | null;
  human_escalation_rate: number | null;
  by_tier: Partial<Record<Tier, number>>;
  by_intent: Record<string, number>;
  total_revenue?: number;
  appointments_count?: number;
  contact_stats?: ContactStats;
}
