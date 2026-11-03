/* shared.js - report pages (creators and reviewers) and the profile page */

function Overview({ doc }) {
  const r = doc.report, s = r.scores, rs = r.reasons || {};
  const rows = [["Originality", "originality"], ["Innovation", "innovation"], ["Feasibility", "feasibility"], ["Social impact", "impact"], ["Industry relevance", "relevance"]];
  return html`<div>
    <div class="card"><div class="score-top"><${Ring} value=${s.overall} />
      <div><h2>${r.verdict}</h2><p>${r.summary}</p></div><${Radar} s=${s} /></div></div>
    ${r.mentor_feedback && html`<div class="card"><h2>🧑‍🏫 AI Mentor Feedback</h2><p>${r.mentor_feedback}</p></div>`}
    <div class="grid g2">
      <div class="card"><h2>📊 Scores and why</h2>
        ${rows.map(([l, k]) => html`<div key=${k}><${Bar} label=${l} value=${s[k]} />${rs[k] && html`<p class="reason">${rs[k]}</p>`}</div>`)}
        <p class="muted" style=${{ marginTop: ".6rem" }}>${r.scoring_mode === "hybrid" ? "Scoring: rules and AI model, averaged" : "Scoring: transparent rules and similarity"}</p></div>
      <div class="card"><h2>📌 Key facts</h2><div class="kv">
        <b>Domains</b><span>${r.domains.join(", ")}</span>
        <b>Complexity</b><span>${r.complexity}/10</span>
        <b>Time</b><span>about ${r.time_weeks} weeks</span>
        <b>Cost</b><span>${r.cost.estimate}</span>
        <b>Similarity</b><span>${r.similarity_summary}</span></div>
        ${r.sdgs && r.sdgs.length > 0 && html`<h3 style=${{ marginTop: "1rem" }}>🌍 UN Sustainable Development Goals</h3>
          <div class="chips">${r.sdgs.map((g) => html`<span class="chip" key=${g.number} title=${g.reason}>SDG ${g.number}: ${g.name}</span>`)}</div>`}</div></div></div>`;
}

function SimilarTab({ doc }) {
  const r = doc.report;
  return html`<div class="card"><h2>🔍 Similar Existing Solutions</h2>
    <p class="muted">${r.similarity_summary} (method: ${r.similarity_method})</p>
    ${r.similar.length === 0 && html`<p>No close matches found in the reference dataset.</p>`}
    ${r.similar.map((x) => html`<div class="sim" key=${x.id}><div class="row between"><b>${x.title}</b><span class="pill">${x.similarity}% match</span></div>
      <p class="muted">${x.domain} - ${x.description}</p></div>`)}</div>`;
}

function RisksTab({ doc }) {
  return html`<div class="card"><h2>⚠️ Risk Analysis</h2><div class="grid g2">
    ${doc.report.risks.map((k, i) => html`<div key=${i}><div class="row"><b>${k.category}</b><span class=${"pill " + k.level}>${k.level}</span></div>
      <p>${k.risk}</p><p class="muted">Mitigation: ${k.mitigation}</p></div>`)}</div></div>`;
}

