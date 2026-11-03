/* app.js - router, layout (sidebar) and app shell */

const NAV = {
  student: [["/s", "🏠", "Dashboard"], ["/s/new", "✨", "New analysis"], ["/s/reports", "🗂️", "My reports"], ["/s/compare", "⚖️", "Compare"], ["/notifications", "🔔", "Notifications"], ["/profile", "👤", "Profile"], ["/how", "❓", "How it works"]],
  teacher: [["/t", "🏠", "Dashboard"], ["/t/submissions", "📥", "Submissions"], ["/t/students", "🎓", "People"], ["/t/analytics", "📈", "Analytics"], ["/notifications", "🔔", "Notifications"], ["/profile", "👤", "Profile"], ["/how", "❓", "How it works"]],
  admin: [["/a", "🛡️", "Dashboard"], ["/a/users", "👥", "Users"], ["/a/corpus", "📚", "Reference data"], ["/a/calibration", "🎯", "Calibration"], ["/t/submissions", "📥", "Submissions"], ["/t/analytics", "📈", "Analytics"], ["/notifications", "🔔", "Notifications"], ["/profile", "👤", "Profile"]],
};

function isActive(href, path) {
  if (href === "/s" || href === "/t" || href === "/a") return path === href;
  if (href === "/s/reports") return path.startsWith("/s/reports") || path.startsWith("/s/report/");
  if (href === "/t/submissions") return path.startsWith("/t/submissions") || path.startsWith("/t/idea/");
  return path === href || path.startsWith(href + "/");
}

function Shell({ user, path, toggleTheme, onLogout, onInstall, unread, children }) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const items = NAV[user.role] || NAV.student;
  return html`<div class="app">
    <div class=${"scrim " + (open ? "on" : "")} onClick=${() => setOpen(false)}></div>
    <aside class=${"side " + (open ? "open" : "")}>
      <a class="logo" href="#/" style=${{ textDecoration: "none", margin: "0 0 .5rem .4rem" }}>💡 IdeaLens</a>
      <div class="row" style=${{ margin: "0 0 .6rem .4rem" }}><span class="badge">${t(ROLE_LABEL[user.role] || user.role)}</span><span class="muted">${user.name}</span></div>
      ${items.map(([href, ic, label]) => html`<a key=${href} href=${"#" + href} class=${"nl " + (isActive(href, path) ? "on" : "")}><span>${ic}</span>${t(label)}${href === "/notifications" && unread > 0 && html`<span class="bell">${unread}</span>`}</a>`)}
      <div class="grow"></div>
      ${onInstall && html`<button class="nl btn-like" onClick=${onInstall}><span>📲</span>${t("Install app")}</button>`}
      <div style=${{ padding: ".3rem .6rem" }}><${LangPicker} /></div>
      <button class="nl btn-like" onClick=${toggleTheme}><span>🌓</span>${t("Light / dark")}</button>
      <button class="nl btn-like" onClick=${onLogout}><span>🚪</span>${t("Log out")}</button></aside>
    <div class="main"><div class="topbar noprint"><button class="icon-btn" aria-label="Menu" onClick=${() => setOpen(true)}>☰</button><span class="logo">💡 IdeaLens</span>
      ${unread > 0 && html`<a href="#/notifications" class="bell" style=${{ marginLeft: "auto" }}>🔔 ${unread}</a>`}</div>
      <div class="content">${children}</div></div></div>`;
}

function renderPage(parts, user, setUser) {
  const [a, b, c, d] = parts;
  if (a === "profile") return html`<${Profile} user=${user} onUser=${setUser} />`;
  if (a === "notifications") return html`<${Notifications} />`;
  if (a === "s") {
    if (!b) return html`<${StudentHome} user=${user} />`;
    if (b === "new") return html`<${Analyze} />`;
    if (b === "reports") return html`<${MyReports} />`;
    if (b === "compare") return html`<${Compare} />`;
    if (b === "report" && c) return html`<${ReportPage} role="student" id=${c} tab=${d} key=${c} />`;
  }
  if (a === "t") {
    if (!b) return html`<${TeacherHome} user=${user} />`;
    if (b === "submissions") return html`<${Submissions} />`;
    if (b === "students") return html`<${Students} />`;
    if (b === "analytics") return html`<${Analytics} />`;
    if (b === "idea" && c) return html`<${ReportPage} role="teacher" id=${c} tab=${d} key=${c} />`;
  }
  if (a === "a") {
    if (!b) return html`<${AdminHome} />`;
    if (b === "users") return html`<${AdminUsers} me=${user} />`;
    if (b === "corpus") return html`<${AdminCorpus} />`;
    if (b === "calibration") return html`<${AdminCalibration} />`;
  }
  return html`<${Empty} icon="🧭" title="Page not found" text="That page does not exist."><a class="btn" href="#/">Go home</a><//>`;
}

