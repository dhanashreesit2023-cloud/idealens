/* student.js - creator pages: dashboard, analyse, my reports, compare */

const TIPS = ["Mention who the users are - it improves relevance and impact scores.",
  "Name the technology (sensors, mobile app, machine learning) so complexity and cost are estimated correctly.",
  "If your idea is too similar to an existing project, add a feature nobody else has - or try the AI improver.",
  "Create a new version after every big change and compare the scores."];

function StudentHome({ user }) {
  const { data: s } = useLoad(() => api("/student/stats"), []);
  if (!s) return html`<${Loading} />`;
  return html`<div><${PageHead} title=${"Hi, " + user.name.split(" ")[0] + " 👋"} sub="Here is how your ideas are doing">
      <a class="btn" href="#/s/new">+ ${t("New analysis")}</a><//>
    <div class="stats"><${Stat} value=${s.total} label="Ideas analysed" /><${Stat} value=${s.draft} label="Drafts" />
      <${Stat} value=${s.submitted + s.under_review} label="With reviewers" /><${Stat} value=${s.approved} label="Approved" />
      <${Stat} value=${s.needs_changes} label="Need changes" /><${Stat} value=${s.average} label="Average score" /></div>
    ${s.total === 0 ? html`<${Empty} icon="🚀" title="Analyse your first idea" text="Describe your idea and get a full report in seconds."><a class="btn" href="#/s/new">Start now</a><//>` : html`
    <div class="grid g2">
      <div class="card"><div class="row between"><h2>Recent reports</h2><a href="#/s/reports">View all →</a></div>
        ${s.recent.map((r) => html`<${IdeaRow} key=${r.id} r=${r} href=${"/s/report/" + r.id} />`)}</div>
      <div class="card"><h2>🏆 Your best idea</h2>
        ${s.best && html`<a class="hist" href=${"#/s/report/" + s.best.id}><div class="grow"><div class="ht">${s.best.title}</div><div class="muted">${s.best.verdict}</div></div>
          <span class="pill" style=${{ color: color(s.best.overall) }}>${s.best.overall}</span></a>`}
        <h3 style=${{ marginTop: "1rem" }}>💡 Tip</h3><p class="muted">${TIPS[s.total % TIPS.length]}</p>
        <div class="row" style=${{ marginTop: ".8rem" }}><a class="btn ghost sm" href="#/s/compare">${t("Compare")}</a><a class="btn ghost sm" href="#/how">${t("How it works")}</a></div></div></div>`}
  </div>`;
}

const EXAMPLES = [
  ["Smart Crop Advisor", "A mobile app for rural farmers that uses soil sensors and weather forecasts with machine learning to recommend crops and irrigation schedules, with voice support in regional languages and offline mode."],
  ["Freelancer Invoice Assistant", "A web app for freelancers that creates invoices, sends payment reminders automatically and predicts late payments, with a simple dashboard of income and pending amounts."],
];

const completeness = (d) => {
  const w = d.trim().split(/\s+/).filter(Boolean).length;
  return [["At least 40 words", w >= 40],
    ["Says who it helps", /\b(for|students?|farmers?|users?|teachers?|patients?|citizens?|customers?|people|drivers?|workers?|freelancers?|teams?)\b/i.test(d)],
    ["Mentions the technology", /\b(app|web|sensors?|ai|ml|machine learning|mobile|dashboard|api|database|iot|cloud|camera)\b/i.test(d)],
    ["States the problem or benefit", /\b(problem|reduce|improve|help|solve|save|prevent|detect|predict|monitor)\b/i.test(d)]];
};

function Analyze() {
  const [form, setForm] = useState({ title: "", description: "" });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const checks = completeness(form.description); const done = checks.filter((c) => c[1]).length;
  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try { const d = await api("/analyze", { method: "POST", body: form }); go("/s/report/" + d.id + "/overview"); }
    catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  return html`<div><${PageHead} title=${t("New analysis")} sub="Describe your idea - the more detail, the better the report" />
    <div class="layout"><form class="card" onSubmit=${submit}>
      <label style=${{ marginTop: 0 }}>${t("Project title")}</label><input value=${form.title} onInput=${(e) => setForm({ ...form, title: e.target.value })} required minLength="3" maxLength="120" placeholder="e.g. Smart Crop Advisor" />
      <label>${t("Description")} <span class="muted">(${form.description.length}/4000)</span></label>
      <textarea value=${form.description} onInput=${(e) => setForm({ ...form, description: e.target.value })} required minLength="20" maxLength="4000" placeholder="What problem does it solve? Who are the users? Which technologies will it use?"></textarea>
      <div class="row" style=${{ marginTop: ".5rem" }}><span class="muted">Try an example:</span>
        ${EXAMPLES.map((x) => html`<button type="button" class="ex" key=${x[0]} onClick=${() => setForm({ title: x[0], description: x[1] })}>${x[0]}</button>`)}</div>
      ${err && html`<div class="err">${err}</div>`}
      <button class="btn" style=${{ marginTop: "1rem" }} disabled=${busy}>${busy ? html`<span class="spin"></span>Analysing…` : t("Analyse my idea")}</button>
      ${busy && html`<${Progress} />`}</form>
    <div class="card"><h2>Idea checklist</h2><${Bar} label="Completeness" value=${done} max=${4} suffix="/4" />
      ${checks.map(([l, ok]) => html`<div class=${"ps " + (ok ? "done" : "")} key=${l}>${ok ? "✓" : "○"} ${l}</div>`)}
      <p class="muted" style=${{ marginTop: ".8rem" }}>Your report stays private as a draft until you submit it for review or download it.</p></div></div></div>`;
}

