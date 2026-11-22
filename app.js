"use strict";
/* LIFT — workout, steps & meal tracker with personal-record alerts. Vanilla JS + Supabase. */

const sb = window.supabase.createClient(window.LIFT_CONFIG.url, window.LIFT_CONFIG.key);

/* ---------- helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd();
const addDays = (s, n) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return ymd(d); };
const fmtDate = (s) => new Date(s + "T12:00:00").toLocaleDateString(I18N.loc, { weekday: "short", month: "short", day: "numeric" });
const fmtDT = (iso) => new Date(iso).toLocaleDateString(I18N.loc, { weekday: "short", month: "short", day: "numeric" });
const fmtDur = (sec) => { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return h ? `${h}h ${pad(m)}m` : `${m}:${pad(s)}`; };
const weekStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay()); return d.toISOString(); };
const epley = (w, r) => w * (1 + r / 30);
const KG_PER_LB = 0.45359237;
const ask = (m) => window.confirm(I18N.tr(m));

const S = {
  user: null, profile: null, exercises: [], tab: "home", notifs: [],
  active: null, mealDate: today(), progressTab: "lifts", progressEx: null, tick: null, rest: null, channel: null,
};

const unit = () => (S.profile && S.profile.weight_unit) || "kg";
const toDisp = (kg) => (kg == null ? "" : unit() === "lb" ? Math.round(kg / KG_PER_LB * 10) / 10 : Math.round(kg * 100) / 100);
const toKg = (v) => { const n = parseFloat(v); if (!isFinite(n)) return null; return Math.round((unit() === "lb" ? n * KG_PER_LB : n) * 100) / 100; };
const wtxt = (kg) => (kg == null ? "—" : `${toDisp(kg)} ${unit()}`);

const ICONS = {
  home: '<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  train: '<svg viewBox="0 0 24 24"><path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/></svg>',
  fuel: '<svg viewBox="0 0 24 24"><path d="M7 3v8a3 3 0 0 0 3 3v7M10 3v6M4 3v6M17 3c-2 2-3 5-3 8h3v10"/></svg>',
  progress: '<svg viewBox="0 0 24 24"><path d="M3 20h18M5 16l4-5 4 3 6-8"/></svg>',
  me: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 21a2 2 0 0 0 4 0"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

function toast(html, cls = "") {
  const el = document.createElement("div");
  el.className = "toast " + cls;
  el.innerHTML = html;
  $("#toast-root").appendChild(el);
  setTimeout(() => el.remove(), cls.includes("pr") ? 6000 : 3000);
}
const toastMsg = (m) => toast(esc(m));

function openSheet(title, body, { onOpen } = {}) {
  closeSheet();
  $("#sheet-root").innerHTML = `<div class="scrim" data-act="closeSheet"></div>
    <section class="sheet" role="dialog" aria-label="${esc(title)}"><div class="grab"></div>
    <div class="sh-head"><h2>${esc(title)}</h2><button class="icon-btn" data-act="closeSheet" aria-label="Close">${ICONS.x}</button></div>
    <div class="sh-body">${body}</div></section>`;
  if (onOpen) onOpen($("#sheet-root .sheet"));
}
const closeSheet = () => { stopScan(); $("#sheet-root").innerHTML = ""; };

async function must(p) {
  const { data, error } = await p;
  if (error) { console.error(error); toastMsg(error.message || "Something went wrong"); throw error; }
  return data;
}

/* ---------- charts ---------- */
function lineChart(points, { fmt = (v) => v, h = 170 } = {}) {
  if (points.length < 2) return `<div class="empty small">Log at least two sessions to see a trend.</div>`;
  const W = 340, H = h, P = { l: 34, r: 10, t: 12, b: 22 };
  const ys = points.map((p) => p.y);
  let min = Math.min(...ys), max = Math.max(...ys);
  if (min === max) { min -= 1; max += 1; }
  const pad_ = (max - min) * 0.15; min -= pad_; max += pad_;
  const x = (i) => P.l + (i / (points.length - 1)) * (W - P.l - P.r);
  const y = (v) => P.t + (1 - (v - min) / (max - min)) * (H - P.t - P.b);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ");
  const area = `${d} L${x(points.length - 1).toFixed(1)},${H - P.b} L${x(0).toFixed(1)},${H - P.b} Z`;
  const grid = [0, 0.5, 1].map((t) => { const v = min + (max - min) * t; return `<line class="gl" x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${P.l - 6}" y="${y(v) + 3}" text-anchor="end">${fmt(v)}</text>`; }).join("");
  const dots = points.length <= 24 ? points.map((p, i) => `<circle class="dot" cx="${x(i)}" cy="${y(p.y)}" r="3.2"/>`).join("") : "";
  const first = points[0].label, last = points[points.length - 1].label;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Trend chart"><defs><linearGradient id="cg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#2f7bff" stop-opacity=".32"/><stop offset="1" stop-color="#2f7bff" stop-opacity="0"/></linearGradient></defs>
    ${grid}<path class="ar" d="${area}"/><path class="ln" d="${d}"/>${dots}
    <text x="${P.l}" y="${H - 6}">${esc(first)}</text><text x="${W - P.r}" y="${H - 6}" text-anchor="end">${esc(last)}</text></svg>`;
}
function ring(pct, big, small) {
  const r = 46, c = 2 * Math.PI * r, off = c * (1 - Math.min(1, pct));
  return `<div class="ring-wrap"><svg viewBox="0 0 112 112"><circle class="ring-bg" cx="56" cy="56" r="${r}" fill="none" stroke-width="9"/><circle class="ring-fg" cx="56" cy="56" r="${r}" fill="none" stroke-width="9" stroke-dasharray="${c}" stroke-dashoffset="${off}"/></svg><div class="ring-label"><div><b class="num">${big}</b><span>${small}</span></div></div></div>`;
}

/* ---------- boot / auth ---------- */
async function init() {
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
  const { data } = await sb.auth.getSession();
  sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") { teardown(); renderAuth(); } });
  if (data.session) await boot(data.session.user); else renderAuth();
}

function teardown() {
  S.user = null; S.profile = null; S.active = null; S.notifs = [];
  clearInterval(S.tick); S.tick = null; stopRest();
  if (S.channel) { sb.removeChannel(S.channel); S.channel = null; }
}

function renderAuth(mode = "in", msg = "", ok = false) {
  $("#top").innerHTML = ""; $("#nav").innerHTML = ""; $("#minibar").innerHTML = "";
  $("#view").innerHTML = `<div class="auth">
    <div class="logo">LI<span>F</span>T</div>
    <p class="tag">Train. Track. Break records.</p>
    ${msg ? `<div class="msg ${ok ? "ok" : "err"}">${esc(msg)}</div>` : ""}
    <form id="auth-form" class="stack" data-mode="${mode}">
      ${mode === "up" ? `<label class="field"><span>Name</span><input type="text" name="name" autocomplete="name" placeholder="Your name"></label>` : ""}
      <label class="field"><span>Email</span><input type="email" name="email" autocomplete="email" required></label>
      <label class="field"><span>Password</span><input type="password" name="password" autocomplete="${mode === "up" ? "new-password" : "current-password"}" minlength="6" required></label>
      <button class="btn primary block" type="submit">${mode === "up" ? "Create account" : "Sign in"}</button>
    </form>
    <p class="muted small" style="text-align:center;margin-top:18px">${mode === "up" ? "Already training with us?" : "New here?"}
      <button class="link" data-act="authMode" data-mode="${mode === "up" ? "in" : "up"}">${mode === "up" ? "Sign in" : "Create an account"}</button></p></div>`;
}

async function boot(user) {
  S.user = user;
  $("#view").innerHTML = `<div class="sk"></div><div class="sk"></div>`;
  let { data: p } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!p) { const r = await sb.from("profiles").upsert({ id: user.id, display_name: user.email.split("@")[0] }).select().single(); p = r.data; }
  S.profile = p;
  const [ex, nf] = await Promise.all([
    sb.from("exercises").select("*").order("name"),
    sb.from("notifications").select("*").order("created_at", { ascending: false }).limit(40),
  ]);
  S.exercises = ex.data || []; S.notifs = nf.data || [];
  subscribeNotifications();
  await restoreActive();
  render();
}

function subscribeNotifications() {
  if (S.channel) sb.removeChannel(S.channel);
  S.channel = sb.channel("notif-" + S.user.id)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${S.user.id}` }, (payload) => onNotification(payload.new))
    .subscribe();
}

