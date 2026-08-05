// ==================================================================
// Keep Metrics - three view tiers (admin / manager / team).
// Each tier is a separately-encrypted payload; the security boundary
// is which key decrypts, not a client-side role flag. See README for
// the (honest) limits of client-side re-encryption on a static host.
// ==================================================================
const LEVELS = ["admin", "manager", "team"]; // richest first
const LEVEL_LABEL = { admin: "Admin (Doctor)", manager: "Manager", team: "Team" };
const LEVEL_BADGE = { admin: "badge-admin", manager: "badge-manager", team: "badge-team" };

let session = null; // { level, password, periods:{pk:data} }

// ---------- formatting ----------
const money = (v, parens = true) => {
  v = Number(v) || 0;
  const s = "$" + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? (parens ? `(${s})` : `-${s}`) : s;
};
const money0 = (v) => "$" + Math.round(Number(v) || 0).toLocaleString();
const pctStr = (v) => (v === null || v === undefined ? "&mdash;" : Math.round(v) + "%");

// on-time / rate color band
function rateClass(onTimePct) {
  if (onTimePct === null || onTimePct === undefined) return "rate-na";
  if (onTimePct >= 95) return "rate-good";
  if (onTimePct >= 85) return "rate-ok";
  return "rate-bad";
}

// ---------- fetch ----------
async function fetchJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error("missing " + path);
  return res.json();
}
async function fetchJSONOrNull(path) { try { return await fetchJSON(path); } catch (e) { return null; } }

// ---- local edits: a manager's "Save" persists here instantly (no keys, no
// download). Publishing to the live site for everyone else is the separate
// server/MIA step (see README). Keyed with a schema version so a stale edit
// from an older layout can't break rendering.
const OV = "km_v2";
const ovKey = (period, level) => `${OV}_${CLIENT}_${period}_${level}`;
function loadOverride(period, level) { try { const v = localStorage.getItem(ovKey(period, level)); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function saveOverride(period, level, data) { try { localStorage.setItem(ovKey(period, level), JSON.stringify(data)); } catch (e) {} }

async function attemptLogin(password) {
  const manifest = await fetchJSON(`data/manifest.json`);
  const periods = ((manifest.periods && manifest.periods[CLIENT]) || []).slice().sort();
  for (const level of LEVELS) {
    const decrypted = {};
    let any = false;
    for (const period of periods) {
      const envelope = await fetchJSONOrNull(`data/${CLIENT}/${period}/${level}-view.json.enc`);
      if (!envelope) continue;
      const data = await tryDecrypt(envelope, password);
      if (data) { decrypted[period] = loadOverride(period, level) || data; any = true; }
    }
    if (any) return { level, password, periods: decrypted };
  }
  return null;
}

// ---------- DOM helpers ----------
function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c === null || c === undefined) return;
    e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return e;
}
const T = (s) => document.createTextNode(s);

function statCard(label, value, color, sub) {
  return el("div", { class: "kpi", style: `border-top-color:${color}` }, [
    el("div", { class: "lbl" }, T(label)),
    el("div", { class: "val", style: `color:${color}`, html: value }),
    sub ? el("div", { class: "kpi-sub", html: sub }) : null,
  ]);
}

function rateChip(onTimePct, lateCount, daysWorked) {
  const cls = rateClass(onTimePct);
  const label = onTimePct === null ? "&mdash;" : `${onTimePct}% on-time`;
  return el("span", { class: `chip ${cls}`, html: label + (onTimePct !== null ? ` <span class="chip-sub">(${lateCount}/${daysWorked} late)</span>` : "") });
}

function table(headers, rows, alignRight = []) {
  const t = el("table");
  t.appendChild(el("thead", {}, el("tr", {}, headers.map((h, i) =>
    el("th", { style: alignRight.includes(i) ? "text-align:right" : "" }, T(h))))));
  const tb = el("tbody");
  rows.forEach(r => tb.appendChild(el("tr", {}, r.map((c, i) => {
    const cls = alignRight.includes(i) ? "num" : "";
    return (c && c.nodeType) ? el("td", { class: cls }, c) : el("td", { class: cls, html: String(c) });
  }))));
  t.appendChild(tb);
  return t;
}

