/* admin.js - notifications page and admin pages (overview, users, reference dataset, score calibration) */

function Notifications() {
  const { data, reload } = useLoad(() => api("/notifications"), []);
  useEffect(() => { if (data && data.unread > 0) api("/notifications/read", { method: "POST" }).then(() => window.dispatchEvent(new Event("notifs"))).catch(() => {}); }, [data && data.unread]);
  if (!data) return html`<${Loading} />`;
  return html`<div><${PageHead} title=${t("Notifications")} sub=${data.unread + " unread"}><button class="btn ghost sm" onClick=${reload}>Refresh</button><//>
    <div class="card">${data.items.length === 0 ? html`<${Empty} icon="🔔" title="Nothing yet" text="You will be notified when someone reviews your idea or submits a new one." />`
      : data.items.map((n) => html`<a class=${"hist " + (n.read ? "" : "unread")} key=${n.id} href=${"#" + (n.link || "/notifications")}>
        <div class="grow"><div class="ht">${n.title}</div><div class="muted">${n.text}</div><div class="muted">${fmt(n.created_at)}</div></div></a>`)}</div></div>`;
}

function AdminHome() {
  const { data: o } = useLoad(() => api("/admin/overview"), []);
  if (!o) return html`<${Loading} />`;
  const on = (v) => (v ? "✅ On" : "⚪ Off");
  return html`<div><${PageHead} title="Admin overview" sub="Platform health and settings" />
    <div class="stats"><${Stat} value=${o.users} label="Users" /><${Stat} value=${o.ideas} label="Ideas analysed" /><${Stat} value=${o.submitted} label="Submitted" />
      <${Stat} value=${o.workspaces} label="Workspaces" /><${Stat} value=${o.corpus} label="Reference projects" /></div>
    <div class="grid g2">
      <div class="card"><h2>System</h2><div class="kv"><b>Database</b><span>${o.database}</span><b>Similarity</b><span>${o.similarity}</span><b>AI scoring</b><span>${on(o.llm)}</span><b>E-mail</b><span>${on(o.email)}</span></div>
        <p class="muted" style=${{ marginTop: ".6rem" }}>Set <code>ANTHROPIC_API_KEY</code>, <code>SMTP_HOST</code> or <code>MONGO_URL</code> on the server to switch these on.</p></div>
      <div class="card"><h2>Users by role</h2><div class="kv"><b>Creators</b><span>${o.roles.student}</span><b>Reviewers</b><span>${o.roles.teacher}</span><b>Admins</b><span>${o.roles.admin}</span></div></div>
      <div class="card"><h2>Score weights in use</h2>${Object.entries(o.weights).map(([k, v]) => html`<${Bar} key=${k} label=${k} value=${Math.round(v * 100)} suffix="%" plain=${true} />`)}
        <a href="#/a/calibration">Calibrate from reviewer grades →</a></div></div></div>`;
}

function AdminUsers({ me }) {
  const { data: rows, reload } = useLoad(() => api("/admin/users"), []);
  const [q, setQ] = useState("");
  if (!rows) return html`<${Loading} />`;
  const setRole = async (id, role) => { try { await api("/admin/users/" + id + "/role", { method: "PUT", body: { role } }); notify("Role updated"); reload(); } catch (e) { notify(e.message); } };
  const reset = async (u) => {
    if (!confirm("Create a temporary password for " + u.name + "?")) return;
    try { const d = await api("/admin/users/" + u.id + "/reset-password", { method: "POST" }); window.prompt("Temporary password (copy it and share it privately):", d.temporary_password); } catch (e) { notify(e.message); }
  };
  const shown = rows.filter((u) => (u.name + u.email + u.workspace).toLowerCase().includes(q.toLowerCase()));
  return html`<div><${PageHead} title=${t("Users")} sub=${rows.length + " account(s)"} />
    <div class="card"><input placeholder="Search name, email or workspace…" value=${q} onInput=${(e) => setQ(e.target.value)} style=${{ marginBottom: ".8rem" }} />
      ${shown.map((u) => html`<div class="hist" key=${u.id} style=${{ cursor: "default" }}><div class="grow"><div class="ht">${u.name} ${u.id === me.id ? "(you)" : ""}</div>
        <div class="muted">${u.email} · ${u.workspace} · ${u.ideas} idea(s) · joined ${fmtDate(u.created_at)}</div></div>
        <div class="row"><select value=${u.role} onChange=${(e) => setRole(u.id, e.target.value)} aria-label="Role"><option value="student">Creator</option><option value="teacher">Reviewer</option><option value="admin">Admin</option></select>
          <button class="btn ghost sm" onClick=${() => reset(u)}>Reset password</button></div></div>`)}</div></div>`;
}