function onNotification(n) {
  if (S.notifs.some((x) => x.id === n.id)) return;
  S.notifs.unshift(n);
  if (n.type === "pr") {
    toast(`<span class="trophy">🏆</span><div><div class="t1">${esc(n.title)}</div><div class="t2">${esc(n.body || "")}</div></div>`, "pr");
    if (navigator.vibrate) navigator.vibrate([60, 40, 120]);
    systemNotify(n);
  }
  renderTop();
  if (S.tab === "me") render();
}

async function systemNotify(n) {
  try {
    if (!S.profile.push_enabled || !("Notification" in window) || Notification.permission !== "granted") return;
    if (document.visibilityState === "visible" && S.active) { /* in-app banner is enough mid-workout */ }
    const reg = await navigator.serviceWorker.getRegistration();
    const opts = { body: n.body || "", icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: "lift-pr-" + n.id, data: { url: "./" } };
    if (reg) reg.showNotification(n.title, opts); else new Notification(n.title, opts);
  } catch (_) {}
}

/* ---------- shell ---------- */
const TABS = [["home", "Home"], ["train", "Train"], ["fuel", "Fuel"], ["progress", "Progress"], ["me", "Me"]];

function renderTop() {
  const unread = S.notifs.filter((n) => !n.read_at).length;
  $("#top").innerHTML = `<div class="brand"><i></i>LIFT</div>
    <button class="icon-btn" data-act="openNotifs" aria-label="Notifications">${ICONS.bell}${unread ? `<span class="badge">${unread > 9 ? "9+" : unread}</span>` : ""}</button>`;
}
function renderNav() {
  $("#nav").innerHTML = TABS.map(([k, l]) => `<button class="${S.tab === k ? "on" : ""}" data-act="tab" data-tab="${k}" aria-label="${l}">${ICONS[k === "fuel" ? "fuel" : k]}<span>${l}</span></button>`).join("");
}
function renderMinibar() {
  const show = S.active && !(S.tab === "train");
  $("#minibar").innerHTML = show ? `<button class="mb" data-act="tab" data-tab="train"><span>${esc(S.active.name)} in progress</span><span class="num" id="mb-t">${fmtDur((Date.now() - new Date(S.active.started_at)) / 1000)}</span></button>` : "";
}

async function render() {
  if (!S.user) return renderAuth();
  renderTop(); renderNav(); renderMinibar();
  const v = $("#view");
  const token = (S.renderToken = (S.renderToken || 0) + 1);
  v.innerHTML = `<div class="sk"></div><div class="sk"></div>`;
  let html = "";
  try {
    html = await ({ home: homeView, train: trainView, fuel: fuelView, progress: progressView, me: meView })[S.tab]();
  } catch (e) { html = `<div class="empty"><b>Couldn't load this screen</b>Check your connection and try again.</div>`; }
  if (token !== S.renderToken) return;
  v.innerHTML = html;
  window.scrollTo(0, 0);
  if (S.tab === "progress") drawProgress();
}

/* ---------- HOME ---------- */
async function homeView() {
  const t = today();
  const [steps, meals, bws, wks, prs] = await Promise.all([
    sb.from("step_logs").select("steps").eq("logged_on", t).maybeSingle(),
    sb.from("meals").select("calories,protein_g").eq("logged_on", t),
    sb.from("body_weights").select("weight_kg,logged_on").order("logged_on", { ascending: false }).limit(2),
    sb.from("workouts").select("id,started_at").gte("started_at", weekStart()).not("ended_at", "is", null),
    sb.from("personal_records").select("kind,value,previous_value,achieved_at,exercises(name)").order("achieved_at", { ascending: false }).limit(5),
  ]);
  const st = steps.data?.steps || 0, goal = S.profile.step_goal;
  const cal = (meals.data || []).reduce((a, m) => a + m.calories, 0);
  const prot = (meals.data || []).reduce((a, m) => a + Number(m.protein_g), 0);
  const bw = bws.data || [];
  const delta = bw.length === 2 ? bw[0].weight_kg - bw[1].weight_kg : null;
  const name = S.profile.display_name ? esc(S.profile.display_name.split(" ")[0]) : "";
  const hr = new Date().getHours();
  return `<h1 class="page-title" style="margin:6px 0 16px">${hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening"}${name ? ", " + name : ""}</h1>
  <div class="card"><div class="row" style="gap:18px">
    ${ring(st / goal, st.toLocaleString(), `of ${goal.toLocaleString()}`)}
    <div class="grow"><h3 style="margin-bottom:8px">Steps today <button data-act="stepsSheet">Update</button></h3>
      <div class="muted small">${st >= goal ? "Goal smashed. 🔥" : `${(goal - st).toLocaleString()} to go`}</div>
      <div class="row" style="margin-top:12px;gap:8px"><button class="btn sm" data-act="addSteps" data-n="1000">+1,000</button><button class="btn sm" data-act="addSteps" data-n="5000">+5,000</button></div></div></div></div>
  <div class="grid2" style="margin-bottom:12px">
    <div class="card tap" data-act="tab" data-tab="fuel"><h3>Calories</h3><div class="big num">${cal.toLocaleString()}</div><div class="muted small" style="margin:6px 0 10px">of ${S.profile.calorie_goal.toLocaleString()} kcal</div><div class="bar"><i style="width:${Math.min(100, cal / S.profile.calorie_goal * 100)}%"></i></div></div>
    <div class="card tap" data-act="tab" data-tab="fuel"><h3>Protein</h3><div class="big num">${Math.round(prot)}<span class="muted" style="font-size:16px;font-weight:600"> g</span></div><div class="muted small" style="margin:6px 0 10px">of ${S.profile.protein_goal} g</div><div class="bar protein"><i style="width:${Math.min(100, prot / S.profile.protein_goal * 100)}%"></i></div></div>
  </div>
  <div class="grid2" style="margin-bottom:12px">
    <div class="card tap" data-act="weightSheet"><h3>Body weight</h3><div class="big num">${bw[0] ? toDisp(bw[0].weight_kg) : "—"}<span class="muted" style="font-size:16px;font-weight:600"> ${unit()}</span></div><div class="muted small" style="margin-top:6px">${delta == null ? "Tap to log" : `${delta > 0 ? "▲" : delta < 0 ? "▼" : "•"} ${Math.abs(toDisp(delta)).toFixed(1)} ${unit()} since last`}</div></div>
    <div class="card tap" data-act="tab" data-tab="train"><h3>This week</h3><div class="big num">${(wks.data || []).length}</div><div class="muted small" style="margin-top:6px">workout${(wks.data || []).length === 1 ? "" : "s"} done</div></div>
  </div>
  ${S.active ? "" : `<button class="btn primary block" data-act="startEmpty" style="margin-bottom:12px">Start workout</button>`}
  <div class="card"><h3>Recent records</h3>${(prs.data || []).length ? prs.data.map(prRow).join("") : `<div class="empty small"><b>No records yet</b>Beat a previous best and it will show up here.</div>`}</div>`;
}
function prRow(p) {
  const label = p.kind === "body_weight" ? "Body weight milestone" : p.exercises?.name || "Lift";
  const sub = p.kind === "lift_weight" ? "Heaviest weight" : p.kind === "lift_1rm" ? "Est. 1RM" : "Milestone";
  return `<div class="list-item"><div class="icon-bubble">🏆</div><div class="grow"><b>${esc(label)}</b><div class="muted small">${sub} · ${fmtDT(p.achieved_at)}</div></div><div class="num" style="font-weight:800">${wtxt(p.value)}</div></div>`;
}

