# API contract v0.1  (source of truth for frontend <-> backend)

Base URL: `http://127.0.0.1:8000` (env `VITE_API_URL` in the frontend). JSON everywhere. CORS allows `http://localhost:5173`.
Machine-readable version: `docs/openapi.json`. Real sample responses: `docs/examples/*.json` (the mock server serves these).
Interactive docs when the real backend runs: `http://127.0.0.1:8000/docs`.

## Endpoints
| Method & path | Purpose | Body / query | Returns |
|---|---|---|---|
| `GET /health` | liveness | - | `{status, chunks, llm}` |
| `POST /enquiry` | process one enquiry end to end and store it | `{text (2-4000 chars), channel?="web", name?, email?}` | **Lead** (below) |
| `GET /leads` | list stored leads, best first | `tier?=hot\|warm\|cold`, `min_score?=0..100`, `limit?=100` | `Lead[]` |
| `GET /leads/{id}` | one lead | - | `Lead` or 404 |
| `PATCH /leads/{id}/status` | update follow-up status | `{status: new\|contacted\|qualified\|won\|lost}` | `{id, status}` (422 if invalid, 404 if missing) |
| `GET /analytics` | dashboard numbers | - | **Analytics** |
| `POST /demo/seed` | process N sample enquiries through the real pipeline (demo only) | `n?=15` (max 40) | `{added}` |
| `POST /kb/reload` | re-read knowledge base files | - | `{chunks}` |

## Lead object
| Field | Type | Meaning |
|---|---|---|
| `id` | int | primary key |
| `text`, `channel` | string | the enquiry and where it came from (web/chat/email) |
| `intent` | string | `pricing`, `product_info`, `demo_request`, `purchase`, `support`, `complaint`, `other` |
| `intent_conf` | 0-1 | classifier confidence |
| `entities` | object | optional keys: `email, phone, name, company, team_size, budget{amount,currency,text}, timeline{label,score,phrase}, urgency_phrase, products[]` |
| `answer` | string | the full conversational reply shown to the customer: cited evidence from the knowledge base (if any) plus the next step (e.g. "I've passed your request to our sales team to arrange a demo") |
| `sources` | `[{n, source, heading}]` | evidence the answer used; `[n]` markers in `answer` refer to `n`. Empty when refused |
| `grounding` | 0-1 | how well the evidence supports the answer (heuristic, not a probability) |
| `refused` | bool | true = no grounded evidence was found (the reply then says so and the enquiry is passed to a human); greetings, thanks and complaints are replied to directly and are not counted as refusals |
| `needs_human` | bool | true when refused, a complaint, or a hot lead: **show an "escalate to human" cue** |
| `score` | int 0-100 | lead score |
| `tier` | `hot\|warm\|cold` | derived from score |
| `explanation` | `[{feature, value, weight, points, evidence}]` | per-feature breakdown; `points` sum to `score` (+-1 rounding) |
| `latency_ms` | number | processing time |
| `name,email,phone,company` | string\|null | contact details found in the text |
| `created_at`, `status` | string | only on stored rows (`GET /leads...`); `POST /enquiry` also returns them after refetch |
| `answered_question` | string? | which sentence of the enquiry the answer addresses (may be absent) |

## Analytics object
`{total, avg_grounding, refusal_rate, avg_latency_ms, human_escalation_rate, by_tier{hot,warm,cold}, by_intent{...}}`
Rates are 0-1 and can be `null` when there is no data. `by_tier` may omit tiers with zero leads.

## Behaviour the UI must respect
- A **refused** answer is a normal, safe outcome, not an error: display it distinctly with the human-escalation cue.
- Always show *why* a lead got its score (`explanation`) - explainability is a core research claim of the project.
- Tier colours are presentation; tier **meaning** is fixed: hot = contact today, warm = nurture, cold = no sales action.
- Errors: validation -> HTTP 422 `{detail}`, missing -> 404 `{detail}`. Show a friendly message, never raw JSON.
- Privacy: enquiry text can contain personal data - never send it to third-party analytics, and keep it out of `localStorage`.