function AdminCorpus() {
  const { data, reload } = useLoad(() => api("/admin/corpus"), []);
  const [f, setF] = useState({ title: "", domain: "", description: "" }); const [bulk, setBulk] = useState(""); const [err, setErr] = useState("");
  if (!data) return html`<${Loading} />`;
  const add = async (items) => {
    setErr("");
    try { const d = await api("/admin/corpus", { method: "POST", body: { items } }); notify("Added " + d.added + " project(s). Total " + d.total); setF({ title: "", domain: "", description: "" }); setBulk(""); reload(); }
    catch (e) { setErr(e.message); }
  };
  const addBulk = () => { try { const items = JSON.parse(bulk); if (!Array.isArray(items)) throw new Error(); add(items); } catch (e) { setErr("Paste a JSON list like [{\"title\":\"...\",\"domain\":\"...\",\"description\":\"...\"}]"); } };
  const del = async (id) => { try { await api("/admin/corpus/" + id, { method: "DELETE" }); reload(); } catch (e) { notify(e.message); } };
  return html`<div><${PageHead} title="Reference dataset" sub=${data.bundled + " bundled + " + data.custom.length + " custom projects"} />
    <p class="muted">More real projects make the originality check more accurate. Add projects from GitHub, Kaggle, Devpost or your own records.</p>
    <div class="grid g2"><form class="card" onSubmit=${(e) => { e.preventDefault(); add([f]); }}><h2>Add one project</h2>
        <label>Title</label><input value=${f.title} onInput=${(e) => setF({ ...f, title: e.target.value })} required minLength="3" maxLength="120" />
        <label>Domain</label><input value=${f.domain} onInput=${(e) => setF({ ...f, domain: e.target.value })} maxLength="60" placeholder="e.g. Healthcare" />
        <label>Description (20+ characters)</label><textarea style=${{ minHeight: "90px" }} value=${f.description} onInput=${(e) => setF({ ...f, description: e.target.value })} required minLength="20" maxLength="1000"></textarea>
        <button class="btn" style=${{ marginTop: "1rem" }}>Add project</button></form>
      <div class="card"><h2>Bulk import (JSON)</h2><textarea style=${{ minHeight: "180px" }} value=${bulk} onInput=${(e) => setBulk(e.target.value)} placeholder='[{"title":"...","domain":"...","description":"..."}]'></textarea>
        <button class="btn" style=${{ marginTop: "1rem" }} onClick=${addBulk}>Import list</button></div></div>
    ${err && html`<div class="err">${err}</div>`}
    <div class="card" style=${{ marginTop: "1rem" }}><h2>Custom projects</h2>${data.custom.length === 0 ? html`<p class="muted">None yet.</p>` : data.custom.map((c) => html`<div class="hist" key=${c.id} style=${{ cursor: "default" }}>
      <div class="grow"><div class="ht">${c.title}</div><div class="muted">${c.domain} - ${c.description}</div></div><button class="btn danger sm" onClick=${() => del(c.id)}>✕</button></div>`)}</div></div>`;
}

function AdminCalibration() {
  const { data: c, reload } = useLoad(() => api("/admin/calibration"), []);
  if (!c) return html`<${Loading} />`;
  const act = async (path, msg) => { try { await api("/admin/calibration/" + path, { method: "POST" }); notify(msg); reload(); } catch (e) { notify(e.message); } };
  return html`<div><${PageHead} title="Score calibration" sub="Learn better scoring weights from reviewer grades" />
    <div class="card">${!c.ok ? html`<p>${c.message}</p><p class="muted">Reviewers grade submitted ideas (0-10). With enough grades, IdeaLens fits the weights so scores match your reviewers' judgement.</p>` : html`
      <p>Based on <b>${c.n}</b> graded ideas. Correlation with grades: current <b>${c.corr_current}</b> → suggested <b>${c.corr_suggested}</b>.</p>
      <div class="grid g2"><div><h3>Current weights</h3>${Object.entries(c.current).map(([k, v]) => html`<${Bar} key=${k} label=${k} value=${Math.round(v * 100)} suffix="%" plain=${true} />`)}</div>
        <div><h3>Suggested weights</h3>${Object.entries(c.suggested).map(([k, v]) => html`<${Bar} key=${k} label=${k} value=${Math.round(v * 100)} suffix="%" plain=${true} />`)}</div></div>
      <button class="btn" onClick=${() => act("apply", "New weights applied")}>Apply suggested weights</button>`}
      <button class="btn ghost" style=${{ marginLeft: ".5rem" }} onClick=${() => act("reset", "Default weights restored")}>Restore defaults</button></div></div>`;
}