/* ---------- TRAIN ---------- */
async function trainView() {
  if (S.active) return activeView();
  const [rts, wks] = await Promise.all([
    sb.from("routines").select("id,name,routine_exercises(id,position,target_sets,exercises(name))").order("created_at", { ascending: false }),
    sb.from("workouts").select("id,name,started_at,ended_at,sets(weight_kg,reps,completed,set_type)").not("ended_at", "is", null).order("started_at", { ascending: false }).limit(30),
  ]);
  const routines = rts.data || [], workouts = wks.data || [];
  return `<h1 class="page-title" style="margin:6px 0 16px">Train</h1>
  <button class="btn primary block" data-act="startEmpty">Start empty workout</button>
  <div style="height:20px"></div>
  <div class="card"><h3>Routines <button data-act="newRoutine">+ New</button></h3>
    ${routines.length ? routines.map((r) => {
      const exs = (r.routine_exercises || []).sort((a, b) => a.position - b.position);
      return `<div class="list-item"><div class="grow"><b>${esc(r.name)}</b><div class="muted small" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${exs.map((e) => esc(e.exercises?.name)).join(", ") || "No exercises"}</div></div>
      <button class="btn sm primary" data-act="startRoutine" data-id="${r.id}">Start</button><button class="icon-btn" data-act="delRoutine" data-id="${r.id}" aria-label="Delete routine">${ICONS.x}</button></div>`;
    }).join("") : `<div class="empty small"><b>No routines yet</b>Save your go-to sessions and start them in one tap.</div>`}</div>
  <div class="card"><h3>History</h3>
    ${workouts.length ? workouts.map((w) => {
      const done = (w.sets || []).filter((s) => s.completed && s.set_type !== "warmup");
      const vol = done.reduce((a, s) => a + (s.weight_kg || 0) * (s.reps || 0), 0);
      const dur = (new Date(w.ended_at) - new Date(w.started_at)) / 1000;
      return `<div class="list-item" data-act="workoutDetail" data-id="${w.id}" style="cursor:pointer"><div class="icon-bubble">🏋️</div><div class="grow"><b>${esc(w.name)}</b><div class="muted small">${fmtDT(w.started_at)} · ${fmtDur(dur)} · ${done.length} sets</div></div><div class="num muted small">${wtxt(Math.round(vol))}</div></div>`;
    }).join("") : `<div class="empty small"><b>Nothing logged yet</b>Your finished workouts appear here.</div>`}</div>`;
}

async function newWorkout(name = "Workout", routineId = null) {
  const w = await must(sb.from("workouts").insert({ user_id: S.user.id, name, routine_id: routineId }).select().single());
  S.active = { id: w.id, name: w.name, started_at: w.started_at, exs: [] };
  localStorage.setItem("lift.active", w.id);
  startTick();
  return w;
}

async function restoreActive() {
  const id = localStorage.getItem("lift.active");
  if (!id) return;
  const { data: w } = await sb.from("workouts").select("*").eq("id", id).is("ended_at", null).maybeSingle();
  if (!w) { localStorage.removeItem("lift.active"); return; }
  const { data: wes } = await sb.from("workout_exercises").select("*, sets(*)").eq("workout_id", id).order("position");
  S.active = { id: w.id, name: w.name, started_at: w.started_at, exs: [] };
  for (const we of wes || []) {
    const ex = S.exercises.find((e) => e.id === we.exercise_id); if (!ex) continue;
    const prev = await lastSets(ex.id, id);
    const sets = (we.sets || []).sort((a, b) => a.set_index - b.set_index).map((s) => ({ id: s.id, weight: s.weight_kg, reps: s.reps, type: s.set_type, done: true, pr: false }));
    S.active.exs.push({ weId: we.id, ex, rest: 90, sets, prev, sug: suggestNext(ex, prev) });
  }
  startTick();
}

async function lastSets(exId, excludeWorkoutId) {
  let q = sb.from("sets").select("workout_id,weight_kg,reps,set_index,created_at").eq("exercise_id", exId).eq("completed", true).neq("set_type", "warmup").order("created_at", { ascending: false }).limit(30);
  if (excludeWorkoutId) q = q.neq("workout_id", excludeWorkoutId);
  const { data } = await q;
  if (!data || !data.length) return [];
  const wid = data[0].workout_id;
  return data.filter((s) => s.workout_id === wid).sort((a, b) => a.set_index - b.set_index);
}

function suggestNext(ex, prev) {
  if (ex.kind !== "weight_reps" || !prev || !prev.length) return null;
  const top = Math.max(...prev.map((x) => x.weight_kg || 0));
  if (!top) return null;
  const atTop = prev.filter((x) => x.weight_kg === top && x.reps);
  if (!atTop.length) return null;
  const minReps = Math.min(...atTop.map((x) => x.reps));
  const lower = ["Quads", "Hamstrings", "Glutes"].includes(ex.muscle_group);
  const step = unit() === "lb" ? (lower ? 10 : 5) * KG_PER_LB : lower ? 5 : 2.5;
  if (minReps >= 10) return { weight: Math.round((top + step) * 100) / 100, reps: 8, why: "You hit 10+ reps on every set — go heavier." };
  return { weight: top, reps: minReps + 1, why: "Same weight, aim for one more rep." };
}
function sugBlock(e, ei) {
  const g = e.sug;
  if (!g || e.sets.every((x) => x.done)) return "";
  return `<div class="sug"><div class="grow"><b class="num">💡 Try ${toDisp(g.weight)} ${unit()} × ${g.reps}</b><div class="muted small">${g.why}</div></div><button class="btn sm" data-act="applySug" data-ei="${ei}">Apply</button></div>`;
}

async function addExerciseToActive(ex, nSets = 1, rest = 90) {
  const a = S.active;
  const we = await must(sb.from("workout_exercises").insert({ workout_id: a.id, user_id: S.user.id, exercise_id: ex.id, position: a.exs.length }).select().single());
  const prev = await lastSets(ex.id, a.id);
  const sets = Array.from({ length: nSets }, (_, i) => ({ id: null, weight: prev[i]?.weight_kg ?? prev[prev.length - 1]?.weight_kg ?? null, reps: prev[i]?.reps ?? prev[prev.length - 1]?.reps ?? null, type: "normal", done: false, pr: false }));
  a.exs.push({ weId: we.id, ex, rest, sets, prev, sug: suggestNext(ex, prev) });
}

function startTick() {
  clearInterval(S.tick);
  S.tick = setInterval(() => {
    if (!S.active) return;
    const el = $("#wk-dur"); const sec = (Date.now() - new Date(S.active.started_at)) / 1000;
    if (el) el.textContent = fmtDur(sec);
    const mb = $("#mb-t"); if (mb) mb.textContent = fmtDur(sec);
    const vol = $("#wk-vol"); if (vol) vol.textContent = wtxt(Math.round(activeVolume()));
    tickRest();
  }, 1000);
}
const activeVolume = () => S.active.exs.reduce((a, e) => a + e.sets.filter((s) => s.done && s.type !== "warmup").reduce((b, s) => b + (s.weight || 0) * (s.reps || 0), 0), 0);
const activeSets = () => S.active.exs.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);

function activeView() {
  const a = S.active;
  return `<div class="wk-head"><div class="grow"><input type="text" id="wk-name" value="${esc(a.name)}" aria-label="Workout name" style="font-size:20px;font-weight:800;background:transparent;border-color:transparent;padding:6px 0"></div>
    <button class="btn sm" data-act="plates" style="margin-inline-end:8px">Plates</button><button class="btn primary sm" data-act="finish">Finish</button></div>
  <div class="wk-stats"><div><b class="num" id="wk-dur">${fmtDur((Date.now() - new Date(a.started_at)) / 1000)}</b><span>Duration</span></div>
  <div><b class="num" id="wk-vol">${wtxt(Math.round(activeVolume()))}</b><span>Volume</span></div>
  <div><b class="num" id="wk-sets">${activeSets()}</b><span>Sets</span></div></div>
  ${a.exs.map(exCard).join("")}
  <button class="btn block" data-act="pickExercise" style="margin-top:4px">+ Add exercise</button>
  <button class="btn danger block" data-act="discard" style="margin-top:12px">Discard workout</button>`;
}

