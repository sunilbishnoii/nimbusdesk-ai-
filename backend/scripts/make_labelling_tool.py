"""Builds data/eval/labelling_tool.html: a double-click, offline page for labelling enquiries as hot/warm/cold."""
import csv, json
rows = list(csv.DictReader(open("data/eval/leads_enquiries.csv", encoding="utf-8-sig")))
data = json.dumps([{"id": r["id"], "channel": r["channel"], "text": r["text"]} for r in rows], ensure_ascii=False)
html = r'''<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Lead labelling tool</title><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{font-family:system-ui,Segoe UI,Arial,sans-serif;background:#f4f6fb;margin:0;color:#1c2540}
.wrap{max-width:760px;margin:0 auto;padding:22px}h1{font-size:20px;margin:0 0 4px}.muted{color:#6b7699;font-size:14px}
.bar{height:10px;background:#e3e8f5;border-radius:6px;overflow:hidden;margin:10px 0 4px}.bar i{display:block;height:100%;background:#1b4f9c;width:0}
.card{background:#fff;border:1px solid #e3e8f5;border-radius:12px;padding:22px;margin-top:14px;box-shadow:0 1px 3px #1c254010}
.text{font-size:21px;line-height:1.5;min-height:90px}.meta{font-size:13px;color:#6b7699;margin-bottom:8px}
.btns{display:flex;gap:12px;margin-top:20px}.btns button{flex:1;padding:18px 8px;font-size:18px;font-weight:700;border:0;border-radius:10px;cursor:pointer;color:#fff}
.hot{background:#e5484d}.warm{background:#f5a524;color:#2b1d00!important}.cold{background:#3b82f6}
.btns small{display:block;font-weight:400;font-size:12px;margin-top:4px}
.row{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}.row button{padding:9px 16px;border-radius:8px;border:1px solid #cdd5ec;background:#fff;cursor:pointer;font-size:14px}
.row .primary{background:#1b4f9c;color:#fff;border-color:#1b4f9c;font-weight:600}
details{margin-top:14px;background:#fff;border:1px solid #e3e8f5;border-radius:10px;padding:10px 16px}summary{cursor:pointer;font-weight:600}
table{border-collapse:collapse;width:100%;font-size:14px;margin-top:8px}td,th{border-bottom:1px solid #e3e8f5;padding:6px;text-align:left;vertical-align:top}
.done{text-align:center;padding:30px}.tag{display:inline-block;padding:2px 10px;border-radius:999px;color:#fff;font-weight:700;font-size:12px}
</style></head><body><div class="wrap">
<h1>Lead labelling tool</h1>
<div class="muted">For each customer enquiry, decide how valuable it is as a <b>sales lead</b>. Click a button or press <b>H</b> / <b>W</b> / <b>C</b>. Your progress saves automatically in this browser.</div>
<details><summary>How to decide (read once)</summary>
<table><tr><th></th><th>Choose this when…</th><th>Examples</th></tr>
<tr><td><span class="tag hot">HOT</span></td><td>Wants to buy or book a demo <b>and</b> there is a near-term time or clear commitment. Sales should call today.</td><td>"Demo this week, 30 agents, budget approved" · "Send the contract, we sign this month"</td></tr>
<tr><td><span class="tag warm">WARM</span></td><td>A genuine prospect, but just researching, no deadline, or missing details.</td><td>"What does the Growth plan cost?" · "We might switch next quarter" · "Do you integrate with Slack?"</td></tr>
<tr><td><span class="tag cold">COLD</span></td><td>No chance of a new sale: existing customer with a problem or cancelling, complaint, job seeker, spam, student, greeting, off-topic, gibberish.</td><td>"I can't log in" · "I want to cancel" · "tell me a joke" · "We offer SEO services"</td></tr></table>
<p class="muted">Rules: judge only the text. Pricing/feature question with no timeline = WARM. Existing customer with a problem = COLD. Torn between two? Pick the LOWER one.</p></details>
<div class="bar"><i id="pb"></i></div><div class="muted" id="pt"></div>
<div id="main"></div>
<div class="row"><button onclick="back()">← Back (B)</button><button class="primary" onclick="dl()">Download my labels (CSV)</button><button onclick="reset()">Start over</button></div>
</div><script>
const DATA=__DATA__;const CLEAR={L003:'cold',L009:'cold',L019:'cold',L035:'cold',L091:'cold',L097:'cold',L059:'cold',L090:'hot',L022:'hot',L048:'hot',L069:'hot',L012:'hot'};const KEY="lead_labels_v1";let labels=JSON.parse(localStorage.getItem(KEY)||"{}");
const idx=()=>DATA.findIndex(d=>!labels[d.id]);
function render(){const done=Object.keys(labels).length,i=idx();document.getElementById("pb").style.width=(100*done/DATA.length)+"%";
document.getElementById("pt").textContent=done+" of "+DATA.length+" labelled";const m=document.getElementById("main");
if(i<0){const ids=Object.keys(CLEAR);const ok=ids.filter(k=>labels[k]===CLEAR[k]).length;const good=ok>=ids.length*0.75;
m.innerHTML='<div class="card done"><h2>All done! 🎉</h2><p><b>Quick self-check:</b> on '+ids.length+' very clear enquiries (e.g. "Hello", "send the contract, we sign this month") your labels matched the expected answer on <b>'+ok+' of '+ids.length+'</b>.</p>'+
(good?'<p style="color:#15803d"><b>Looks good.</b> Click <b>Download my labels (CSV)</b> and send the file to Claude.</p>':'<p style="color:#b91c1c"><b>That is lower than expected</b> - some labels may have been clicked by accident. Click <b>Start over</b> and go a bit slower, reading each enquiry. (Greetings, jokes, login problems and complaints are COLD; "send the contract / invoice / call us, we are ready to buy" are HOT.)</p>')+'</div>';return}
const d=DATA[i];m.innerHTML='<div class="card"><div class="meta">Enquiry '+(i+1)+' · '+d.id+' · via '+d.channel+'</div><div class="text"></div>'+
'<div class="btns"><button class="hot" onclick="pick(\'hot\')">HOT<small>press H</small></button><button class="warm" onclick="pick(\'warm\')">WARM<small>press W</small></button><button class="cold" onclick="pick(\'cold\')">COLD<small>press C</small></button></div></div>';
m.querySelector(".text").textContent=d.text}
function pick(t){const i=idx();if(i<0)return;labels[DATA[i].id]=t;localStorage.setItem(KEY,JSON.stringify(labels));render()}
function back(){for(let k=DATA.length-1;k>=0;k--){if(labels[DATA[k].id]){delete labels[DATA[k].id];break}}localStorage.setItem(KEY,JSON.stringify(labels));render()}
function reset(){if(confirm("Delete all your labels and start over?")){labels={};localStorage.removeItem(KEY);render()}}
function dl(){const rows=["id,annotator1,annotator2,final"].concat(DATA.map(d=>d.id+","+(labels[d.id]||"")+",,"+(labels[d.id]||"")));
const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([rows.join("\n")+"\n"],{type:"text/csv"}));a.download="leads_labels.csv";a.click()}
document.addEventListener("keydown",e=>{const k=e.key.toLowerCase();if(k==="h")pick("hot");else if(k==="w")pick("warm");else if(k==="c")pick("cold");else if(k==="b")back()});
render();</script></body></html>'''
open("data/eval/labelling_tool.html", "w", encoding="utf-8").write(html.replace("__DATA__", data))
print("labelling_tool.html written")