function MyReports() {
  const { data: rows, reload } = useLoad(() => api("/analyses"), []);
  const [q, setQ] = useState(""); const [st, setSt] = useState("all");
  const del = async (id) => {
    if (!confirm("Delete this report?")) return;
    try { await api("/analyses/" + id, { method: "DELETE" }); notify("Report deleted"); reload(); } catch (e) { notify(e.message); }
  };
  if (!rows) return html`<${Loading} />`;
  const shown = rows.filter((r) => (st === "all" || r.status === st) && r.title.toLowerCase().includes(q.toLowerCase()));
  return html`<div><${PageHead} title=${t("My reports")} sub=${rows.length + " idea(s) analysed"}><a class="btn" href="#/s/new">+ ${t("New analysis")}</a><//>
    <div class="card"><div class="filters"><input placeholder="Search reports…" value=${q} onInput=${(e) => setQ(e.target.value)} />
      <select value=${st} onChange=${(e) => setSt(e.target.value)}><option value="all">All statuses</option>
        ${Object.keys(STATUS).map((k) => html`<option key=${k} value=${k}>${STATUS[k]}</option>`)}</select></div>
      ${rows.length === 0 ? html`<${Empty} icon="🗂️" title="No reports yet" text="Analyse an idea and it will appear here."><a class="btn" href="#/s/new">Analyse an idea</a><//>`
        : shown.length === 0 ? html`<p class="muted">No reports match your filters.</p>`
        : shown.map((r) => html`<${IdeaRow} key=${r.id} r=${r} href=${"/s/report/" + r.id} onDelete=${del} />`)}</div></div>`;
}

function Compare() {
  const { data: rows } = useLoad(() => api("/analyses"), []);
  const [a, setA] = useState(""); const [b, setB] = useState(""); const [docs, setDocs] = useState({});
  useEffect(() => {
    [a, b].forEach((id) => { if (id && !docs[id]) api("/analyses/" + id).then((d) => setDocs((x) => ({ ...x, [id]: d }))).catch((e) => notify(e.message)); });
  }, [a, b]);
  if (!rows) return html`<${Loading} />`;
  const A = docs[a], B = docs[b];
  const metrics = [["Overall", "overall"], ["Originality", "originality"], ["Innovation", "innovation"], ["Feasibility", "feasibility"], ["Social impact", "impact"], ["Industry relevance", "relevance"]];
  const Pick = ({ v, set, label }) => html`<div><label>${label}</label><select value=${v} onChange=${(e) => set(e.target.value)}><option value="">Choose a report…</option>
    ${rows.map((r) => html`<option key=${r.id} value=${r.id}>${r.title}${r.version > 1 ? " v" + r.version : ""} (${r.overall})</option>`)}</select></div>`;
  return html`<div><${PageHead} title=${t("Compare")} sub="Put two of your reports side by side" />
    ${rows.length < 2 ? html`<${Empty} icon="⚖️" title="Need two reports" text="Analyse at least two ideas (or two versions of one idea) to compare them."><a class="btn" href="#/s/new">${t("New analysis")}</a><//>` : html`
    <div class="card"><div class="grid g2"><${Pick} v=${a} set=${setA} label="Idea A" /><${Pick} v=${b} set=${setB} label="Idea B" /></div></div>
    ${A && B && html`<div class="card"><h2>Scores</h2>
      <div class="cmp head"><span></span><b>${A.title}</b><b>${B.title}</b><b>Difference</b></div>
      ${metrics.map(([l, k]) => { const x = A.report.scores[k], y = B.report.scores[k], d = y - x;
        return html`<div class="cmp" key=${k}><span>${l}</span><span style=${{ color: color(x), fontWeight: 700 }}>${x}</span><span style=${{ color: color(y), fontWeight: 700 }}>${y}</span>
          <span style=${{ color: d > 0 ? "var(--good)" : d < 0 ? "var(--bad)" : "var(--muted)" }}>${d > 0 ? "+" : ""}${d} (B vs A)</span></div>`; })}
      <div class="cmp"><span>Estimated time</span><span>${A.report.time_weeks} wks</span><span>${B.report.time_weeks} wks</span><span></span></div>
      <div class="cmp"><span>Cost band</span><span>${A.report.cost.band}</span><span>${B.report.cost.band}</span><span></span></div>
      <div class="cmp"><span>Complexity</span><span>${A.report.complexity}/10</span><span>${B.report.complexity}/10</span><span></span></div></div>`}`}</div>`;
}