function goalBar(label, actual, goal, fmt) {
  const p = goal ? Math.round(actual / goal * 100) : 0;
  const shown = Math.min(100, p);
  const color = p >= 100 ? "var(--green)" : p >= 75 ? "var(--steel)" : "var(--amber)";
  return el("div", { class: "goalbar" }, [
    el("div", { class: "goalbar-label" }, [
      el("span", {}, T(label)),
      el("span", { class: "goalbar-fig" }, T(`${fmt(actual)} / ${fmt(goal)} · ${p}%`)),
    ]),
    el("div", { class: "goalbar-track" }, el("div", { class: "goalbar-fill", style: `width:${shown}%;background:${color}` })),
  ]);
}

function sectionHead(txt) { return el("h2", {}, T(txt)); }
function brandRow() { return el("div", { class: "app-brand" }, el("img", { src: "assets/ask-logo-color.png", alt: "ASK System" })); }
function latest(periodsObj) { const k = Object.keys(periodsObj).sort(); return k[k.length - 1]; }

// ==================================================================
// FULL REPORT (admin + manager) - tabbed
// ==================================================================
function renderFull(container, periodsObj, level, password) {
  container.innerHTML = "";
  container.appendChild(brandRow());
  const pk = latest(periodsObj);
  const d = periodsObj[pk];

  const header = el("div", { class: "app-header" }, [
    el("h1", {}, T(d.client)),
    el("button", { class: "logout", onclick: () => location.reload() }, T("Log out")),
  ]);
  container.appendChild(header);
  container.appendChild(el("span", { class: `badge ${LEVEL_BADGE[level]}` }, T(LEVEL_LABEL[level])));
  container.appendChild(el("p", { class: "subline" }, T(`${d.period} · Prepared ${d.prepared}`)));

  // Data entry is public links (not gated) - shown here so admin/manager can share them.
  if (level === "admin" || level === "manager") {
    container.appendChild(el("p", { class: "entry-links" }, [
      T("Data entry links to share — "),
      el("a", { href: "enter.html", target: "_blank" }, T("Monthly Numbers")),
      T(" · "),
      el("a", { href: "feedback.html", target: "_blank" }, T("Team Check-In")),
    ]));
  }

  const tabs = ["Financial", "Team Health", "Days Off"];
  if (level === "admin") tabs.push("Settings");
  const renderers = {
    "Financial": renderFinancial, "Team Health": renderTeamHealthTab,
    "Days Off": renderDaysOff, "Settings": renderSettings,
  };
  const tabBar = el("div", { class: "tabbar" });
  const content = el("div", { class: "tabcontent" });
  container.append(tabBar, content);
  function select(name) {
    [...tabBar.children].forEach(b => b.classList.toggle("active", b.dataset.tab === name));
    content.innerHTML = "";
    renderers[name](content, periodsObj, pk);
  }
  tabs.forEach(name => tabBar.appendChild(el("button", { class: "tabbtn", "data-tab": name, onclick: () => select(name) }, T(name))));
  select("Financial");
}

