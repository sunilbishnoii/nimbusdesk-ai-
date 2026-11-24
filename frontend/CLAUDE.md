# Brief for Claude (and the frontend owner)

You are helping build the **frontend** of a final-year project: an NLP + RAG customer-enquiry and lead-management system
(see `../README.md`). A customer enquiry is answered from a knowledge base (or refused when unsure) and scored as a hot/warm/cold lead
with an explanation. The backend is finished and owned by someone else.

## Scope and rules
- Only edit files inside `frontend/`. **Never edit `../backend/` or `../docs/`.** If the API needs to change, write the request as text for the backend owner.
- The API is defined in `../docs/API_CONTRACT.md` (+ `../docs/openapi.json`). `src/types.ts` and `src/api.ts` mirror it - keep them in sync.
- Develop against the mock: `npm run mock` (terminal 1) and `npm run dev` (terminal 2). No Python needed.
- Stack: React 18 + TypeScript + Vite already set up. You may add libraries (e.g. React Router, Tailwind, Recharts) - keep `package-lock.json` committed.
- Before every commit: `npm run build` must pass (it type-checks). Never commit `.env` or `node_modules`.
- Work on a branch (`frontend/<task>`), open a PR into `main`. See `../CONTRIBUTING.md`.

## STATUS: the four screens below are ALREADY BUILT and working (src/pages, src/components). Your job now is polish, QA and extras:
improve visual design, add loading skeletons / toasts, mobile layout, accessibility, a lead-detail route, CSV export of leads, dark mode.
After changes run `npm run build:backend` to refresh `../backend/static` (the build the backend serves), and commit it.

## What the screens do
1. **Enquiry console** - textarea + channel select + optional name/email; submit -> show the answer with its numbered sources, the
   grounding meter (0-1), detected intent and entities (as readable chips), the tier badge and score.
   *Refused answers* get a distinct, calm "couldn't answer - passed to our team" treatment.
2. **Score explanation** - for every result show `explanation` as a horizontal stacked bar (points per feature) with the `evidence` text on hover/expand. This is a headline feature of the project.
3. **Lead queue** - sortable/filterable table (tier, min score, status, search by text/contact), `needs_human` flag, inline status change
   (`PATCH /leads/{id}/status`), click a row for a **lead detail** page (full text, answer, sources, entities, explanation).
4. **Analytics dashboard** - cards (total, refusal rate, human-escalation rate, avg latency) + charts for `by_tier` and `by_intent`.
5. Polish: loading and error states, empty states, responsive layout, keyboard accessible, readable contrast, dark mode optional.

## Design guidance
Clean, professional, uncluttered. Tier colours: hot = red, warm = amber, cold = blue (always paired with text, not colour alone).
Show numbers with sensible rounding. The audience is a university evaluation panel and a sales/support team.

## Definition of done
All four screens work against the mock *and* against the real backend (`../README.md` explains how to run it), build passes, no console errors,
screenshots added to the PR description.
