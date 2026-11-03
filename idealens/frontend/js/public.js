/* public.js - pages visible before login: Home, How it works, Login, Signup, Forgot/Reset password */

function PublicNav({ user, toggleTheme }) {
  return html`<div class="nav"><a class="logo" href="#/" style=${{ textDecoration: "none" }}>💡 IdeaLens</a>
    <a class="nl-top" href="#/how">${t("How it works")}</a>
    ${user ? html`<a class="btn sm" href=${"#" + homePath(user)}>${t("Open dashboard")}</a>`
      : html`<a class="btn ghost sm" href="#/login">${t("Log in")}</a><a class="btn sm" href="#/signup">${t("Sign up")}</a>`}
    <${LangPicker} /><button class="icon-btn" onClick=${toggleTheme} aria-label="Toggle theme">🌓</button></div>`;
}

const FEATURES = [
  ["🔍", "Similarity check", "Finds existing projects close to your idea so you know how original it is."],
  ["📊", "Explainable scoring", "Originality, innovation, feasibility, impact and relevance, each with a reason."],
  ["⚠️", "Risk analysis", "Technical, financial, resource and data risks, each with a mitigation."],
  ["✨", "AI idea improver", "Rewrites your idea with missing features and shows the score before and after."],
  ["🕘", "Versions", "Revise your idea and compare every version side by side."],
  ["💬", "Mentor chat", "Ask follow-up questions about cost, risks, technology and next steps."],
  ["🌍", "UN SDG tags", "See which Sustainable Development Goals your idea supports."],
  ["👥", "Teams and reviewers", "Workspaces for classes, companies or clubs, with review, grades and duplicate alerts."],
  ["📄", "PDF report", "Download a clean report to share with investors, guides or managers."],
  ["📱", "Install as an app", "Works on phones and desktops, in English, Tamil and Hindi."],
];

function Home({ user, toggleTheme }) {
  return html`<div><${PublicNav} user=${user} toggleTheme=${toggleTheme} />
    <div class="hero3"><h1>Test any idea <span class="grad">before you build it</span></h1>
      <p class="muted">For students, makers, startups and teams. IdeaLens checks originality, scores feasibility, predicts risks, improves your idea and plans the roadmap.</p>
      <div class="row" style=${{ justifyContent: "center", marginTop: "1.2rem" }}>
        ${user ? html`<a class="btn" href=${"#" + homePath(user)}>${t("Open dashboard")}</a>`
          : html`<a class="btn" href="#/signup">Get started free</a><a class="btn ghost" href="#/how">${t("How it works")}</a>`}</div></div>
    <div class="wrap"><h2 style=${{ textAlign: "center", marginBottom: "1rem" }}>Everything in one place</h2>
      <div class="grid g3">${FEATURES.map(([i, ti, d]) => html`<div class="card feat" key=${ti}><div class="ei">${i}</div><h3>${ti}</h3><p class="muted">${d}</p></div>`)}</div>
      <div class="card" style=${{ textAlign: "center", marginTop: "1rem" }}><h2>Who is it for?</h2>
        <p class="muted">Students planning a final-year project, founders validating a startup idea, product teams comparing options, and mentors or managers who review many ideas.</p></div></div>
    <p class="muted" style=${{ textAlign: "center", padding: "1.5rem" }}>IdeaLens · AI-driven idea analyzer</p></div>`;
}

function How({ user, toggleTheme }) {
  const steps = [["Create an account", "Sign up as a creator. Add your team, class or company as your workspace."],
    ["Describe your idea", "Write the problem, the users and the technology you plan to use."],
    ["Read the report", "Scores with reasons, similar projects, risks, improvements, technology, roadmap and SDGs - each on its own page."],
    ["Improve it", "Use the AI improver or edit the idea, then compare versions and chat with the mentor."],
    ["Share or submit", "Download a PDF, or submit the idea to reviewers in your workspace for feedback and a grade."]];
  return html`<div><${PublicNav} user=${user} toggleTheme=${toggleTheme} /><div class="wrap">
    <div class="ph"><div><h1>${t("How it works")}</h1><p class="muted">From a rough idea to a reviewed project plan</p></div></div>
    <div class="card"><div class="tl">${steps.map(([ti, d]) => html`<div class="step" key=${ti}><b>${ti}</b><p class="muted">${d}</p></div>`)}</div></div>
    <div class="card"><h2>How are scores calculated?</h2>
      <p>Originality compares your text with a reference dataset of existing projects (more can be added by an admin). Feasibility depends on the technical complexity found in your description. Innovation, impact and relevance come from the features and domains you mention. If an AI key is configured, an AI model scores independently and the two are averaged. Every score shows its reason. Scores are guidance, not a guarantee.</p></div>
    <a class="btn" href=${user ? "#" + homePath(user) : "#/signup"}>${user ? t("Open dashboard") : "Create free account"}</a></div></div>`;
}

function AuthShell({ title, children, toggleTheme }) {
  return html`<div><${PublicNav} user=${null} toggleTheme=${toggleTheme} /><div class="wrap"><div class="auth">
    <div class="hero"><h1>💡 IdeaLens</h1><p class="muted">${title}</p></div>${children}</div></div></div>`;
}