function exCard(e, ei) {
  const isTime = e.ex.kind === "duration";
  return `<div class="ex-card" data-ei="${ei}">
    <div class="ex-title"><b>${esc(e.ex.name)}</b><div class="row" style="gap:4px">${e.ex.equipment === "barbell" ? `<button type="button" class="chip blue" data-act="plates" data-ei="${ei}">Plates</button>` : ""}<span class="chip">${e.rest}s rest</span><button class="icon-btn" data-act="removeEx" data-ei="${ei}" aria-label="Remove exercise">${ICONS.x}</button></div></div>
    ${sugBlock(e, ei)}
    <div class="sets-head"><span>Set</span><span>Prev</span><span>${unit()}</span><span>${isTime ? "Sec" : "Reps"}</span><span></span></div>
    ${e.sets.map((s, si) => setRow(e, ei, s, si)).join("")}
    <button class="add-set" data-act="addSet" data-ei="${ei}">+ Add set</button></div>`;
}
function setRow(e, ei, s, si) {
  const p = e.prev[si];
  const label = s.type === "warmup" ? "W" : s.type === "drop" ? "D" : s.type === "failure" ? "F" : String(si + 1 - e.sets.slice(0, si).filter((x) => x.type === "warmup").length);
  return `<div class="set-row ${s.done ? "done" : ""}" data-ei="${ei}" data-si="${si}">
    <button class="idx ${s.type}" data-act="cycleType" data-ei="${ei}" data-si="${si}" aria-label="Set type">${label}</button>
    <div class="prev num">${p ? `${toDisp(p.weight_kg)}×${p.reps}` : "—"}</div>
    <input type="number" inputmode="decimal" step="any" data-f="weight" value="${s.weight != null ? toDisp(s.weight) : ""}" placeholder="0" aria-label="Weight">
    <input type="number" inputmode="numeric" data-f="reps" value="${s.reps ?? ""}" placeholder="0" aria-label="Reps">
    <button class="check" data-act="toggleSet" data-ei="${ei}" data-si="${si}" aria-label="Complete set">${ICONS.check}</button></div>${s.pr ? `<div class="pr-tag" style="padding:0 8px 6px">🏆 New personal record</div>` : ""}`;
}

async function toggleSet(ei, si) {
  const e = S.active.exs[ei], s = e.sets[si];
  if (!s.done) {
    if (s.reps == null || s.reps <= 0) { toastMsg("Enter the reps first"); return; }
    const row = await must(sb.from("sets").insert({ workout_exercise_id: e.weId, workout_id: S.active.id, user_id: S.user.id, exercise_id: e.ex.id, set_index: si, set_type: s.type, weight_kg: s.weight, reps: s.reps }).select().single());
    s.id = row.id; s.done = true;
    const { data: prs } = await sb.from("personal_records").select("id").eq("set_id", row.id).limit(1);
    s.pr = !!(prs && prs.length);
    startRest(e.rest);
  } else {
    if (s.id) await must(sb.from("sets").delete().eq("id", s.id));
    s.id = null; s.done = false; s.pr = false;
  }
  render();
}

/* rest timer */
function startRest(sec) { S.rest = { end: Date.now() + sec * 1000, total: sec }; drawRest(); }
function stopRest() { S.rest = null; $("#rest-root").innerHTML = ""; }
function drawRest() {
  if (!S.rest) return;
  $("#rest-root").innerHTML = `<div class="rest"><div class="t num" id="rest-t"></div><div class="bar"><i id="rest-b" style="width:100%"></i></div>
    <button class="btn sm" data-act="restAdj" data-n="-15">−15</button><button class="btn sm" data-act="restAdj" data-n="15">+15</button><button class="btn sm primary" data-act="restSkip">Skip</button></div>`;
  tickRest();
}
function tickRest() {
  if (!S.rest) return;
  const left = Math.ceil((S.rest.end - Date.now()) / 1000);
  if (left <= 0) { stopRest(); if (navigator.vibrate) navigator.vibrate([200, 80, 200]); toastMsg("Rest over — next set"); return; }
  const t = $("#rest-t"); if (t) t.textContent = fmtDur(left);
  const b = $("#rest-b"); if (b) b.style.width = Math.max(0, left / S.rest.total * 100) + "%";
}

/* exercise picker */
function exerciseList(selected = new Set(), multi = false) {
  const groups = [...new Set(S.exercises.map((e) => e.muscle_group))].sort();
  return `<input type="search" id="ex-q" placeholder="Search exercises" style="margin-bottom:10px">
  <div class="row" style="gap:6px;overflow-x:auto;padding-bottom:8px;margin-bottom:4px" id="ex-groups"><button type="button" class="chip on" data-g="">All</button>${groups.map((g) => `<button type="button" class="chip" data-g="${esc(g)}">${esc(g)}</button>`).join("")}</div>
  <div id="ex-list">${S.exercises.map((e) => `<label class="pick-row" data-name="${esc(e.name.toLowerCase())}" data-g="${esc(e.muscle_group)}">
    <input type="${multi ? "checkbox" : "radio"}" name="ex" value="${e.id}" ${selected.has(e.id) ? "checked" : ""}>
    <div class="grow"><b>${esc(e.name)}</b><div class="muted small">${esc(e.muscle_group)} · ${esc(e.equipment)}</div></div></label>`).join("")}</div>
  <button class="link" data-act="customExercise" style="margin:14px 0 4px">+ Create custom exercise</button>`;
}
function bindExerciseFilter(root) {
  let g = "";
  const apply = () => { const q = $("#ex-q", root).value.trim().toLowerCase(); $$("#ex-list .pick-row", root).forEach((r) => { r.style.display = (!q || r.dataset.name.includes(q)) && (!g || r.dataset.g === g) ? "" : "none"; }); };
  $("#ex-q", root).addEventListener("input", apply);
  $("#ex-groups", root).addEventListener("click", (ev) => { const b = ev.target.closest("[data-g]"); if (!b) return; g = b.dataset.g; $$("#ex-groups .chip", root).forEach((c) => c.classList.toggle("on", c === b)); apply(); });
}

/* plate calculator */
const PLATES = { kg: [25, 20, 15, 10, 5, 2.5, 1.25], lb: [45, 35, 25, 10, 5, 2.5] };
const BARS = { kg: [20, 15, 10], lb: [45, 35] };
function plateSheet(target) {
  const u = unit();
  openSheet("Plate calculator", `<form id="plate-form"><div class="two"><label class="field"><span>Target weight</span><input type="number" name="target" inputmode="decimal" step="any" value="${target || ""}" placeholder="${u}"></label>
  <label class="field"><span>Bar weight</span><select name="bar">${BARS[u].map((b) => `<option value="${b}">${b} ${u}</option>`).join("")}</select></label></div><div id="plate-out"></div></form>`);
  drawPlates();
}
function drawPlates() {
  const f = $("#plate-form"); if (!f) return;
  const out = $("#plate-out"), t = parseFloat(f.target.value), bar = parseFloat(f.bar.value), u = unit();
  if (!t) { out.innerHTML = `<div class="muted small">Enter a target weight.</div>`; return; }
  if (t < bar) { out.innerHTML = `<div class="msg err">Below bar weight</div>`; return; }
  let per = (t - bar) / 2; const used = [];
  for (const p of PLATES[u]) { const n = Math.floor((per + 1e-9) / p); if (n > 0) { used.push([p, n]); per -= n * p; } }
  const achieved = Math.round((bar + 2 * used.reduce((a, [p, n]) => a + p * n, 0)) * 100) / 100;
  const big = PLATES[u][0];
  const vis = used.flatMap(([p, n]) => Array(n).fill(p)).map((p) => `<i style="height:${28 + (p / big) * 54}px"></i>`).join("");
  out.innerHTML = `<div class="plates-vis"><span class="stub"></span>${vis}</div><div class="small muted" style="margin-bottom:4px">Plates per side</div>
  ${used.length ? used.map(([p, n]) => `<div class="list-item"><div class="grow"><b class="num">${p} ${u}</b></div><span class="num" style="font-weight:700">× ${n}</span></div>`).join("") : `<div class="muted">Bar only</div>`}
  ${Math.abs(achieved - t) > 0.01 ? `<div class="msg ok" style="margin-top:10px">Closest achievable: ${achieved} ${u}</div>` : ""}`;
}

