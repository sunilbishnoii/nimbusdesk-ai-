# Lead tier annotation guide (read before labelling)

Label every enquiry in `leads_enquiries.csv` as **hot**, **warm** or **cold** from the point of view of a *sales team deciding whom to contact first*.
Two people label independently (columns `annotator1`, `annotator2` in `leads_labels_template.csv` -> save as `leads_labels.csv`). Do **not** discuss until both are done. Then agree the `final` column together.

| Tier | Meaning | Typical signals |
|---|---|---|
| **hot** | Sales should act today. Clear intent to buy/demo **and** near-term timeline or explicit commitment. | demo/quote/purchase request, switching vendor soon, deadline, budget approved, contact given |
| **warm** | Real prospect, but no near-term commitment, or still researching / missing information. | pricing/feature/integration questions, "next quarter", "no rush", comparing vendors |
| **cold** | Not a sales opportunity right now. | existing-customer support/billing issue, complaint, cancellation, jobs, spam/vendor pitch, student, greeting, off-topic, gibberish |

Rules of thumb
1. Judge the **enquiry text only** (no outside knowledge).
2. A pricing or feature question with **no** timeline or commitment = **warm**, not hot.
3. An existing customer with a problem or wanting to cancel = **cold** (no new sale).
4. If torn between two tiers, choose the **lower** one, and note it in a comment column if you add one.
5. Never look at `_authoring_notes_DO_NOT_SHOW_ANNOTATORS.csv`.

Provenance (state in the paper): the 100 enquiries are **synthetic, authored by an LLM (Claude)** for a fictional SaaS ("NimbusDesk"), then shuffled. Add 20+ enquiries written by your own group, or real ones if a business allows it, to reduce single-author bias.