function Login({ onAuth, toggleTheme }) {
  const [f, setF] = useState({ email: "", password: "" }); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try { const d = await api("/auth/login", { method: "POST", body: f }); localStorage.setItem("il_token", d.token); onAuth(d.user); }
    catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  return html`<${AuthShell} title=${t("Welcome back")} toggleTheme=${toggleTheme}><form class="card" onSubmit=${submit}>
    <h2>${t("Log in")}</h2>
    <label>${t("Email")}</label><input type="email" value=${f.email} onInput=${(e) => setF({ ...f, email: e.target.value })} required autoComplete="email" />
    <label>${t("Password")}</label><input type="password" value=${f.password} onInput=${(e) => setF({ ...f, password: e.target.value })} required autoComplete="current-password" />
    ${err && html`<div class="err">${err}</div>`}
    <button class="btn" style=${{ width: "100%", marginTop: "1rem" }} disabled=${busy}>${busy ? "Please wait…" : t("Log in")}</button>
    <p class="muted" style=${{ marginTop: ".8rem", textAlign: "center" }}><a href="#/forgot">${t("Forgot password?")}</a> · <a href="#/signup">${t("Sign up")}</a></p></form><//>`;
}

function Signup({ onAuth, toggleTheme }) {
  const [f, setF] = useState({ name: "", email: "", password: "", role: "student", teacher_code: "", workspace: "" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try { const d = await api("/auth/register", { method: "POST", body: f }); localStorage.setItem("il_token", d.token); onAuth(d.user); }
    catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  const roles = [["student", "🎓 " + t("Creator")], ["teacher", "🧑‍🏫 " + t("Reviewer")], ["admin", "🛡️ " + t("Admin")]];
  return html`<${AuthShell} title=${t("Create your account")} toggleTheme=${toggleTheme}><form class="card" onSubmit=${submit}>
    <h2>${t("Sign up")}</h2><label>I am a</label>
    <div class="tabs">${roles.map(([k, l]) => html`<button type="button" key=${k} class=${f.role === k ? "on" : ""} onClick=${() => setF({ ...f, role: k })}>${l}</button>`)}</div>
    <p class="muted">${f.role === "student" ? "Analyse and improve your own ideas." : f.role === "teacher" ? "Mentor, teacher or manager who reviews ideas from your workspace." : "Manages users, the reference dataset and scoring."}</p>
    <label>${t("Full name")}</label><input value=${f.name} onInput=${set("name")} required minLength="2" autoComplete="name" />
    <label>${t("Email")}</label><input type="email" value=${f.email} onInput=${set("email")} required autoComplete="email" />
    <label>${t("Password")} (min 6)</label><input type="password" value=${f.password} onInput=${set("password")} required minLength="6" autoComplete="new-password" />
    <label>${t("Workspace")} <span class="muted">(optional: team, class or company)</span></label>
    <input value=${f.workspace} onInput=${set("workspace")} maxLength="60" placeholder="General" />
    ${f.role !== "student" && html`<label>${f.role === "admin" ? "Admin" : "Reviewer"} access code</label><input value=${f.teacher_code} onInput=${set("teacher_code")} required autoComplete="off" placeholder="Code set by the server owner" />`}
    ${err && html`<div class="err">${err}</div>`}
    <button class="btn" style=${{ width: "100%", marginTop: "1rem" }} disabled=${busy}>${busy ? "Please wait…" : t("Create account")}</button>
    <p class="muted" style=${{ marginTop: ".8rem", textAlign: "center" }}><a href="#/login">${t("Log in")}</a></p></form><//>`;
}

function Forgot({ toggleTheme }) {
  const [email, setEmail] = useState(""); const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault(); setErr("");
    try { setMsg((await api("/auth/forgot", { method: "POST", body: { email } })).message); } catch (e2) { setErr(e2.message); }
  };
  return html`<${AuthShell} title="Reset your password" toggleTheme=${toggleTheme}><form class="card" onSubmit=${submit}>
    <h2>${t("Forgot password?")}</h2><p class="muted">Enter your email. We send a reset code that works for 30 minutes.</p>
    <label>${t("Email")}</label><input type="email" value=${email} onInput=${(e) => setEmail(e.target.value)} required />
    ${msg && html`<div class="banner good" style=${{ marginTop: ".8rem" }}>${msg}</div>`}${err && html`<div class="err">${err}</div>`}
    <button class="btn" style=${{ width: "100%", marginTop: "1rem" }}>${t("Send")}</button>
    <p class="muted" style=${{ marginTop: ".8rem", textAlign: "center" }}><a href="#/reset">I have a code</a> · <a href="#/login">${t("Log in")}</a></p></form><//>`;
}

function ResetPassword({ toggleTheme }) {
  const [f, setF] = useState({ email: "", code: "", new_password: "" }); const [err, setErr] = useState(""); const [done, setDone] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr("");
    try { await api("/auth/reset", { method: "POST", body: f }); setDone(true); } catch (e2) { setErr(e2.message); }
  };
  return html`<${AuthShell} title="Choose a new password" toggleTheme=${toggleTheme}>
    ${done ? html`<div class="card"><h2>Password changed ✅</h2><a class="btn" href="#/login">${t("Log in")}</a></div>` : html`<form class="card" onSubmit=${submit}>
      <label>${t("Email")}</label><input type="email" value=${f.email} onInput=${(e) => setF({ ...f, email: e.target.value })} required />
      <label>Reset code</label><input value=${f.code} onInput=${(e) => setF({ ...f, code: e.target.value })} required autoComplete="off" />
      <label>New password (min 6)</label><input type="password" value=${f.new_password} onInput=${(e) => setF({ ...f, new_password: e.target.value })} required minLength="6" autoComplete="new-password" />
      ${err && html`<div class="err">${err}</div>`}<button class="btn" style=${{ width: "100%", marginTop: "1rem" }}>Change password</button></form>`}<//>`;
}