/* barcode -> Open Food Facts */
function stopScan() {
  if (!S.scan) return;
  cancelAnimationFrame(S.scan.raf);
  if (S.scan.stream) S.scan.stream.getTracks().forEach((t) => t.stop());
  S.scan = null;
}
function barcodeSheet() {
  const can = "BarcodeDetector" in window && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  openSheet("Scan barcode", `${can ? `<video id="bc-video" playsinline muted style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:16px;background:#0c0c0f;margin-bottom:8px"></video><div class="muted small" style="margin-bottom:14px">Point the camera at a barcode</div>` : `<div class="muted small" style="margin-bottom:14px">Camera scanning isn't supported in this browser — enter the barcode number instead.</div>`}
  <form id="barcode-form"><label class="field"><span>Barcode number</span><input type="text" name="code" inputmode="numeric" pattern="[0-9]{8,14}" required></label><button class="btn primary block" type="submit">Look up</button></form>
  <div id="bc-status" class="muted small" style="margin-top:10px"></div>`);
  if (can) startScan();
}
async function startScan() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    const v = $("#bc-video");
    if (!v) { stream.getTracks().forEach((t) => t.stop()); return; }
    v.srcObject = stream; await v.play();
    const det = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
    S.scan = { stream, raf: 0 };
    const loop = async () => {
      if (!S.scan) return;
      try { const r = await det.detect(v); if (r.length) { const code = r[0].rawValue; stopScan(); return lookupBarcode(code); } } catch (_) {}
      if (S.scan) S.scan.raf = requestAnimationFrame(loop);
    };
    loop();
  } catch (_) { const st = $("#bc-status"); if (st) st.textContent = "Camera unavailable — enter the barcode number."; }
}
async function lookupBarcode(code) {
  const st = $("#bc-status"); if (st) st.textContent = "Looking up product…";
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,nutriments,serving_quantity`);
    const j = await r.json();
    if (j.status !== 1 || !j.product) { if (st) st.textContent = "Product not found. Enter it manually."; return; }
    const n = j.product.nutriments || {};
    const kcal = n["energy-kcal_100g"] ?? (n["energy_100g"] ? n["energy_100g"] / 4.184 : 0);
    S.food = { name: j.product.product_name || "Scanned food", per100: { kcal: +kcal || 0, p: +n.proteins_100g || 0, c: +n.carbohydrates_100g || 0, f: +n.fat_100g || 0 }, grams: Math.round(+j.product.serving_quantity) || 100 };
    mealSheet(S.food);
  } catch (_) { if (st) st.textContent = "Couldn't reach the food database."; }
}
function recalcFood() {
  const f = $("#meal-form"); if (!f || !S.food || !f.grams) return;
  const k = (parseFloat(f.grams.value) || 0) / 100, p = S.food.per100;
  f.calories.value = Math.round(p.kcal * k); f.protein_g.value = (p.p * k).toFixed(1); f.carbs_g.value = (p.c * k).toFixed(1); f.fat_g.value = (p.f * k).toFixed(1);
}

/* ---------- FUEL ---------- */
async function fuelView() {
  const d = S.mealDate;
  const { data } = await sb.from("meals").select("*").eq("logged_on", d).order("created_at");
  const meals = data || [];
  const sum = (k) => meals.reduce((a, m) => a + Number(m[k]), 0);
  const cal = sum("calories"), p = sum("protein_g"), c = sum("carbs_g"), f = sum("fat_g");
  const pr = S.profile;
  const macro = (label, v, goal, cls) => `<div style="margin-bottom:12px"><div class="row between small" style="margin-bottom:6px"><span class="muted">${label}</span><span class="num"><b>${Math.round(v)}</b>${goal ? ` / ${goal} g` : " g"}</span></div><div class="bar ${cls}"><i style="width:${goal ? Math.min(100, v / goal * 100) : Math.min(100, v)}%"></i></div></div>`;
  const types = ["breakfast", "lunch", "dinner", "snack"];
  return `<div class="row between" style="margin:6px 0 16px"><h1 class="page-title">Fuel</h1>
    <div class="row" style="gap:2px"><button class="icon-btn" data-act="mealDay" data-n="-1" aria-label="Previous day">‹</button><span class="small" style="min-width:92px;text-align:center;font-weight:600">${d === today() ? "Today" : fmtDate(d)}</span><button class="icon-btn" data-act="mealDay" data-n="1" aria-label="Next day">›</button></div></div>
  <div class="card"><div class="row" style="gap:18px">${ring(cal / pr.calorie_goal, cal.toLocaleString(), "kcal")}
    <div class="grow">${macro("Protein", p, pr.protein_goal, "protein")}${macro("Carbs", c, 0, "carbs")}${macro("Fat", f, 0, "fat")}</div></div>
    <div class="muted small" style="margin-top:4px">${cal <= pr.calorie_goal ? `${(pr.calorie_goal - cal).toLocaleString()} kcal left` : `${(cal - pr.calorie_goal).toLocaleString()} kcal over`}</div></div>
  <button class="btn primary block" data-act="addMeal" style="margin-bottom:14px">+ Log a meal</button>
  ${types.map((t) => { const ms = meals.filter((m) => m.meal_type === t); if (!ms.length) return ""; return `<div class="card"><h3>${t}<span class="num" style="text-transform:none;letter-spacing:0">${ms.reduce((a, m) => a + m.calories, 0)} kcal</span></h3>
    ${ms.map((m) => `<div class="list-item"><div class="grow"><b>${esc(m.name)}</b><div class="muted small num">P ${Math.round(m.protein_g)} · C ${Math.round(m.carbs_g)} · F ${Math.round(m.fat_g)}</div></div><div class="num" style="font-weight:700">${m.calories}</div><button class="icon-btn" data-act="delMeal" data-id="${m.id}" aria-label="Delete meal">${ICONS.x}</button></div>`).join("")}</div>`; }).join("")}
  ${meals.length ? "" : `<div class="empty"><b>Nothing logged</b>Log meals to see calories and macros against your goals.</div>`}`;
}

async function mealSheet(food) {
  const { data: recent } = await sb.from("meals").select("name,calories,protein_g,carbs_g,fat_g,meal_type").order("created_at", { ascending: false }).limit(40);
  const seen = new Set(), rec = [];
  for (const m of recent || []) { const k = m.name.toLowerCase(); if (!seen.has(k)) { seen.add(k); rec.push(m); } if (rec.length >= 8) break; }
  const hr = new Date().getHours(); const def = hr < 11 ? "breakfast" : hr < 15 ? "lunch" : hr < 21 ? "dinner" : "snack";
  const k = food ? food.grams / 100 : 0, fv = (v) => (food ? (Math.round(v * k * 10) / 10) : "");
  openSheet("Log a meal", `${food ? "" : `<button class="btn block" data-act="scanBarcode" style="margin-bottom:14px">Scan barcode</button>`}
  ${!food && rec.length ? `<div class="small muted" style="margin-bottom:8px">Quick add</div><div class="row" style="flex-wrap:wrap;gap:6px;margin-bottom:16px">${rec.map((m, i) => `<button class="chip blue" data-act="quickMeal" data-i="${i}">${esc(m.name)} · ${m.calories}</button>`).join("")}</div>` : ""}
  <form id="meal-form"><label class="field"><span>Meal name</span><input type="text" name="name" required placeholder="e.g. Chicken & rice" value="${food ? esc(food.name) : ""}"></label>
  <label class="field"><span>Type</span><select name="meal_type">${["breakfast", "lunch", "dinner", "snack"].map((t) => `<option value="${t}" ${t === def ? "selected" : ""}>${t[0].toUpperCase() + t.slice(1)}</option>`).join("")}</select></label>
  ${food ? `<label class="field"><span>Amount (g)</span><input type="number" name="grams" inputmode="decimal" step="any" min="1" value="${food.grams}"></label><div class="muted small" style="margin:-4px 0 12px">Values are per amount entered (source: Open Food Facts).</div>` : ""}
  <div class="two"><label class="field"><span>Calories</span><input type="number" inputmode="numeric" name="calories" min="0" required placeholder="kcal" value="${food ? Math.round(food.per100.kcal * k) : ""}"></label><label class="field"><span>Protein (g)</span><input type="number" inputmode="decimal" step="any" name="protein_g" min="0" placeholder="0" value="${fv(food && food.per100.p)}"></label></div>
  <div class="two"><label class="field"><span>Carbs (g)</span><input type="number" inputmode="decimal" step="any" name="carbs_g" min="0" placeholder="0" value="${fv(food && food.per100.c)}"></label><label class="field"><span>Fat (g)</span><input type="number" inputmode="decimal" step="any" name="fat_g" min="0" placeholder="0" value="${fv(food && food.per100.f)}"></label></div>
  <button class="btn primary block" type="submit">Add meal</button></form>`);
  S._recentMeals = rec;
}