function TechTab({ doc }) {
  const tc = doc.report.technology;
  return html`<div class="card"><h2>🛠️ Technology Recommendation</h2><div class="kv">
    ${["Frontend", "Backend", "Database", "AI / ML", "Deployment"].map((k) => html`<${React.Fragment} key=${k}><b>${k}</b><span>${tc[k]}</span><//>`)}</div>
    ${tc.Extras.length > 0 && html`<h3 style=${{ marginTop: "1rem" }}>Also consider</h3><div class="chips">${tc.Extras.map((x) => html`<span class="chip" key=${x}>${x}</span>`)}</div>`}
    <p class="muted" style=${{ marginTop: "1rem" }}>Estimated cost: ${doc.report.cost.estimate}</p></div>`;
}

function RoadmapTab({ doc }) {
  const r = doc.report;
  return html`<div class="card"><h2>🗺️ Development Roadmap (about ${r.time_weeks} weeks)</h2><div class="tl">
    ${r.roadmap.map((p) => html`<div class="step" key=${p.phase}><b>${p.phase}</b> <span class="muted">· Week ${p.from_week}${p.to_week > p.from_week ? "-" + p.to_week : ""}</span>
      <ul class="clean">${p.tasks.map((x, i) => html`<li key=${i}>${x}</li>`)}</ul></div>`)}</div></div>`;
}

const Delta = ({ a, b }) => { const d = b - a; return html`<span class=${d > 0 ? "up" : d < 0 ? "down" : "muted"}>${d > 0 ? "+" : ""}${d}</span>`; };

function ImproveTab({ doc, owner }) {
  const [prev, setPrev] = useState(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const gen = async () => {
    setBusy(true); setErr("");
    try { setPrev(await api("/analyses/" + doc.id + "/improve", { method: "POST" })); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const save = async () => {
    try { const d = await api("/analyses/" + doc.id + "/revise", { method: "POST", body: { title: doc.title, description: prev.description } }); notify("Saved as a new version"); go("/s/report/" + d.id + "/overview"); }
    catch (e) { setErr(e.message); }
  };
  const keys = [["Overall", "overall"], ["Originality", "originality"], ["Innovation", "innovation"], ["Feasibility", "feasibility"], ["Impact", "impact"], ["Relevance", "relevance"]];
  return html`<div><div class="card"><h2>💡 AI Innovation Booster</h2><p class="muted">Ideas to make your project more original and impressive.</p>
      <ul class="clean">${doc.report.suggestions.map((x, i) => html`<li key=${i}>${x}</li>`)}</ul></div>
    ${owner && html`<div class="card"><h2>✨ AI idea improver</h2>
      <p class="muted">Rewrites your description with the best missing features and shows the score before and after. Nothing is saved until you choose.</p>
      <button class="btn" onClick=${gen} disabled=${busy}>${busy ? "Improving…" : prev ? "Generate again" : "Improve my idea"}</button>
      ${err && html`<div class="err">${err}</div>`}
      ${prev && html`<div style=${{ marginTop: "1rem" }}>
        ${prev.added.length > 0 && html`<h3>Features added</h3><ul class="clean">${prev.added.map((x, i) => html`<li key=${i}>${x}</li>`)}</ul>`}
        <h3>Improved description ${prev.source === "ai" ? "(AI rewrite)" : ""}</h3><p class="improved">${prev.description}</p>
        <h3 style=${{ marginTop: ".8rem" }}>Score: before → after</h3>
        ${keys.map(([l, k]) => html`<div class="cmp3" key=${k}><span>${l}</span><span>${prev.before[k]}</span><span>→ ${prev.after[k]}</span><${Delta} a=${prev.before[k]} b=${prev.after[k]} /></div>`)}
        <button class="btn" style=${{ marginTop: "1rem" }} onClick=${save}>Save as a new version</button></div>`}</div>`}</div>`;
}

function VersionsTab({ doc }) {
  const { data: rows } = useLoad(() => api("/analyses/" + doc.id + "/versions"), [doc.id]);
  const [f, setF] = useState({ title: doc.title, description: doc.description });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const revise = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try { const d = await api("/analyses/" + doc.id + "/revise", { method: "POST", body: f }); notify("New version created"); go("/s/report/" + d.id + "/overview"); }
    catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  const cols = ["overall", "originality", "innovation", "feasibility", "impact", "relevance"];
  return html`<div><div class="card"><h2>🕘 Version history</h2>
      ${!rows ? html`<${Loading} />` : html`<div class="scrollx"><table class="tbl"><thead><tr><th>Version</th>${cols.map((c) => html`<th key=${c}>${c.slice(0, 5)}</th>`)}<th>Status</th></tr></thead><tbody>
        ${rows.map((v, i) => html`<tr key=${v.id} class=${v.id === doc.id ? "cur" : ""}><td><a href=${"#/s/report/" + v.id + "/versions"}>v${v.version}</a></td>
          ${cols.map((c) => html`<td key=${c}>${v.scores[c]} ${i > 0 && html`<${Delta} a=${rows[i - 1].scores[c]} b=${v.scores[c]} />`}</td>`)}<td><${StatusPill} s=${v.status} /></td></tr>`)}</tbody></table></div>
        <p class="muted">Changes are shown against the previous version.</p>`}</div>
    <form class="card" onSubmit=${revise}><h2>➕ Create a new version</h2><p class="muted">Edit the idea and analyse it again. Your earlier versions stay saved.</p>
      <label>${t("Project title")}</label><input value=${f.title} onInput=${(e) => setF({ ...f, title: e.target.value })} required minLength="3" maxLength="120" />
      <label>${t("Description")}</label><textarea value=${f.description} onInput=${(e) => setF({ ...f, description: e.target.value })} required minLength="20" maxLength="4000"></textarea>
      ${err && html`<div class="err">${err}</div>`}<button class="btn" style=${{ marginTop: "1rem" }} disabled=${busy}>${busy ? "Analysing…" : "Analyse new version"}</button></form></div>`;
}

const QUICK = ["How can I reduce the cost?", "What are the biggest risks?", "How can I make it more unique?", "Which technologies should I use?", "How long will it take?", "Which UN goals does it support?"];
function ChatTab({ doc }) {
  const [msgs, setMsgs] = useState(doc.chat || []); const [text, setText] = useState(""); const [busy, setBusy] = useState(false);
  const ask = async (m) => {
    const q = (m || text).trim(); if (!q || busy) return;
    setBusy(true); setText(""); setMsgs((x) => [...x, { role: "user", text: q }]);
    try { setMsgs((await api("/analyses/" + doc.id + "/chat", { method: "POST", body: { message: q } })).chat); }
    catch (e) { notify(e.message); } finally { setBusy(false); }
  };
  return html`<div class="card"><h2>💬 ${t("Mentor chat")}</h2><p class="muted">Ask anything about this idea. Answers use your report.</p>
    <div class="chat">${msgs.length === 0 && html`<p class="muted">Try one of the questions below.</p>`}
      ${msgs.map((m, i) => html`<div key=${i} class=${"msg " + (m.role === "user" ? "user" : "mentor")}>${m.text}</div>`)}${busy && html`<div class="msg mentor">…</div>`}</div>
    <div class="chips" style=${{ margin: ".6rem 0" }}>${QUICK.map((q) => html`<button type="button" class="chip btnchip" key=${q} onClick=${() => ask(q)}>${q}</button>`)}</div>
    <form class="row" onSubmit=${(e) => { e.preventDefault(); ask(); }}><input class="grow" value=${text} onInput=${(e) => setText(e.target.value)} maxLength="500" placeholder="Type your question…" />
      <button class="btn" disabled=${busy}>${t("Send")}</button></form></div>`;
}

function Reviews({ doc }) {
  const list = doc.reviews || [];
  return html`<div class="card"><h2>👩‍🏫 Reviewer feedback</h2>
    ${list.length === 0 && html`<p class="muted">${doc.status === "draft" ? "Submit this idea for review to get feedback." : "No feedback yet. A reviewer will look at it soon."}</p>`}
    ${list.map((v) => html`<div class="review" key=${v.id}><div class="row"><b>${v.teacher_name}</b><${StatusPill} s=${v.status} />
      ${v.grade !== null && v.grade !== undefined && html`<span class="pill">${v.grade}/10</span>`}<span class="muted">${fmt(v.created_at)}</span></div><p>${v.comment}</p></div>`)}</div>`;
}

function ReviewForm({ doc, onDone }) {
  const [f, setF] = useState({ comment: "", grade: "", status: "under_review" });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const send = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      await api("/teacher/ideas/" + doc.id + "/review", { method: "POST", body: { comment: f.comment, grade: f.grade === "" ? null : Number(f.grade), status: f.status } });
      setF({ comment: "", grade: "", status: f.status }); notify("Review saved"); onDone();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  return html`<form class="card" onSubmit=${send}><h2>📝 Write a review</h2>
    <label>Comment for the creator</label>
    <textarea style=${{ minHeight: "100px" }} value=${f.comment} onInput=${(e) => setF({ ...f, comment: e.target.value })} required minLength="2" maxLength="1000" placeholder="Strengths, concerns, what to improve…"></textarea>
    <div class="grid g2"><div><label>Grade (0-10, optional)</label><input type="number" min="0" max="10" value=${f.grade} onInput=${(e) => setF({ ...f, grade: e.target.value })} /></div>
      <div><label>Decision</label><select value=${f.status} onChange=${(e) => setF({ ...f, status: e.target.value })}>
        <option value="under_review">Under review</option><option value="approved">Approve</option><option value="needs_changes">Needs changes</option></select></div></div>
    ${err && html`<div class="err">${err}</div>`}
    <button class="btn" style=${{ marginTop: "1rem" }} disabled=${busy}>${busy ? "Saving…" : "Save review"}</button></form>`;
}

function TeacherReviewTab({ doc, reload }) {
  const cm = doc.college_matches || [];
  return html`<div>
    ${cm.length > 0 ? html`<div class="banner warn"><b>⚠️ Possible duplicates in your workspace</b>
      ${cm.map((m) => html`<div key=${m.id}>${m.title} - ${m.student_name || "creator"} <span class="pill">${m.similarity}% match</span></div>`)}</div>`
      : html`<div class="banner good">✅ No duplicate found among other submissions in your workspace.</div>`}
    <${Reviews} doc=${doc} /><${ReviewForm} doc=${doc} onDone=${reload} /></div>`;
}

function FullReport({ doc }) {
  return html`<div><${Overview} doc=${doc} /><${SimilarTab} doc=${doc} /><${RisksTab} doc=${doc} /><${ImproveTab} doc=${doc} owner=${false} />
    <${TechTab} doc=${doc} /><${RoadmapTab} doc=${doc} />${doc.reviews && doc.reviews.length > 0 && html`<${Reviews} doc=${doc} />`}</div>`;
}

/* One report, one page per section: /s/report/:id/:tab (creator) and /t/idea/:id/:tab (reviewer) */
function ReportPage({ role, id, tab }) {
  const isT = role === "teacher";
  const base = (isT ? "/t/idea/" : "/s/report/") + id;
  const { data: doc, error, reload } = useLoad(() => api((isT ? "/teacher/ideas/" : "/analyses/") + id), [id]);
  const tabs = [["overview", "Overview"], ["similarity", "Similar projects"], ["risks", "Risks"], ["improve", "Improve"], ["tech", "Technology"], ["roadmap", "Roadmap"]]
    .concat(isT ? [["review", "Review"]] : [["versions", "Versions"], ["chat", "Mentor chat"], ["feedback", "Feedback"]])
    .concat([["full", "Print report"]]);
  const cur = tab || "overview";
  const back = isT ? "#/t/submissions" : "#/s/reports";
  if (error) return html`<div class="card"><h2>Report not found</h2><p class="muted">${error}</p><a class="btn sm" href=${back}>← Back to list</a></div>`;
  if (!doc) return html`<${Loading} />`;
  const canSubmit = !isT && (doc.status === "draft" || doc.status === "needs_changes");
  const submit = async () => {
    try { await api("/analyses/" + doc.id + "/submit", { method: "POST" }); notify("Submitted for review"); reload(); }
    catch (e) { notify(e.message); }
  };
  const dup = doc.duplicate_warning;
  let content;
  if (cur === "feedback") content = html`<${Reviews} doc=${doc} />`;
  else if (cur === "review" && isT) content = html`<${TeacherReviewTab} doc=${doc} reload=${reload} />`;
  else if (cur === "versions" && !isT) content = html`<${VersionsTab} doc=${doc} />`;
  else if (cur === "chat" && !isT) content = html`<${ChatTab} doc=${doc} />`;
  else {
    const Body = { overview: Overview, similarity: SimilarTab, risks: RisksTab, improve: ImproveTab, tech: TechTab, roadmap: RoadmapTab, full: FullReport }[cur] || Overview;
    content = html`<${Body} doc=${doc} owner=${!isT} />`;
  }
  return html`<div>
    <div class="row between noprint" style=${{ marginBottom: ".8rem" }}>
      <a class="btn ghost sm" href=${back}>← All ${isT ? "submissions" : "reports"}</a>
      <div class="row">${canSubmit && html`<button class="btn sm" onClick=${submit}>${doc.status === "needs_changes" ? "Resubmit for review" : t("Submit for review")}</button>`}
        <button class="btn ghost sm" onClick=${() => downloadFile("/analyses/" + doc.id + "/pdf", "idealens-report.pdf")}>⬇ ${t("Download PDF")}</button>
        ${cur === "full" && html`<button class="btn ghost sm" onClick=${() => window.print()}>Print</button>`}</div></div>
    <div class="card"><div class="row between"><h1 style=${{ fontSize: "1.4rem" }}>${doc.title}${doc.version > 1 ? " · v" + doc.version : ""}</h1><${StatusPill} s=${doc.status} /></div>
      <p class="muted">${isT && doc.student_name ? "By " + doc.student_name + " · " : ""}${fmt(doc.created_at)}</p>
      <p style=${{ marginTop: ".5rem" }}>${doc.description}</p></div>
    ${!isT && doc.status === "needs_changes" && html`<div class="banner bad">Your reviewer asked for changes. Read the <a href=${"#" + base + "/feedback"}>Feedback</a>, improve the idea in <a href=${"#" + base + "/versions"}>Versions</a>, then resubmit.</div>`}
    ${!isT && doc.status === "approved" && html`<div class="banner good">🎉 Approved by your reviewer.</div>`}
    ${!isT && dup && dup.count > 0 && html`<div class="banner warn">⚠️ This idea looks similar to ${dup.count} idea(s) already submitted in your workspace (closest ${dup.top}%). Consider adding a clear differentiator.</div>`}
    <div class="subtabs noprint">${tabs.map(([k, l]) => html`<a key=${k} href=${"#" + base + "/" + k} class=${cur === k ? "on" : ""}>${t(l)}</a>`)}</div>
    ${content}</div>`;
}

function Profile({ user, onUser }) {
  const [f, setF] = useState({ name: user.name, workspace: user.workspace || "General" });
  const [pw, setPw] = useState({ current_password: "", new_password: "" });
  const [err, setErr] = useState(""); const [err2, setErr2] = useState("");
  const saveProfile = async (e) => {
    e.preventDefault(); setErr("");
    try { onUser(await api("/auth/profile", { method: "PUT", body: f })); notify("Profile updated"); } catch (e2) { setErr(e2.message); }
  };
  const savePw = async (e) => {
    e.preventDefault(); setErr2("");
    try { await api("/auth/password", { method: "POST", body: pw }); setPw({ current_password: "", new_password: "" }); notify("Password changed"); } catch (e2) { setErr2(e2.message); }
  };
  return html`<div><${PageHead} title=${t("Profile")} sub="Manage your account details" />
    <div class="grid g2">
      <form class="card" onSubmit=${saveProfile}><h2>Account</h2>
        <div class="kv" style=${{ marginBottom: ".5rem" }}><b>Role</b><span class="badge" style=${{ justifySelf: "start" }}>${t(ROLE_LABEL[user.role] || user.role)}</span><b>${t("Email")}</b><span>${user.email}</span></div>
        <label>${t("Full name")}</label><input value=${f.name} onInput=${(e) => setF({ ...f, name: e.target.value })} required minLength="2" maxLength="60" />
        <label>${t("Workspace")} <span class="muted">(your team, class, company or "General")</span></label>
        <input value=${f.workspace} onInput=${(e) => setF({ ...f, workspace: e.target.value })} maxLength="60" />
        <p class="muted">Reviewers only see ideas from their own workspace, and duplicate checks compare ideas inside a workspace.</p>
        ${err && html`<div class="err">${err}</div>`}<button class="btn" style=${{ marginTop: "1rem" }}>Save profile</button></form>
      <form class="card" onSubmit=${savePw}><h2>Change password</h2>
        <label>Current password</label><input type="password" value=${pw.current_password} onInput=${(e) => setPw({ ...pw, current_password: e.target.value })} required autoComplete="current-password" />
        <label>New password (min 6 characters)</label><input type="password" value=${pw.new_password} onInput=${(e) => setPw({ ...pw, new_password: e.target.value })} required minLength="6" autoComplete="new-password" />
        ${err2 && html`<div class="err">${err2}</div>`}<button class="btn" style=${{ marginTop: "1rem" }}>Change password</button></form></div></div>`;
}
