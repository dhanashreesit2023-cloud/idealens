/* ui.js - small reusable UI components */
const StatusPill = ({ s }) => html`<span class=${"pill st-" + s}>${stLabel(s)}</span>`;

const Loading = ({ label = t("loading") }) => html`<div class="loading"><span class="spin dark"></span>${label}</div>`;

const Empty = ({ icon = "📭", title, text, children }) => html`<div class="empty"><div class="ei">${icon}</div><h3>${title}</h3><p class="muted">${text}</p>${children}</div>`;

const PageHead = ({ title, sub, children }) => html`<div class="ph"><div><h1>${title}</h1>${sub && html`<p class="muted">${sub}</p>`}</div><div class="row">${children}</div></div>`;

const Stat = ({ value, label, icon }) => html`<div class="stat"><b>${value}</b><span>${icon ? icon + " " : ""}${label}</span></div>`;

function Bar({ label, value, max = 100, suffix = "/100", plain }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / (max || 1)) * 100)));
  return html`<div class="bar"><div class="top"><span>${label}</span><span>${value}${suffix}</span></div>
    <div class="track"><div class="fill" style=${{ width: pct + "%", background: plain ? "var(--brand)" : color(value) }}></div></div></div>`;
}

function Ring({ value }) {
  const r = 72, c = 2 * Math.PI * r;
  return html`<div class="ring"><svg viewBox="0 0 170 170" width="170" height="170">
    <circle cx="85" cy="85" r=${r} fill="none" stroke="var(--line)" stroke-width="12"/>
    <circle cx="85" cy="85" r=${r} fill="none" stroke=${color(value)} stroke-width="12" stroke-linecap="round"
      stroke-dasharray=${c} stroke-dashoffset=${c * (1 - value / 100)} transform="rotate(-90 85 85)"/></svg>
    <b><span>${value}<small>overall</small></span></b></div>`;
}

function Radar({ s }) {
  const items = [["Originality", s.originality], ["Innovation", s.innovation], ["Feasibility", s.feasibility], ["Impact", s.impact], ["Relevance", s.relevance]];
  const cx = 130, cy = 120, R = 80;
  const pt = (i, v) => { const a = (Math.PI * 2 * i) / items.length - Math.PI / 2; return [cx + Math.cos(a) * R * v / 100, cy + Math.sin(a) * R * v / 100]; };
  const poly = (v) => items.map((_, i) => pt(i, v).join(",")).join(" ");
  const data = items.map((it, i) => pt(i, it[1]).join(",")).join(" ");
  return html`<svg viewBox="0 0 260 240" width="100%" style=${{ maxWidth: "260px" }} role="img" aria-label="Score radar chart">
    ${[25, 50, 75, 100].map((v) => html`<polygon key=${v} points=${poly(v)} fill="none" stroke="var(--line)"/>`)}
    <polygon points=${data} fill="rgba(91,91,240,.25)" stroke="var(--brand)" stroke-width="2"/>
    ${items.map((it, i) => { const [x, y] = pt(i, 122); return html`<text key=${it[0]} x=${x} y=${y} font-size="10" fill="var(--muted)" text-anchor="middle">${it[0]}</text>`; })}</svg>`;
}

const STEPS = ["Reading your idea", "Finding similar projects", "Scoring originality and feasibility", "Analysing risks", "Building the roadmap"];
function Progress() {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => Math.min(x + 1, STEPS.length - 1)), 600); return () => clearInterval(t); }, []);
  return html`<div class="progress">${STEPS.map((s, k) => html`<div key=${s} class=${"ps " + (k < i ? "done" : k === i ? "now" : "")}>${k < i ? "✓" : k === i ? "…" : "○"} ${s}</div>`)}</div>`;
}

/* Rows used by report lists (student + teacher) */
function IdeaRow({ r, teacher, href, onDelete }) {
  return html`<a class="hist" href=${"#" + href}>
    <div class="grow"><div class="ht">${r.title}</div>
      <div class="muted">${teacher ? r.student_name + " · " : ""}${fmt(r.created_at)}${teacher && r.domains ? " · " + r.domains.join(", ") : ""}</div>
      <div class="row"><${StatusPill} s=${r.status} />${r.version > 1 && html`<span class="pill">v${r.version}</span>`}
        ${teacher && r.duplicate > 0 && html`<span class="pill High">⚠ ${r.duplicate}% duplicate</span>`}
        ${r.grade !== null && r.grade !== undefined && html`<span class="pill">${r.grade}/10</span>`}</div></div>
    <div class="row"><span class="pill" style=${{ color: color(r.overall) }}>${r.overall}</span>
      ${onDelete && (r.status === "draft" || r.status === "needs_changes") && html`<button class="btn danger sm" aria-label="Delete" onClick=${(e) => { e.preventDefault(); e.stopPropagation(); onDelete(r.id); }}>✕</button>`}</div></a>`;
}