/* ---------- PROGRESS ---------- */
async function progressView() {
  const t = S.progressTab;
  const seg = `<div class="seg">${[["lifts", "Lifts"], ["body", "Body"], ["records", "Records"]].map(([k, l]) => `<button class="${t === k ? "on" : ""}" data-act="progTab" data-k="${k}">${l}</button>`).join("")}</div>`;
  const head = `<h1 class="page-title" style="margin:6px 0 16px">Progress</h1>${seg}`;
  if (t === "lifts") {
    const { data: used } = await sb.from("sets").select("exercise_id").eq("completed", true).limit(1000);
    const ids = [...new Set((used || []).map((s) => s.exercise_id))];
    const list = S.exercises.filter((e) => ids.includes(e.id));
    if (!list.length) return head + `<div class="empty"><b>No lifts yet</b>Finish a workout and your strength trends show up here.</div>`;
    if (!S.progressEx || !ids.includes(S.progressEx)) S.progressEx = list[0].id;
    return head + `<label class="field"><select id="prog-ex">${list.map((e) => `<option value="${e.id}" ${e.id === S.progressEx ? "selected" : ""}>${esc(e.name)}</option>`).join("")}</select></label>
      <div id="prog-body"><div class="sk"></div></div>`;
  }
  if (t === "body") {
    const { data } = await sb.from("body_weights").select("*").order("logged_on");
    const rows = data || [];
    return head + `<div class="card"><h3>Body weight <button data-act="weightSheet">+ Log</button></h3>${lineChart(rows.map((r) => ({ y: toDisp(r.weight_kg), label: fmtDate(r.logged_on) })), { fmt: (v) => v.toFixed(1) })}</div>
    <div class="card"><h3>Log</h3>${rows.length ? rows.slice().reverse().slice(0, 20).map((r) => `<div class="list-item"><div class="grow">${fmtDate(r.logged_on)}</div><b class="num">${wtxt(r.weight_kg)}</b><button class="icon-btn" data-act="delWeight" data-id="${r.id}" aria-label="Delete entry">${ICONS.x}</button></div>`).join("") : `<div class="empty small"><b>No entries</b>Log your weight to track milestones.</div>`}</div>`;
  }
  const { data } = await sb.from("personal_records").select("kind,value,previous_value,achieved_at,exercises(name)").order("achieved_at", { ascending: false }).limit(60);
  return head + `<div class="card">${(data || []).length ? data.map(prRow).join("") : `<div class="empty small"><b>No records yet</b>Hit a new best on any lift or cross a body-weight milestone.</div>`}</div>`;
}

async function drawProgress() {
  if (S.progressTab !== "lifts") return;
  const sel = $("#prog-ex"); if (!sel) return;
  const body = $("#prog-body");
  const { data } = await sb.from("sets").select("weight_kg,reps,created_at,workout_id").eq("exercise_id", S.progressEx).eq("completed", true).neq("set_type", "warmup").order("created_at");
  const byW = new Map();
  for (const s of data || []) {
    if (!s.weight_kg || !s.reps) continue;
    const o = byW.get(s.workout_id) || { t: s.created_at, best: 0, e1: 0, vol: 0 };
    o.best = Math.max(o.best, s.weight_kg); o.e1 = Math.max(o.e1, epley(s.weight_kg, s.reps)); o.vol += s.weight_kg * s.reps; byW.set(s.workout_id, o);
  }
  const rows = [...byW.values()].sort((a, b) => a.t.localeCompare(b.t));
  const pts = (k) => rows.map((r) => ({ y: toDisp(r[k]), label: fmtDT(r.t) }));
  const bestAll = rows.length ? Math.max(...rows.map((r) => r.best)) : 0, e1All = rows.length ? Math.max(...rows.map((r) => r.e1)) : 0;
  body.innerHTML = `<div class="grid2" style="margin-bottom:12px"><div class="card"><h3>Heaviest</h3><div class="big num">${toDisp(bestAll)}<span class="muted" style="font-size:15px"> ${unit()}</span></div></div><div class="card"><h3>Est. 1RM</h3><div class="big num">${Math.round(toDisp(e1All))}<span class="muted" style="font-size:15px"> ${unit()}</span></div></div></div>
  <div class="card"><h3>Estimated 1RM</h3>${lineChart(pts("e1"), { fmt: (v) => Math.round(v) })}</div>
  <div class="card"><h3>Session volume</h3>${lineChart(pts("vol"), { fmt: (v) => Math.round(v) })}</div>`;
}

