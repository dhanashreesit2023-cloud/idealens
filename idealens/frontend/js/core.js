/* core.js - shared helpers: API client, router helpers, data hook */
const { useState, useEffect } = React;
const html = htm.bind(React.createElement);

const api = async (path, opts = {}) => {
  const t = localStorage.getItem("il_token");
  const res = await fetch("/api" + path, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json", ...(t ? { Authorization: "Bearer " + t } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    const d = data && data.detail;
    const msg = typeof d === "string" ? d : Array.isArray(d) ? d.map((x) => x.msg).join(", ") : "Something went wrong";
    const err = new Error(msg); err.status = res.status; throw err;
  }
  return data;
};

const color = (v) => (v >= 70 ? "var(--good)" : v >= 45 ? "var(--warn)" : "var(--bad)");
const fmt = (iso) => (iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "-");
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString([], { dateStyle: "medium" }) : "-");
const STATUS_KEYS = ["draft", "submitted", "under_review", "approved", "needs_changes"];
const STATUS = { draft: "Draft", submitted: "Submitted", under_review: "Under review", approved: "Approved", needs_changes: "Needs changes" };
const KINDS = ["general", "college", "startup", "research", "hackathon", "personal"];
const notify = (m) => window.dispatchEvent(new CustomEvent("toast", { detail: m }));
const go = (p) => { location.hash = "#" + p; window.scrollTo(0, 0); };

function useHash() {
  const read = () => (location.hash || "#/").replace(/^#/, "") || "/";
  const [h, setH] = useState(read());
  useEffect(() => {
    const f = () => setH(read());
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  return h;
}

/* Loads data from the API; keeps old data visible while reloading. */
function useLoad(fn, deps) {
  const [st, setSt] = useState({ data: null, loading: true, error: "" });
  const run = () => {
    setSt((s) => ({ ...s, loading: true, error: "" }));
    fn().then((d) => setSt({ data: d, loading: false, error: "" }))
      .catch((e) => {
        if (e.status === 401) { localStorage.removeItem("il_token"); location.hash = "#/login"; location.reload(); return; }
        setSt({ data: null, loading: false, error: e.message });
      });
  };
  useEffect(run, deps);
  return { ...st, reload: run };
}

/* Downloads a PDF from an authenticated API route */
const downloadPdf = async (path, name) => {
  try {
    const res = await fetch("/api" + path, { headers: { Authorization: "Bearer " + localStorage.getItem("il_token") } });
    if (!res.ok) { let m = "Could not create the PDF"; try { m = (await res.json()).detail || m; } catch (e) {} throw new Error(m); }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) { notify(e.message); }
};

const ROLE_LABEL = { student: "Creator", teacher: "Reviewer", admin: "Admin" };
const homePath = (u) => (u && u.role === "admin" ? "/a" : u && u.role === "teacher" ? "/t" : "/s");

async function downloadFile(path, name) {
  const tk = localStorage.getItem("il_token");
  try {
    const res = await fetch("/api" + path, { headers: { Authorization: "Bearer " + tk } });
    if (!res.ok) { notify("Download failed"); return; }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (e) { notify("Download failed"); }
}
