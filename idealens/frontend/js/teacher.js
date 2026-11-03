/* teacher.js - teacher pages: dashboard, submissions, students, analytics */

function TeacherHome({ user }) {
  const { data: s } = useLoad(() => api("/teacher/stats"), []);
  const { data: rows } = useLoad(() => api("/teacher/ideas"), []);
  if (!s || !rows) return html`<${Loading} />`;
  const waiting = rows.filter((r) => r.status === "submitted").slice(0, 5);
  const dups = rows.filter((r) => r.duplicate > 0).sort((a, b) => b.duplicate - a.duplicate).slice(0, 5);
  return html`<div><${PageHead} title=${"Welcome, " + user.name.split(" ")[0]} sub="Ideas submitted in your workspace"><a class="btn" href="#/t/submissions">All submissions</a><//>
    <div class="stats"><${Stat} value=${s.total} label="Submitted ideas" /><${Stat} value=${s.awaiting} label="Awaiting review" /><${Stat} value=${s.under_review} label="Under review" />
      <${Stat} value=${s.approved} label="Approved" /><${Stat} value=${s.needs_changes} label="Need changes" /><${Stat} value=${s.average} label="Average score" /></div>
    <div class="grid g2">
      <div class="card"><h2>🕒 Awaiting your review</h2>${waiting.length === 0 ? html`<p class="muted">Nothing waiting. 🎉</p>` : waiting.map((r) => html`<${IdeaRow} key=${r.id} r=${r} teacher=${true} href=${"/t/idea/" + r.id + "/review"} />`)}</div>
      <div class="card"><h2>⚠️ Duplicate alerts</h2>${dups.length === 0 ? html`<p class="muted">No similar submissions detected.</p>` : dups.map((r) => html`<${IdeaRow} key=${r.id} r=${r} teacher=${true} href=${"/t/idea/" + r.id + "/review"} />`)}</div></div></div>`;
}

function Submissions() {
  const { data: rows } = useLoad(() => api("/teacher/ideas"), []);
  const [q, setQ] = useState(""); const [st, setSt] = useState("all"); const [sort, setSort] = useState("new");
  if (!rows) return html`<${Loading} />`;
  let shown = rows.filter((r) => (st === "all" || r.status === st) && (r.title + " " + r.student_name).toLowerCase().includes(q.toLowerCase()));
  if (sort === "score") shown = [...shown].sort((a, b) => b.overall - a.overall);
  if (sort === "dup") shown = [...shown].sort((a, b) => b.duplicate - a.duplicate);
  return html`<div><${PageHead} title=${t("Submissions")} sub=${rows.length + " idea(s) submitted for review"} />
    <div class="card"><div class="filters3"><input placeholder="Search by title or person…" value=${q} onInput=${(e) => setQ(e.target.value)} />
      <select value=${st} onChange=${(e) => setSt(e.target.value)}><option value="all">All statuses</option>
        ${["submitted", "under_review", "approved", "needs_changes"].map((k) => html`<option key=${k} value=${k}>${stLabel(k)}</option>`)}</select>
      <select value=${sort} onChange=${(e) => setSort(e.target.value)}><option value="new">Newest first</option><option value="score">Highest score</option><option value="dup">Most duplicate</option></select></div>
      ${rows.length === 0 ? html`<${Empty} icon="📥" title="No submissions yet" text="When people submit ideas for review, they appear here." />`
        : shown.length === 0 ? html`<p class="muted">No ideas match your filters.</p>`
        : shown.map((r) => html`<${IdeaRow} key=${r.id} r=${r} teacher=${true} href=${"/t/idea/" + r.id} />`)}</div></div>`;
}

function Students() {
  const { data: rows } = useLoad(() => api("/teacher/students"), []);
  if (!rows) return html`<${Loading} />`;
  return html`<div><${PageHead} title=${t("People")} sub=${rows.length + " creator(s) have submitted ideas"} />
    ${rows.length === 0 ? html`<${Empty} icon="🎓" title="No creators yet" text="People appear here after they submit their first idea." />` : html`
    <div class="grid g3">${rows.map((s) => html`<div class="card" key=${s.name + s.last}><h3>🎓 ${s.name}</h3>
      <div class="kv"><b>Ideas</b><span>${s.ideas}</span><b>Approved</b><span>${s.approved}</span><b>Need changes</b><span>${s.needs_changes}</span><b>Avg score</b><span style=${{ color: color(s.average), fontWeight: 700 }}>${s.average}</span><b>Last</b><span>${fmtDate(s.last)}</span></div></div>`)}</div>`}</div>`;
}

function Analytics() {
  const { data: s } = useLoad(() => api("/teacher/stats"), []);
  if (!s) return html`<${Loading} />`;
  if (s.total === 0) return html`<div><${PageHead} title=${t("Analytics")} /><${Empty} icon="📈" title="No data yet" text="Charts appear after people submit ideas." /></div>`;
  const maxD = Math.max(1, ...s.domains.map((d) => d.count));
  const maxB = Math.max(1, ...Object.values(s.distribution));
  const maxT = Math.max(1, ...s.timeline.map((t) => t.count));
  const statusRows = [["Submitted", s.awaiting], ["Under review", s.under_review], ["Approved", s.approved], ["Needs changes", s.needs_changes]];
  return html`<div><${PageHead} title=${t("Analytics")} sub=${s.total + " submitted ideas · average score " + s.average} />
    <div class="grid g2">
      <div class="card"><h2>Popular domains</h2>${s.domains.map((d) => html`<${Bar} key=${d.name} label=${d.name} value=${d.count} max=${maxD} suffix="" plain=${true} />`)}</div>
      <div class="card"><h2>Average score by domain</h2>${s.domain_scores.map((d) => html`<${Bar} key=${d.name} label=${d.name + " (" + d.count + ")"} value=${d.average} />`)}</div>
      <div class="card"><h2>Score distribution</h2><div class="dist">${Object.entries(s.distribution).map(([k, v]) => html`<div key=${k}><i style=${{ height: Math.round((v / maxB) * 80) + "px" }}></i>${v}<br/>${k}</div>`)}</div></div>
      <div class="card"><h2>Review status</h2>${statusRows.map(([l, v]) => html`<${Bar} key=${l} label=${l} value=${v} max=${Math.max(1, s.total)} suffix="" plain=${true} />`)}</div>
      <div class="card"><h2>Submissions over time</h2><div class="dist">${s.timeline.map((t) => html`<div key=${t.date}><i style=${{ height: Math.round((t.count / maxT) * 80) + "px" }}></i>${t.count}<br/>${t.date.slice(5)}</div>`)}</div></div>
      <div class="card"><h2>🏆 Top ideas</h2>${s.top.map((r) => html`<${IdeaRow} key=${r.id} r=${r} teacher=${true} href=${"/t/idea/" + r.id} />`)}</div></div></div>`;
}
