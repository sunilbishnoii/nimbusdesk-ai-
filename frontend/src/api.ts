import type { Analytics, EnquiryRequest, Lead, LeadStatus, Tier, Appointment } from "./types";

// Empty string = same origin (works via Vite proxy in dev and when deployed together)
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, { headers: { "Content-Type": "application/json" }, ...init });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  health: () => call<{ status: string; chunks: number; llm: string }>("/health"),
  submitEnquiry: (e: EnquiryRequest) => call<Lead>("/enquiry", { method: "POST", body: JSON.stringify(e) }),
  leads: (p: { tier?: Tier; min_score?: number; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (p.tier) q.set("tier", p.tier);
    if (p.min_score) q.set("min_score", String(p.min_score));
    if (p.limit) q.set("limit", String(p.limit));
    return call<Lead[]>("/leads" + (q.toString() ? `?${q}` : ""));
  },
  lead: (id: number) => call<Lead>(`/leads/${id}`),
  setStatus: (id: number, status: LeadStatus) =>
    call<{ id: number; status: LeadStatus }>(`/leads/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  bookAppointment: (leadId: number, slot: string, date: string, service?: string) =>
    call<Lead>(`/leads/${leadId}/book`, { method: "POST", body: JSON.stringify({ slot, date, service }) }),
  analytics: () => call<Analytics>("/analytics"),
  seedDemo: (n = 15) => call<{ added: number }>(`/demo/seed?n=${n}`, { method: "POST" }),
};
