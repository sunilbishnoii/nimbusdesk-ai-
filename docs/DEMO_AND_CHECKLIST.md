# Deadline checklist and 3-minute demo script

## Run it
Windows: in `backend/` double-click `setup.bat` once, then `run_app.bat` -> http://127.0.0.1:8000 (the frontend is included, no Node needed).

## 3-minute demo
1. **Analytics tab -> "Load 15 sample enquiries"** (real pipeline, not hard-coded). Point at hot/warm/cold split, refusal rate, human-escalation rate.
2. **Enquiry console -> Example 1** (hot lead): show the grounded answer with numbered sources, the grounding meter, extracted details (name, company, team, budget, timeline) and the *Why this score* breakdown.
3. **Example 4** (weather): the system refuses instead of guessing and flags a human - this is the hallucination control.
4. **Example 3** (complaint): escalated, cold sales tier.
5. **Lead queue**: filter hot, open a lead (drawer), change status to "contacted".

## Try these chat messages (the bot replies conversationally)
- "Hello" -> greets and lists what it can help with
- "Hi, I'm Priya from Zenith, 25 agents, want a demo this week" -> cited demo info, passes to sales team, asks for email
- "What does the Growth plan cost per agent?" -> cited price + offers a tailored quote
- "I was charged twice and I'm unhappy" -> apologises and escalates to a human
- "What's the weather in Paris?" -> politely says it can only help with NimbusDesk topics

## Say these honestly if asked
- Data is synthetic; intent accuracy is near 100% because the data is templated.
- A plain classifier beats RAG at routing on this closed-set data; RAG's value is grounded, updatable answers and refusal.
- Lead weights are provisional; human-labelled validation is the next step.

## Labelling the 100 test enquiries (15-20 minutes, no spreadsheet)
1. Double-click `backend/data/eval/labelling_tool.html` (opens in your browser, works offline).
2. Read the "How to decide" box once. For each enquiry press **H** (hot), **W** (warm) or **C** (cold). **B** goes back. Progress saves automatically.
3. At the end the tool shows a quick self-check on 12 very clear enquiries; if it says your score is low, click Start over and read each one. Then click **Download my labels (CSV)** and send the file to Claude (or save it as `backend/data/eval/leads_labels.csv`).
Do not look at `_authoring_notes_DO_NOT_SHOW_ANNOTATORS.csv`.
You are the human annotator. Claude then labels the same 100 as a *second, LLM annotator* so agreement (Cohen's kappa) can be reported;
the paper must say the second annotator is an LLM and that the enquiries were LLM-authored.

## Status of labels
First attempt (`leads_labels_attempt1_REJECTED.csv`) did not match the text (40% agreement with the second annotator, near chance; "tell me a joke" was labelled hot) so it was rejected and NO lead-scoring results were produced from it. Redo with the updated tool.

## Still to do
- [ ] Label the 100 enquiries (above), then run `lead_eval.py` and `fit_scorer.py` -> add to report
- [ ] (Optional) LLM API key -> standalone-LLM baseline + faithfulness
- [ ] Presentation deck and short paper draft (Claude, after the lead results are in)
