/* Frontend smoke test: renders every page (student, teacher, admin; en/ta/hi) with real backend data.
   Run:  python tools/gen_fixtures.py  &&  node tools/render_check.js */
// Runs every page component with a stub React + a small htm-compatible parser, using REAL backend data.
const vm = require("vm"), fs = require("fs");
const path = require("path");
const JS = process.argv[2] || path.join(__dirname, "..", "frontend", "js");
const FIXTURES = path.join(__dirname, "fixtures.json");
const FX = JSON.parse(fs.readFileSync(FIXTURES, "utf8"));
const order = ["core", "i18n", "ui", "shared", "public", "student", "teacher", "admin", "app"];
let role = "student";
const problems = [];

/* ---------- htm-compatible tagged template parser ---------- */
function makeHtm(h) {
  return function (statics, ...fields) {
    const S = "\uE000", E = "\uE001";
    let src = statics[0];
    for (let i = 0; i < fields.length; i++) src += S + i + E + statics[i + 1];
    let p = 0;
    const isWs = (c) => c === " " || c === "\n" || c === "\t" || c === "\r";
    const fieldAt = () => { if (src[p] !== S) return null; const e = src.indexOf(E, p); const i = +src.slice(p + 1, e); p = e + 1; return { v: fields[i] }; };
    const subst = (s) => s.replace(new RegExp(S + "(\\d+)" + E, "g"), (_, i) => String(fields[+i]));
    function parseChildren() {
      const out = [];
      while (p < src.length) {
        if (src[p] === "<") {
          if (src[p + 1] === "/") { p = src.indexOf(">", p) + 1; return out; }
          out.push(parseElement());
        } else if (src[p] === S) { out.push(fieldAt().v); }
        else {
          let q = p; while (q < src.length && src[q] !== "<" && src[q] !== S) q++;
          let t = src.slice(p, q); p = q;
          if (/\n/.test(t)) t = t.replace(/^\s*\n\s*|\s*\n\s*$/g, "").replace(/\s*\n\s*/g, " ");
          if (t !== "") out.push(t);
        }
      }
      return out;
    }
    function parseElement() {
      p++; // <
      let type;
      if (src[p] === S) type = fieldAt().v;
      else { let q = p; while (q < src.length && !isWs(src[q]) && src[q] !== ">" && src[q] !== "/") q++; type = src.slice(p, q); p = q; }
      const props = {};
      for (;;) {
        while (isWs(src[p])) p++;
        if (p >= src.length) throw new Error("unterminated tag <" + String(type && type.name || type));
        if (src[p] === "/" && src[p + 1] === ">") { p += 2; return h(type, Object.keys(props).length ? props : null); }
        if (src[p] === ">") { p++; const kids = parseChildren(); return h(type, Object.keys(props).length ? props : null, ...kids); }
        if (src.startsWith("...", p)) { p += 3; Object.assign(props, fieldAt().v); continue; }
        let q = p; while (q < src.length && !isWs(src[q]) && src[q] !== "=" && src[q] !== ">" && !(src[q] === "/" && src[q + 1] === ">")) q++;
        const name = src.slice(p, q); p = q;
        if (src[p] === "=") {
          p++;
          if (src[p] === '"' || src[p] === "'") { const qt = src[p]; const e = src.indexOf(qt, p + 1); const raw = src.slice(p + 1, e); p = e + 1; props[name] = subst(raw); }
          else if (src[p] === S) props[name] = fieldAt().v;
          else { let r = p; while (r < src.length && !isWs(src[r]) && src[r] !== ">") r++; props[name] = src.slice(p, r); p = r; }
        } else props[name] = true;
      }
    }
    const roots = parseChildren();
    return roots.length === 1 ? roots[0] : roots;
  };
}