/* ---------- ME ---------- */
async function meView() {
  const p = S.profile;
  const perm = "Notification" in window ? Notification.permission : "unsupported";
  const unread = S.notifs.filter((n) => !n.read_at).length;
  return `<h1 class="page-title" style="margin:6px 0 16px">Me</h1>
  <div class="card"><h3>Profile</h3><form id="profile-form">
    <label class="field"><span>Name</span><input type="text" name="display_name" value="${esc(p.display_name)}"></label>
    <div class="two"><label class="field"><span>Units</span><select name="weight_unit"><option value="kg" ${p.weight_unit === "kg" ? "selected" : ""}>Kilograms</option><option value="lb" ${p.weight_unit === "lb" ? "selected" : ""}>Pounds</option></select></label>
    <label class="field"><span>Weight goal</span><select name="weight_goal">${[["lose", "Lose weight"], ["gain", "Gain weight"], ["maintain", "Maintain"]].map(([v, l]) => `<option value="${v}" ${p.weight_goal === v ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
    <div class="two"><label class="field"><span>Daily steps</span><input type="number" name="step_goal" min="1000" step="500" value="${p.step_goal}"></label><label class="field"><span>Calories</span><input type="number" name="calorie_goal" min="800" step="50" value="${p.calorie_goal}"></label></div>
    <div class="two"><label class="field"><span>Protein (g)</span><input type="number" name="protein_goal" min="20" value="${p.protein_goal}"></label><label class="field"><span>Goal weight (${unit()})</span><input type="number" name="goal_weight" step="any" value="${p.goal_weight_kg ? toDisp(p.goal_weight_kg) : ""}"></label></div>
    <button class="btn primary block" type="submit">Save changes</button></form></div>
  <div class="card"><h3>Record alerts</h3>
    <p class="muted small" style="margin:0 0 12px">Get notified the moment you set a new personal best on a lift, or pass a body-weight milestone (every 5 ${"kg"} toward your goal).</p>
    <label class="pick-row" style="border:0;padding-top:0"><input type="checkbox" id="push-toggle" ${p.push_enabled ? "checked" : ""}><div class="grow"><b>Phone alerts</b><div class="muted small">${perm === "granted" ? "Allowed on this device" : perm === "denied" ? "Blocked in browser settings" : perm === "unsupported" ? "Not supported in this browser" : "Permission needed"}</div></div></label>
    ${perm === "default" ? `<button class="btn block" data-act="askNotif">Allow notifications on this device</button>` : ""}
    <button class="btn ghost block" data-act="openNotifs" style="margin-top:10px">Notification history${unread ? ` · ${unread} new` : ""}</button></div>
  <div class="card"><h3>Language</h3><select id="lang-select" aria-label="Language"><option value="en" ${I18N.lang === "en" ? "selected" : ""}>English</option><option value="he" ${I18N.lang === "he" ? "selected" : ""}>עברית</option></select></div>
  <div class="card"><h3>Data</h3><button class="btn block" data-act="exportCsv">Export workouts (CSV)</button></div>
  <button class="btn danger block" data-act="signOut">Sign out</button>
  <p class="muted small" style="text-align:center;margin-top:16px">${esc(S.user.email)}</p>`;
}

/* ---------- sheets: steps / weight / notifications / routines ---------- */
async function stepsSheet() {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today(), i - 6));
  const { data } = await sb.from("step_logs").select("logged_on,steps").gte("logged_on", days[0]);
  const m = Object.fromEntries((data || []).map((r) => [r.logged_on, r.steps]));
  const goal = S.profile.step_goal, mx = Math.max(goal, ...Object.values(m), 1);
  const dn = (s) => new Date(s + "T12:00:00").toLocaleDateString(I18N.loc, { weekday: "narrow" });
  openSheet("Steps", `<div class="week" style="margin-bottom:18px">${days.map((d) => `<div class="d ${(m[d] || 0) >= goal ? "hit" : ""}"><i style="height:${Math.max(4, (m[d] || 0) / mx * 100)}%"></i><span>${dn(d)}</span></div>`).join("")}</div>
  <form id="steps-form"><label class="field"><span>Set today's total</span><input type="number" name="steps" inputmode="numeric" min="0" value="${m[today()] ?? ""}" placeholder="e.g. 8,500" required></label>
  <label class="field"><span>Date</span><input type="date" name="date" value="${today()}" max="${today()}"></label>
  <button class="btn primary block" type="submit">Save</button></form>
  <p class="muted small" style="margin-top:14px">Browsers can't read your phone's pedometer, so enter steps from your phone or watch. Automatic sync arrives with the native app.</p>`);
}
async function upsertSteps(date, n) {
  await must(sb.from("step_logs").upsert({ user_id: S.user.id, logged_on: date, steps: n, updated_at: new Date().toISOString() }, { onConflict: "user_id,logged_on" }));
}
function weightSheet() {
  openSheet("Log body weight", `<form id="weight-form"><div class="two"><label class="field"><span>Weight (${unit()})</span><input type="number" name="w" inputmode="decimal" step="any" min="0" required autofocus></label>
  <label class="field"><span>Date</span><input type="date" name="date" value="${today()}" max="${today()}"></label></div><button class="btn primary block" type="submit">Save</button></form>`);
}
async function notifsSheet() {
  const list = S.notifs;
  openSheet("Notifications", `${list.length ? `<button class="link small" data-act="markRead" style="margin-bottom:8px">Mark all as read</button>` : ""}
  ${list.length ? list.map((n) => `<div class="list-item notif-item ${n.read_at ? "" : "unread"}"><div class="icon-bubble">${n.type === "pr" ? "🏆" : "🔔"}</div><div class="grow"><b>${esc(n.title)}</b><div class="muted small">${esc(n.body || "")}</div><div class="muted small">${new Date(n.created_at).toLocaleString(I18N.loc, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div></div></div>`).join("") : `<div class="empty"><b>All quiet</b>Personal records and milestones will show up here.</div>`}`);
}
function routineSheet() {
  openSheet("New routine", `<form id="routine-form"><label class="field"><span>Name</span><input type="text" name="name" required placeholder="e.g. Push day"></label>
  <div class="small muted" style="margin-bottom:8px">Pick exercises</div>${exerciseList(new Set(), true)}
  <button class="btn primary block" type="submit" style="margin-top:12px">Save routine</button></form>`, { onOpen: bindExerciseFilter });
}
function customExerciseSheet(back) {
  openSheet("Custom exercise", `<form id="custom-ex-form" data-back="${back}"><label class="field"><span>Name</span><input type="text" name="name" required></label>
  <div class="two"><label class="field"><span>Muscle group</span><select name="muscle_group">${["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Quads", "Hamstrings", "Glutes", "Calves", "Core", "Cardio", "Traps"].map((g) => `<option>${g}</option>`).join("")}</select></label>
  <label class="field"><span>Equipment</span><select name="equipment">${["barbell", "dumbbell", "machine", "cable", "bodyweight", "other"].map((g) => `<option>${g}</option>`).join("")}</select></label></div>
  <button class="btn primary block" type="submit">Create</button></form>`);
}

/* ---------- actions ---------- */
const A = {
  closeSheet,
  authMode: (el) => renderAuth(el.dataset.mode),
  tab: (el) => { S.tab = el.dataset.tab; render(); },
  openNotifs: notifsSheet,
  markRead: async () => {
    const ids = S.notifs.filter((n) => !n.read_at).map((n) => n.id);
    if (ids.length) await must(sb.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids));
    S.notifs.forEach((n) => { n.read_at = n.read_at || new Date().toISOString(); });
    renderTop(); notifsSheet();
  },
  stepsSheet,
  addSteps: async (el) => {
    const { data } = await sb.from("step_logs").select("steps").eq("logged_on", today()).maybeSingle();
    await upsertSteps(today(), (data?.steps || 0) + Number(el.dataset.n)); render();
  },
  weightSheet,
  startEmpty: async () => { if (S.active) { S.tab = "train"; return render(); } await newWorkout("Workout"); S.tab = "train"; render(); },
  startRoutine: async (el) => {
    if (S.active) { toastMsg("Finish your current workout first"); S.tab = "train"; return render(); }
    const { data: r } = await sb.from("routines").select("id,name,routine_exercises(position,target_sets,rest_seconds,exercise_id)").eq("id", el.dataset.id).single();
    await newWorkout(r.name, r.id);
    for (const re of (r.routine_exercises || []).sort((a, b) => a.position - b.position)) {
      const ex = S.exercises.find((e) => e.id === re.exercise_id); if (ex) await addExerciseToActive(ex, re.target_sets, re.rest_seconds);
    }
    S.tab = "train"; render();
  },
  newRoutine: routineSheet,
  delRoutine: async (el) => { if (!ask("Delete this routine?")) return; await must(sb.from("routines").delete().eq("id", el.dataset.id)); render(); },
  workoutDetail: async (el) => {
    const { data: w } = await sb.from("workouts").select("id,name,started_at,ended_at,workout_exercises(position,exercises(name),sets(set_index,set_type,weight_kg,reps,completed))").eq("id", el.dataset.id).single();
    const exs = (w.workout_exercises || []).sort((a, b) => a.position - b.position);
    openSheet(w.name, `<div class="muted small" style="margin-bottom:12px">${fmtDT(w.started_at)} · ${fmtDur((new Date(w.ended_at) - new Date(w.started_at)) / 1000)}</div>
    ${exs.map((e) => `<div class="card"><h3 style="margin-bottom:8px">${esc(e.exercises?.name)}</h3>${(e.sets || []).filter((s) => s.completed).sort((a, b) => a.set_index - b.set_index).map((s, i) => `<div class="row between small" style="padding:4px 0"><span class="muted">${s.set_type === "warmup" ? "Warm-up" : "Set " + (i + 1)}</span><b class="num">${wtxt(s.weight_kg)} × ${s.reps}</b></div>`).join("")}</div>`).join("")}
    <button class="btn danger block" data-act="delWorkout" data-id="${w.id}">Delete workout</button>`);
  },
  delWorkout: async (el) => { if (!ask("Delete this workout and its records?")) return; await must(sb.from("workouts").delete().eq("id", el.dataset.id)); closeSheet(); render(); },
  pickExercise: () => openSheet("Add exercise", `<form id="pick-form">${exerciseList(new Set(), true)}<button class="btn primary block" type="submit" style="margin-top:12px">Add selected</button></form>`, { onOpen: bindExerciseFilter }),
  customExercise: (el) => customExerciseSheet(el.closest("#routine-form") ? "routine" : "pick"),
  removeEx: async (el) => {
    const ei = +el.dataset.ei, e = S.active.exs[ei];
    if (e.sets.some((s) => s.done) && !ask("Remove this exercise and its logged sets?")) return;
    await must(sb.from("workout_exercises").delete().eq("id", e.weId)); S.active.exs.splice(ei, 1); render();
  },
  addSet: (el) => { const e = S.active.exs[+el.dataset.ei]; const last = e.sets[e.sets.length - 1]; e.sets.push({ id: null, weight: last?.weight ?? null, reps: last?.reps ?? null, type: "normal", done: false, pr: false }); render(); },
  cycleType: async (el) => {
    const e = S.active.exs[+el.dataset.ei], s = e.sets[+el.dataset.si]; const order = ["normal", "warmup", "drop", "failure"];
    s.type = order[(order.indexOf(s.type) + 1) % order.length];
    if (s.done && s.id) await must(sb.from("sets").update({ set_type: s.type }).eq("id", s.id));
    render();
  },
  toggleSet: (el) => toggleSet(+el.dataset.ei, +el.dataset.si),
  restAdj: (el) => { if (S.rest) { S.rest.end += Number(el.dataset.n) * 1000; S.rest.total = Math.max(S.rest.total, Math.ceil((S.rest.end - Date.now()) / 1000)); tickRest(); } },
  restSkip: stopRest,
  finish: async () => {
    const a = S.active; if (!a) return;
    const n = activeSets();
    if (!n && !ask("No sets were completed. Finish anyway?")) return;
    const name = ($("#wk-name")?.value || a.name).trim() || "Workout";
    await must(sb.from("workouts").update({ name, ended_at: new Date().toISOString() }).eq("id", a.id));
    const vol = activeVolume(), prs = a.exs.reduce((x, e) => x + e.sets.filter((s) => s.pr).length, 0), dur = (Date.now() - new Date(a.started_at)) / 1000;
    S.active = null; localStorage.removeItem("lift.active"); clearInterval(S.tick); stopRest();
    if (S.tab === "train") { /* stay */ }
    openSheet("Workout complete 💪", `<div class="grid2" style="margin-bottom:14px"><div class="card"><h3>Time</h3><div class="big num">${fmtDur(dur)}</div></div><div class="card"><h3>Volume</h3><div class="big num">${Math.round(toDisp(vol)).toLocaleString()}<span class="muted" style="font-size:14px"> ${unit()}</span></div></div></div>
      <div class="grid2" style="margin-bottom:14px"><div class="card"><h3>Sets</h3><div class="big num">${n}</div></div><div class="card"><h3>Records</h3><div class="big num">${prs}</div></div></div>
      <button class="btn primary block" data-act="closeSheet">Done</button>`);
    render();
  },
  discard: async () => {
    if (!ask("Discard this workout? Logged sets will be deleted.")) return;
    await must(sb.from("workouts").delete().eq("id", S.active.id));
    S.active = null; localStorage.removeItem("lift.active"); clearInterval(S.tick); stopRest(); render();
  },
  mealDay: (el) => { const d = addDays(S.mealDate, Number(el.dataset.n)); if (d > today()) return; S.mealDate = d; render(); },
  addMeal: () => { S.food = null; mealSheet(); },
  scanBarcode: barcodeSheet,
  plates: (el) => {
    let w = null;
    if (el.dataset.ei != null && S.active) { const e = S.active.exs[+el.dataset.ei]; const st = e.sets.find((x) => !x.done) || e.sets[e.sets.length - 1]; w = st && st.weight ? toDisp(st.weight) : null; }
    plateSheet(w);
  },
  applySug: (el) => { const e = S.active.exs[+el.dataset.ei]; if (!e.sug) return; e.sets.forEach((x) => { if (!x.done && x.type === "normal") { x.weight = e.sug.weight; x.reps = e.sug.reps; } }); render(); },
  quickMeal: async (el) => {
    const m = S._recentMeals[+el.dataset.i];
    await must(sb.from("meals").insert({ user_id: S.user.id, logged_on: S.mealDate, meal_type: m.meal_type, name: m.name, calories: m.calories, protein_g: m.protein_g, carbs_g: m.carbs_g, fat_g: m.fat_g }));
    closeSheet(); toastMsg("Added " + m.name); render();
  },
  delMeal: async (el) => { await must(sb.from("meals").delete().eq("id", el.dataset.id)); render(); },
  progTab: (el) => { S.progressTab = el.dataset.k; render(); },
  delWeight: async (el) => { await must(sb.from("body_weights").delete().eq("id", el.dataset.id)); render(); },
  askNotif: async () => { const r = await Notification.requestPermission(); if (r === "granted") toastMsg("Alerts enabled"); render(); },
  exportCsv: async () => {
    const { data } = await sb.from("sets").select("created_at,weight_kg,reps,set_type,exercises(name),workouts(name)").eq("completed", true).order("created_at");
    const rows = [["date", "workout", "exercise", "set_type", "weight_kg", "reps"], ...(data || []).map((s) => [s.created_at, s.workouts?.name, s.exercises?.name, s.set_type, s.weight_kg, s.reps])];
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "lift-workouts.csv"; a.click();
  },
  signOut: async () => { await sb.auth.signOut(); },
};

document.addEventListener("click", async (ev) => {
  const el = ev.target.closest("[data-act]"); if (!el) return;
  const fn = A[el.dataset.act]; if (!fn) return;
  if (el.tagName === "BUTTON") ev.preventDefault();
  try { await fn(el, ev); } catch (e) { console.error(e); }
});

document.addEventListener("change", async (ev) => {
  const t = ev.target;
  const row = t.closest(".set-row");
  if (row && t.dataset.f && S.active) {
    const s = S.active.exs[+row.dataset.ei].sets[+row.dataset.si];
    if (t.dataset.f === "weight") s.weight = t.value === "" ? null : toKg(t.value);
    if (t.dataset.f === "reps") s.reps = t.value === "" ? null : parseInt(t.value, 10);
    if (s.done && s.id) await sb.from("sets").update({ weight_kg: s.weight, reps: s.reps }).eq("id", s.id);
    return;
  }
  if (t.id === "lang-select") { I18N.setLang(t.value); return; }
  if (t.id === "prog-ex") { S.progressEx = t.value; drawProgress(); }
  if (t.id === "wk-name" && S.active) { S.active.name = t.value.trim() || "Workout"; await sb.from("workouts").update({ name: S.active.name }).eq("id", S.active.id); }
  if (t.id === "push-toggle") {
    S.profile.push_enabled = t.checked;
    await sb.from("profiles").update({ push_enabled: t.checked }).eq("id", S.user.id);
    if (t.checked && "Notification" in window && Notification.permission === "default") A.askNotif();
  }
});

document.addEventListener("input", (ev) => {
  if (ev.target.closest && ev.target.closest("#plate-form")) drawPlates();
  if (ev.target.name === "grams") recalcFood();
});

document.addEventListener("submit", async (ev) => {
  const f = ev.target; ev.preventDefault();
  const fd = Object.fromEntries(new FormData(f).entries());
  try {
    if (f.id === "auth-form") {
      const btn = $("button[type=submit]", f); btn.disabled = true;
      if (f.dataset.mode === "up") {
        const { data, error } = await sb.auth.signUp({ email: fd.email, password: fd.password, options: { data: { display_name: fd.name || undefined } } });
        if (error) return renderAuth("up", error.message);
        if (!data.session) return renderAuth("in", "Check your email to confirm your account, then sign in.", true);
        return boot(data.session.user);
      }
      const { data, error } = await sb.auth.signInWithPassword({ email: fd.email, password: fd.password });
      if (error) return renderAuth("in", error.message);
      return boot(data.user);
    }
    if (f.id === "barcode-form") return lookupBarcode(fd.code.trim());
    if (f.id === "meal-form") {
      await must(sb.from("meals").insert({ user_id: S.user.id, logged_on: S.mealDate, meal_type: fd.meal_type, name: fd.name.trim(), calories: parseInt(fd.calories, 10) || 0, protein_g: parseFloat(fd.protein_g) || 0, carbs_g: parseFloat(fd.carbs_g) || 0, fat_g: parseFloat(fd.fat_g) || 0 }));
      S.food = null; closeSheet(); return render();
    }
    if (f.id === "steps-form") { await upsertSteps(fd.date || today(), parseInt(fd.steps, 10) || 0); closeSheet(); toastMsg("Steps saved"); return render(); }
    if (f.id === "weight-form") {
      const kg = toKg(fd.w); if (!kg) return;
      await must(sb.from("body_weights").upsert({ user_id: S.user.id, logged_on: fd.date || today(), weight_kg: kg }, { onConflict: "user_id,logged_on" }));
      closeSheet(); return render();
    }
    if (f.id === "profile-form") {
      const gw = fd.goal_weight ? toKg(fd.goal_weight) : null;
      const upd = { display_name: fd.display_name.trim() || null, weight_unit: fd.weight_unit, weight_goal: fd.weight_goal, step_goal: parseInt(fd.step_goal, 10) || 10000, calorie_goal: parseInt(fd.calorie_goal, 10) || 2400, protein_goal: parseInt(fd.protein_goal, 10) || 150, goal_weight_kg: gw };
      S.profile = await must(sb.from("profiles").update(upd).eq("id", S.user.id).select().single());
      toastMsg("Saved"); return render();
    }
    if (f.id === "routine-form") {
      const ids = $$("input[name=ex]:checked", f).map((i) => i.value);
      if (!ids.length) return toastMsg("Pick at least one exercise");
      const r = await must(sb.from("routines").insert({ user_id: S.user.id, name: fd.name.trim() }).select().single());
      await must(sb.from("routine_exercises").insert(ids.map((id, i) => ({ routine_id: r.id, user_id: S.user.id, exercise_id: id, position: i }))));
      closeSheet(); return render();
    }
    if (f.id === "pick-form") {
      const ids = $$("input[name=ex]:checked", f).map((i) => i.value);
      for (const id of ids) { const ex = S.exercises.find((e) => e.id === id); if (ex) await addExerciseToActive(ex); }
      closeSheet(); return render();
    }
    if (f.id === "custom-ex-form") {
      const ex = await must(sb.from("exercises").insert({ user_id: S.user.id, name: fd.name.trim(), muscle_group: fd.muscle_group, equipment: fd.equipment }).select().single());
      S.exercises.push(ex); S.exercises.sort((a, b) => a.name.localeCompare(b.name));
      toastMsg("Exercise created");
      return f.dataset.back === "routine" ? routineSheet() : A.pickExercise();
    }
  } catch (e) { console.error(e); }
});

init();