function App() {
  const path = useHash();
  const [user, setUser] = useState(null); const [ready, setReady] = useState(false);
  const [toast, setToast] = useState(""); const [unread, setUnread] = useState(0);
  const [install, setInstall] = useState(null); const [, force] = useState(0);
  const [theme, setTheme] = useState(localStorage.getItem("il_theme") || "");

  useEffect(() => { if (theme) document.documentElement.setAttribute("data-theme", theme); else document.documentElement.removeAttribute("data-theme"); }, [theme]);
  useEffect(() => {
    let tm;
    const onToast = (e) => { setToast(e.detail); clearTimeout(tm); tm = setTimeout(() => setToast(""), 2600); };
    const onLang = () => force((x) => x + 1);
    const onInstallEv = (e) => { e.preventDefault(); setInstall(e); };
    window.addEventListener("toast", onToast); window.addEventListener("langchange", onLang); window.addEventListener("beforeinstallprompt", onInstallEv);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => { window.removeEventListener("toast", onToast); window.removeEventListener("langchange", onLang); window.removeEventListener("beforeinstallprompt", onInstallEv); };
  }, []);
  useEffect(() => {
    if (!localStorage.getItem("il_token")) { setReady(true); return; }
    api("/auth/me").then(setUser).catch(() => localStorage.removeItem("il_token")).finally(() => setReady(true));
  }, []);
  useEffect(() => {  // unread notification badge
    if (!user) return;
    const poll = () => api("/notifications").then((d) => setUnread(d.unread)).catch(() => {});
    poll(); const iv = setInterval(poll, 30000); window.addEventListener("notifs", poll);
    return () => { clearInterval(iv); window.removeEventListener("notifs", poll); };
  }, [user && user.id, path]);

  const toggleTheme = () => {
    const dark = theme ? theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next = dark ? "light" : "dark"; localStorage.setItem("il_theme", next); setTheme(next);
  };
  const onAuth = (u) => { setUser(u); go(homePath(u)); };
  const logout = () => { localStorage.removeItem("il_token"); setUser(null); setUnread(0); go("/"); };
  const doInstall = () => { if (install) { install.prompt(); setInstall(null); } };

  const parts = path.split("/").filter(Boolean);
  const first = parts[0] || "";
  let redirect = "";
  if (ready) {
    if (!user && ["s", "t", "a", "profile", "notifications"].includes(first)) redirect = "/login";
    else if (user && ["login", "signup", "forgot", "reset"].includes(first)) redirect = homePath(user);
    else if (user && first === "s" && user.role !== "student") redirect = homePath(user);
    else if (user && first === "t" && user.role === "student") redirect = "/s";
    else if (user && first === "a" && user.role !== "admin") redirect = homePath(user);
  }
  useEffect(() => { if (redirect) go(redirect); }, [redirect]);

  let page;
  if (!ready || redirect) page = html`<${Loading} />`;
  else if (!user && first === "login") page = html`<${Login} onAuth=${onAuth} toggleTheme=${toggleTheme} />`;
  else if (!user && first === "signup") page = html`<${Signup} onAuth=${onAuth} toggleTheme=${toggleTheme} />`;
  else if (!user && first === "forgot") page = html`<${Forgot} toggleTheme=${toggleTheme} />`;
  else if (!user && first === "reset") page = html`<${ResetPassword} toggleTheme=${toggleTheme} />`;
  else if (first === "how") page = html`<${How} user=${user} toggleTheme=${toggleTheme} />`;
  else if (first === "") page = html`<${Home} user=${user} toggleTheme=${toggleTheme} />`;
  else if (user) page = html`<${Shell} user=${user} path=${path} toggleTheme=${toggleTheme} onLogout=${logout} onInstall=${install ? doInstall : null} unread=${unread}>${renderPage(parts, user, setUser)}<//>`;
  else page = html`<${Loading} />`;

  return html`<div>${page}${toast && html`<div class="toast">${toast}</div>`}</div>`;
}

/* Any unexpected page error shows a friendly message instead of a blank screen. */
class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; this.reset = () => this.setState({ err: null }); }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) { console.error(err); }
  componentDidMount() { window.addEventListener("hashchange", this.reset); }
  componentWillUnmount() { window.removeEventListener("hashchange", this.reset); }
  render() {
    if (!this.state.err) return this.props.children;
    return html`<div class="wrap"><div class="card" style=${{ maxWidth: "480px", margin: "10vh auto", textAlign: "center" }}><h2>Something went wrong</h2>
      <p class="muted">This page hit an unexpected problem. Your data is safe.</p>
      <div class="row" style=${{ justifyContent: "center", marginTop: "1rem" }}><button class="btn" onClick=${() => location.reload()}>Reload</button><a class="btn ghost" href="#/">Home</a></div></div></div>`;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(html`<${ErrorBoundary}><${App} /><//>`);