/* ---------- stub React: components run eagerly, so every branch executes ---------- */
const React = {
  Fragment: "frag", Component: class { constructor(p) { this.props = p; } },
  createElement(type, props, ...kids) {
    props = props || {};
    if (typeof type === "function") return type({ ...props, children: kids.length <= 1 ? kids[0] : kids });
    return { tag: type, props, children: kids };
  },
  useState: (i) => { const q = ctx.__sq, k = ctx.__si++; if (q && q[k] !== undefined) return [q[k], () => {}]; return [typeof i === "function" ? i() : i, () => {}]; },
  useEffect() {}, useRef: (i) => ({ current: i }), useMemo: (f) => f(), useCallback: (f) => f, useContext: () => ({}),
};
const ctx = {
  console, React, ReactDOM: { createRoot: () => ({ render() {} }) }, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, location: { hash: "#/", reload() {} }, navigator: {},
  document: { getElementById: () => ({}), documentElement: { setAttribute() {}, removeAttribute() {} } },
  Event: class {}, CustomEvent: class { constructor(n, o) { this.detail = o && o.detail; } }, URL, Blob: class {}, FileReader: class {},
  confirm: () => true, matchMedia: () => ({ matches: false }), scrollTo() {}, fetch: () => { throw new Error("fetch called during render"); },
  Intl, Math, JSON, Date, Object, Array, String, Number, Promise, Set, Map, Error, parseInt, parseFloat, isNaN, encodeURIComponent,
};
ctx.__sq = null; ctx.__si = 0; ctx.window = ctx; ctx.addEventListener = () => {}; ctx.removeEventListener = () => {}; ctx.dispatchEvent = () => {};
ctx.htm = { bind: (h) => makeHtm(h) };
vm.createContext(ctx);
let code = order.map((f) => fs.readFileSync(`${JS}/${f}.js`, "utf8")).join("\n;\n");
code = code.replace("const api = async", "var api = async");
code = code.replace(/ReactDOM\.createRoot\(document\.getElementById\("root"\)\)\.render\([^;]*\);\s*$/m, "");
vm.runInContext(code, ctx, { filename: "bundle.js" });
vm.runInContext(`
  var __role = "student"; var __missing = [];
  api = function (path, opts) {
    if (opts && opts.method && opts.method !== "GET") return Promise.resolve({ ok: true });
    var v = FX[__role][String(path).split("?")[0]];
    if (v === undefined) { __missing.push(__role + " " + path); return { __sync: {}, then: function (r) { return Promise.resolve({}).then(r); }, catch: function () { return this; } }; }
    return { __sync: v, then: function (r) { return Promise.resolve(v).then(r); }, catch: function () { return this; } };
  };
  useLoad = function (fn) { var p = fn(); return { data: p && p.__sync !== undefined ? p.__sync : null, loading: false, error: "", reload: function () {} }; };
`, Object.assign(ctx, { FX }));