function renderFinancial(content, periodsObj, pk) {
  const d = periodsObj[pk];
  const patientAged = d.patientAging.d31_60 + d.patientAging.d61_90 + d.patientAging.over90;
  const insAged = ["d31_60", "d61_90", "over90"].reduce((a, k) => a + d.insuranceAging.primary[k] + d.insuranceAging.secondary[k], 0);
  const collRate = d.performance.current.production ? d.performance.current.collections / d.performance.current.production * 100 : 0;
  const prodChange = d.performance.prior.production ? (d.performance.current.production - d.performance.prior.production) / d.performance.prior.production * 100 : null;

  content.appendChild(el("div", { class: "kpis" }, [
    statCard("Production", money0(d.performance.current.production), "var(--steel)", prodChange === null ? "" : `${prodChange >= 0 ? "▲" : "▼"} ${Math.abs(prodChange).toFixed(1)}% vs prior`),
    statCard("Collections", money0(d.performance.current.collections), "var(--green)", ""),
    statCard("Collection Rate", pctStr(collRate), "var(--navy)", "MTD"),
    statCard("Actionable A/R", money0(patientAged + insAged), "var(--red)", "31+ days, patient + insurance"),
  ]));

  content.appendChild(sectionHead("Practice Performance"));
  content.appendChild(table(
    ["Metric", "This Period", "Prior Period", "YTD"],
    [
      ["Gross Production", money(d.performance.current.production, false), money(d.performance.prior.production, false), money(d.performance.ytd.production, false)],
      ["Net Collections", money(d.performance.current.collections, false), money(d.performance.prior.collections, false), money(d.performance.ytd.collections, false)],
      ["Ending A/R Balance", money(d.performance.current.arBalance), "&mdash;", "&mdash;"],
    ], [1, 2, 3]));

  content.appendChild(sectionHead("Provider Productivity"));
  content.appendChild(el("div", { class: "chart-box" }, el("canvas", { id: "provChart" })));
  content.appendChild(table(
    ["Name", "Role", "Production", "Adjustments", "Collections", "Coll. Rate"],
    d.providers.map(p => [p.name, p.role, money(p.production, false), money(p.adjustments, false), money(p.collections, false), p.collRate + "%"]),
    [2, 3, 4, 5]));

  content.appendChild(sectionHead("New Patients & Add-On Services"));
  content.appendChild(el("p", { class: "inline-stat" }, [el("b", {}, T(String(d.newPatients.actual))), T(" new patients this period")]));
  content.appendChild(table(["Add-On Service", "Production"], d.addOnServices.map(a => [a.name, money(a.production, false)]), [1]));

  content.appendChild(sectionHead("Accounts Receivable Health"));
  content.appendChild(el("p", { class: "sub-label" }, T("Patient / Guarantor Aging")));
  content.appendChild(table(
    ["Current (0-30)", "31-60", "61-90", "Over 90", "Est. Ins. Owed", "Guarantor Portion"],
    [[money(d.patientAging.current), money(d.patientAging.d31_60, false), money(d.patientAging.d61_90, false), money(d.patientAging.over90, false), money(d.patientAging.insEst, false), money(d.patientAging.guarPortion)]],
    [0, 1, 2, 3, 4, 5]));
  content.appendChild(el("p", { class: "muted" }, T(`Real aged patient debt (31+ days): ${money(patientAged, false)}. Aged insurance claims (31+ days): ${money(insAged, false)}.`)));
  content.appendChild(el("p", { class: "sub-label" }, T("Largest Aged Insurance Claims")));
  content.appendChild(table(["Patient", "Payer", "Bucket", "Amount"], d.agedClaims.map(c => [c.patient, c.payer, c.bucket, money(c.amount, false)]), [3]));

  content.appendChild(sectionHead("Labor & Staffing"));
  content.appendChild(table(["Department", "Staff", "Hours", "Notes"], d.labor.map(l => [l.dept, l.staffCount, l.hours, l.notes || ""]), [1, 2]));

  new Chart(document.getElementById("provChart"), {
    type: "bar",
    data: {
      labels: d.providers.map(p => p.name),
      datasets: [
        { label: "Production", data: d.providers.map(p => p.production), backgroundColor: "#3D5A80" },
        { label: "Collections", data: d.providers.map(p => p.collections), backgroundColor: "#1E7145" },
      ],
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } },
  });
}

// ---------------- TEAM HEALTH (was Tardiness) ----------------
function renderTeamHealthTab(content, periodsObj, pk) {
  const d = periodsObj[pk];
  const th = d.teamHealth;
  const pol = th.policy;
  const emps = th.employees.slice().sort((a, b) => {
    // Key Leaders grouped first, then worst on-time first, non-standard last
    if (!!a.isLeader !== !!b.isLeader) return a.isLeader ? -1 : 1;
    if (a.nonStandardSchedule !== b.nonStandardSchedule) return a.nonStandardSchedule ? 1 : -1;
    return (a.onTimePct ?? 999) - (b.onTimePct ?? 999);
  });
  const flagged = emps.filter(e => !e.nonStandardSchedule && (e.lateCount > 0 || e.lunchOverageCount > 0)).length;
  const perfect = emps.filter(e => !e.nonStandardSchedule && e.lateCount === 0 && e.lunchOverageCount === 0).length;
  const leaders = emps.filter(e => e.isLeader && !e.nonStandardSchedule);
  const lw = leaders.reduce((a, e) => a + e.daysWorked, 0);
  const ll = leaders.reduce((a, e) => a + e.lateCount, 0);
  const leaderOT = lw ? Math.round((lw - ll) / lw * 100) : null;

  content.appendChild(el("div", { class: "kpis" }, [
    statCard("Team On-Time Rate", th.onTimeRatePct + "%", "var(--navy)", "standard-schedule staff"),
    leaderOT != null ? statCard("Key Leaders On-Time", leaderOT + "%", leaderOT >= 95 ? "var(--green)" : "var(--red)", "examined separately") : null,
    statCard("Perfect Attendance", String(perfect), "var(--green)", "0 late, 0 lunch overage"),
    statCard("Staff With Flags", String(flagged), flagged ? "var(--amber)" : "var(--green)", "late or long-lunch this period"),
  ].filter(Boolean)));

  content.appendChild(el("p", { class: "muted" }, T(
    "Admin & manager only - the team screen sees on-time rate by department, never individual names. " +
    "This is the team-health half of Keep Metrics (financial health is the other) - tracked monthly, it trends into a per-person performance picture."
  )));

  content.appendChild(sectionHead("Attendance Policy (set in Settings)"));
  content.appendChild(table(
    ["Scheduled Start", "Late After", "Lunch Window", "Lunch Max", "On-Time Goal", "Non-Standard"],
    [[pol.scheduledStart, pol.lateAfter, pol.lunchWindow, pol.lunchMaxMinutes + " min", "95%", pol.nonStandardEmployees.join(", ") || "&mdash;"]]));

  content.appendChild(sectionHead("Per-Employee Scorecard"));
  content.appendChild(el("p", { class: "muted" }, T("Key Leaders (Dr. Mitchell, Dr. Yassa, Leny A, Sammie R) are examined separately. The two doctors are production-based and don't punch a clock, so attendance covers Leny and Sammie.")));
  content.appendChild(table(
    ["Employee", "Group", "Days", "On-Time", "Late", "Lunch Overages", "Worst Late"],
    emps.map(e => {
      const worst = e.lateDays.length ? e.lateDays.reduce((a, b) => b.deltaMin > a.deltaMin ? b : a) : null;
      const groupCell = e.isLeader ? el("span", { class: "chip", style: "background:var(--navy)" }, T("Key Leader")) : e.dept;
      return [
        e.employee, groupCell, e.daysWorked,
        e.nonStandardSchedule ? el("span", { class: "chip rate-na" }, T("non-standard")) : rateChip(e.onTimePct, e.lateCount, e.daysWorked),
        e.nonStandardSchedule ? "&mdash;" : e.lateCount,
        e.lunchOverageCount,
        worst ? `${worst.time} · ${worst.date} (+${worst.deltaMin}m)` : "&mdash;",
      ];
    }),
    [2, 4, 5]));

  if (th.note) content.appendChild(el("p", { class: "callout" }, [el("b", {}, T("Pattern: ")), T(th.note)]));

  const lateRows = [];
  emps.forEach(e => e.lateDays.forEach(l => lateRows.push([e.employee, l.date, l.time, `+${l.deltaMin} min`])));
  if (lateRows.length) {
    content.appendChild(sectionHead(`Every Late Arrival (after ${pol.lateAfter})`));
    content.appendChild(table(["Employee", "Date", "Arrival", "Minutes Late"], lateRows, [3]));
  }
  const lunchRows = [];
  emps.forEach(e => e.lunchOverages.forEach(l => lunchRows.push([e.employee, l.date, `${l.outTime} → ${l.inTime}`, `${l.minutes} min`])));
  if (lunchRows.length) {
    content.appendChild(sectionHead(`Lunch Overages (over ${pol.lunchMaxMinutes} min)`));
    content.appendChild(table(["Employee", "Date", "Out → In", "Duration"], lunchRows, [3]));
  }
}