/* ---------- walk output and flag obviously broken text ---------- */
function walk(n, where, depth = 0) {
  if (depth > 60) { problems.push(where + ": tree too deep"); return; }
  if (n === null || n === undefined || n === false || n === true) return;
  if (Array.isArray(n)) return n.forEach((x) => walk(x, where, depth + 1));
  if (typeof n === "string" || typeof n === "number") {
    const s = String(n);
    if (/undefined|\bNaN\b|\[object Object\]|null%|NaN%/.test(s)) problems.push(where + ": suspicious text -> " + s.slice(0, 80));
    return;
  }
  if (typeof n === "function") { problems.push(where + ": function rendered as child"); return; }
  if (n.tag !== undefined) {
    if (n.props) for (const [k, v] of Object.entries(n.props)) { if (typeof v === "string" && /undefined|NaN|\[object/.test(v) && k !== "placeholder") problems.push(where + ": bad attr " + k + "=" + v.slice(0, 60)); if (k === "style" && v && typeof v !== "object") problems.push(where + ": style not object"); }
    return walk(n.children, where, depth + 1);
  }
  problems.push(where + ": unexpected node " + JSON.stringify(n).slice(0, 80));
}
let ok = 0;
function check(name, fn) {
  try { walk(fn(), name); ok++; } catch (e) { problems.push(name + ": CRASH " + e.message + "\n" + (e.stack || "").split("\n").slice(1, 4).join("\n")); }
}
const run = (code) => vm.runInContext(code, ctx);
const ids = FX.ids;
const user = (r) => ({ id: "u", name: "Test User", email: "t@x.com", role: r, workspace: "" });

for (const lang of ["en", "ta", "hi"]) {
  run(`setLang("${lang}")`);
  const L = (n) => `${n}[${lang}]`;
  // public pages
  for (const [n, call] of [["Home", "Home({user:null,toggleTheme(){}})"], ["Home(user)", "Home({user:" + JSON.stringify(user("student")) + ",toggleTheme(){}})"], ["How", "How({user:null,toggleTheme(){}})"],
    ["Login", "Login({onAuth(){},toggleTheme(){}})"], ["Signup", "Signup({onAuth(){},toggleTheme(){}})"], ["Forgot", "Forgot({toggleTheme(){}})"], ["ResetPassword", "ResetPassword({toggleTheme(){}})"], ["LangPicker", "LangPicker()"]])
    check(L(n), () => run(call));
  // student pages
  run('__role="student"');
  const U = JSON.stringify(user("student"));
  for (const [n, call] of [["StudentHome", `StudentHome({user:${U}})`], ["Analyze", "Analyze({})"], ["MyReports", "MyReports()"], ["Compare", "Compare()"], ["Notifications", "Notifications()"], ["Profile", `Profile({user:${U},onUser(){}})`]])
    check(L("student." + n), () => run(call));
  for (const id of [ids.a1, ids.a2, ids.draft, ids.old]) for (const tab of ["overview", "similarity", "risks", "improve", "tech", "roadmap", "versions", "chat", "feedback", "full", undefined, "bogus"])
    check(L(`student.Report(${id.slice(0, 4)}/${tab})`), () => run(`ReportPage({role:"student",id:"${id}",tab:${tab ? '"' + tab + '"' : "undefined"}})`));
  // teacher pages
  run('__role="teacher"');
  const TU = JSON.stringify(user("teacher"));
  for (const [n, call] of [["TeacherHome", `TeacherHome({user:${TU}})`], ["Submissions", "Submissions()"], ["Students", "Students()"], ["Analytics", "Analytics()"], ["Notifications", "Notifications()"]])
    check(L("teacher." + n), () => run(call));
  for (const id of [ids.a1, ids.b1, ids.old2]) for (const tab of ["overview", "similarity", "risks", "improve", "tech", "roadmap", "review", "full", undefined])
    check(L(`teacher.Report(${id.slice(0, 4)}/${tab})`), () => run(`ReportPage({role:"teacher",id:"${id}",tab:${tab ? '"' + tab + '"' : "undefined"}})`));
  // admin pages
  run('__role="admin"');
  const AU = JSON.stringify(user("admin"));
  for (const [n, call] of [["AdminHome", "AdminHome()"], ["AdminUsers", `AdminUsers({me:${AU}})`], ["AdminCorpus", "AdminCorpus()"], ["AdminCalibration", "AdminCalibration()"], ["TeacherHome", `TeacherHome({user:${AU}})`], ["Submissions", "Submissions()"], ["Analytics", "Analytics()"]])
    check(L("admin." + n), () => run(call));
  // shell + router for every route
  for (const [r, routes] of [["student", ["/s", "/s/new", "/s/reports", "/s/compare", `/s/report/${ids.a1}`, `/s/report/${ids.a1}/versions`, "/profile", "/notifications", "/nope"]],
    ["teacher", ["/t", "/t/submissions", "/t/students", "/t/analytics", `/t/idea/${ids.b1}/review`, "/profile"]], ["admin", ["/a", "/a/users", "/a/corpus", "/a/calibration", "/t/submissions", "/t/analytics"]]]) {
    run(`__role="${r}"`);
    const US = JSON.stringify(user(r));
    for (const path of routes)
      check(L(`Shell ${r} ${path.replace(/[0-9a-f]{32}/, "ID")}`), () => run(`(function(){var u=${US};var parts=${JSON.stringify(path)}.split("/").filter(Boolean);return Shell({user:u,path:${JSON.stringify(path)},toggleTheme(){},onLogout(){},onInstall:null,unread:2,children:renderPage(parts,u,function(){})});})()`));
  }
}
// interactive branches: preset component state (improver result, chat, errors, busy states, teacher/admin sign-up)
function withState(q, name, call) { check(name, () => { ctx.__sq = q; ctx.__si = 0; try { return run(call); } finally { ctx.__sq = null; } }); }
ctx.IMP = FX.improve; ctx.CHAT = FX.chat.chat; ctx.DOCS = { [ids.a1]: FX.student["/analyses/" + ids.a1], [ids.a2]: FX.student["/analyses/" + ids.a2] }; ctx.DOC1 = FX.student["/analyses/" + ids.a1]; ctx.DOC_T = FX.teacher["/teacher/ideas/" + ids.b1];
run('__role="student"');
withState([ctx.IMP, false, ""], "ImproveTab(with improver result)", "ImproveTab({doc:DOC1,owner:true})");
withState([null, true, "Something failed"], "ImproveTab(busy+error)", "ImproveTab({doc:DOC1,owner:true})");
withState([ctx.IMP, false, ""], "ImproveTab(teacher view)", "ImproveTab({doc:DOC_T,owner:false})");
withState([ctx.CHAT, "hello", true], "ChatTab(messages+busy)", "ChatTab({doc:DOC1})");
withState([[], "", false], "ChatTab(empty)", "ChatTab({doc:DOC1})");
withState([ctx.DOC1.id, ctx.DOCS[ids.a2].id, ctx.DOCS], "Compare(two chosen)", "Compare()");
withState([ctx.DOC1.id, "", {}], "Compare(one chosen)", "Compare()");
withState([{ title: "t", description: "d" }, true, "Failed"], "Analyze(busy+error)", "Analyze({})");
withState([{ name: "A", email: "a@b.co", password: "x", role: "admin", teacher_code: "c", workspace: "w" }, "Bad code", true], "Signup(admin+error)", "Signup({onAuth(){},toggleTheme(){}})");
withState([{ name: "A", email: "a@b.co", password: "x", role: "teacher", teacher_code: "c", workspace: "w" }, "", false], "Signup(teacher)", "Signup({onAuth(){},toggleTheme(){}})");
withState([{ email: "a@b.co", password: "x" }, "Wrong password", true], "Login(error+busy)", "Login({onAuth(){},toggleTheme(){}})");
run('__role="teacher"');
withState([{ comment: "ok", grade: "7", status: "approved" }, true, "Failed"], "ReviewForm(busy+error)", "ReviewForm({doc:DOC_T,onDone(){}})");
const miss = run("__missing"); if (miss.length) problems.push("frontend asked for data the fixtures/backend did not provide: " + [...new Set(miss)].join(", "));
console.log(`rendered ${ok} page variants`);
if (problems.length) { console.log("PROBLEMS (" + problems.length + "):"); [...new Set(problems)].slice(0, 40).forEach((p) => console.log(" -", p)); process.exit(1); }
console.log("NO RENDER CRASHES");