// ---------------- DAYS OFF (no inactive section) ----------------
function renderDaysOff(content, periodsObj, pk) {
  const d = periodsObj[pk];
  content.appendChild(el("p", { class: "muted" }, T("Admin & manager only - not shown on the team screen.")));
  content.appendChild(sectionHead("Vacation Taken"));
  content.appendChild(table(["Employee", "Dept", "Dates", "Days", "Hours"],
    d.daysOff.vacation.map(v => [v.employee, v.dept, v.dates, v.days, v.hours.toFixed(1)]), [4]));
  content.appendChild(sectionHead("No-Punch Gaps (Active Employees)"));
  content.appendChild(table(["Employee", "Dept", "No-Punch Days", "Note"],
    d.daysOff.noPunchGaps.map(g => [g.employee, g.dept, g.gapDays + "/" + d.daysOff.businessDays, g.note || ""]), [2]));
}

// ---------------- SETTINGS (admin only) ----------------
async function renderSettings(content, periodsObj, pk) {
  content.appendChild(el("p", { class: "muted" }, T(
    "Admin only. Goals and baselines are the standing targets the team screen measures against - not encrypted " +
    "(a target/policy value discloses no actual performance). Managers enter the month's numbers; admin sets these."
  )));
  const goals = (await fetchJSONOrNull(`data/${CLIENT}/${pk}/goals.json`)) || { collectionsGoal: 0, departmentGoals: {}, addOnGoal: 0, newPatientsGoal: 0, onTimeGoalPct: 95, tardinessPolicy: {} };
  if (!goals.tardinessPolicy) goals.tardinessPolicy = {};
  const d = periodsObj[pk];
  [...new Set(d.providers.map(p => p.role === "Dentist" ? "Dentists" : "Hygienists"))].forEach(dep => { if (!(dep in goals.departmentGoals)) goals.departmentGoals[dep] = 0; });

  const form = el("div", { class: "entry-form" });
  const numF = (label, get, setv) => { const i = el("input", { type: "number", step: "0.01", value: get() }); i.addEventListener("input", () => setv(parseFloat(i.value) || 0)); form.appendChild(el("div", { class: "field-row" }, [el("label", {}, T(label)), i])); };
  const txtF = (label, get, setv) => { const i = el("input", { type: "text", value: get() }); i.addEventListener("input", () => setv(i.value)); form.appendChild(el("div", { class: "field-row" }, [el("label", {}, T(label)), i])); };

  form.appendChild(sectionHead("Financial Goals"));
  numF("Collections Goal", () => goals.collectionsGoal, v => goals.collectionsGoal = v);
  Object.keys(goals.departmentGoals).forEach(dep => numF(`${dep} Goal`, () => goals.departmentGoals[dep], v => goals.departmentGoals[dep] = v));
  numF("Add-On Services Goal", () => goals.addOnGoal, v => goals.addOnGoal = v);
  numF("New Patients Goal", () => goals.newPatientsGoal, v => goals.newPatientsGoal = v);

  form.appendChild(sectionHead("Team Health Baseline"));
  const pol = goals.tardinessPolicy;
  numF("On-Time Goal (%)", () => goals.onTimeGoalPct ?? 95, v => goals.onTimeGoalPct = v);
  txtF("Scheduled Start (e.g. 7:50 AM)", () => pol.scheduledStart || "", v => pol.scheduledStart = v);
  txtF("Not Late Until (e.g. 8:10 AM)", () => pol.lateAfter || "", v => pol.lateAfter = v);
  txtF("Lunch Window (e.g. 1:00 PM - 2:00 PM)", () => pol.lunchWindow || "", v => pol.lunchWindow = v);
  numF("Lunch Max (minutes)", () => pol.lunchMaxMinutes ?? 60, v => pol.lunchMaxMinutes = v);
  txtF("Non-Standard-Schedule Employees (comma-separated)", () => (pol.nonStandardEmployees || []).join(", "), v => pol.nonStandardEmployees = v.split(",").map(s => s.trim()).filter(Boolean));

  form.appendChild(el("button", { class: "primary-btn", onclick: () => downloadJSON(goals, "goals.json") }, T("Download goals.json")));
  content.appendChild(form);
}

// ==================================================================
// TEAM VIEW - goal vs actual + team-health scorecard. Simple, positive.
// ==================================================================
async function renderTeam(container, periodsObj) {
  container.innerHTML = "";
  container.appendChild(brandRow());
  const pk = latest(periodsObj);
  const d = periodsObj[pk];
  const goals = (await fetchJSONOrNull(`data/${CLIENT}/${pk}/goals.json`)) || {};

  const header = el("div", { class: "app-header" }, [el("h1", {}, T(d.client)),
    el("button", { class: "logout", onclick: () => location.reload() }, T("Log out"))]);
  container.appendChild(header);
  container.appendChild(el("span", { class: "badge badge-team" }, T("Team Performance")));
  container.appendChild(el("p", { class: "subline" }, T(`${d.period} · Prepared ${d.prepared}`)));

  // headline scorecard - the "two things": financial + team health
  container.appendChild(el("div", { class: "kpis" }, [
    statCard("Collections", money0(d.kpis.collections), "var(--green)", `${d.kpis.collectionRatePct}% collection rate`),
    statCard("Production", money0(d.kpis.production), "var(--steel)", ""),
    statCard("New Patients", String(d.newPatients.actual), "var(--navy)", goals.newPatientsGoal ? `goal ${goals.newPatientsGoal}` : ""),
    statCard("Team On-Time", (d.teamHealth.onTimeRatePct ?? "—") + "%", d.teamHealth.onTimeRatePct >= (goals.onTimeGoalPct || 95) ? "var(--green)" : "var(--amber)", `goal ${goals.onTimeGoalPct || 95}%`),
  ]));

  container.appendChild(sectionHead("Goal vs. Actual — Financial"));
  const gs = el("div", { class: "section" });
  gs.appendChild(goalBar("Collections", d.kpis.collections, goals.collectionsGoal, v => money0(v)));
  d.byDepartment.forEach(dep => gs.appendChild(goalBar(dep.dept, dep.production, (goals.departmentGoals || {})[dep.dept] || 0, v => money0(v))));
  gs.appendChild(goalBar("Add-On Services", d.addOnProduction || 0, goals.addOnGoal, v => money0(v)));
  gs.appendChild(goalBar("New Patients", d.newPatients.actual, goals.newPatientsGoal, v => Math.round(v)));
  container.appendChild(gs);

  container.appendChild(sectionHead("Team Health — On-Time by Department"));
  const th = d.teamHealth.byDepartment || {};
  container.appendChild(table(["Department", "On-Time Rate"],
    Object.entries(th).map(([dept, pct]) => [dept, el("span", { class: `chip ${rateClass(pct)}`, html: (pct ?? "—") + "%" })])));
  container.appendChild(el("p", { class: "muted" }, T("On-time rate by department only - individual attendance stays private to leadership.")));

  container.appendChild(sectionHead("Staffing Hours"));
  container.appendChild(table(["Department", "Staff", "Hours"], d.labor.map(l => [l.dept, l.staffCount, l.hours]), [1, 2]));

  container.appendChild(sectionHead("Time Off This Period"));
  container.appendChild(el("p", {}, T(`Company holiday: ${d.attendance.holidayDate}. Vacation days taken: ${d.attendance.vacationDaysTaken}.`)));
}

// ---------------- GATE ----------------
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("gateForm");
  const input = document.getElementById("gatePassword");
  const errorEl = document.getElementById("gateError");
  const gate = document.getElementById("gate");
  const app = document.getElementById("app");

  const infoModal = document.getElementById("infoModal");
  document.getElementById("infoClose").addEventListener("click", () => infoModal.classList.remove("visible"));
  infoModal.addEventListener("click", (ev) => { if (ev.target === infoModal) infoModal.classList.remove("visible"); });

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    errorEl.textContent = "";
    form.querySelector("button").disabled = true;
    try {
      const result = await attemptLogin(input.value);
      if (!result) { errorEl.textContent = "Incorrect password."; form.querySelector("button").disabled = false; return; }
      session = result;
      gate.style.display = "none";
      app.classList.add("visible");
      if (result.level === "team") renderTeam(app, result.periods);
      else renderFull(app, result.periods, result.level, result.password);
    } catch (e) { errorEl.textContent = "Could not load report data."; form.querySelector("button").disabled = false; }
  });
});
