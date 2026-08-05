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

  const tabs = ["Financial", "Team Health", "Days Off", "Entry / Upload"];
  if (level === "admin") tabs.push("Settings");
  const renderers = {
    "Financial": renderFinancial, "Team Health": renderTeamHealthTab,
    "Days Off": renderDaysOff, "Entry / Upload": (c, p, k) => renderEntry(c, p, k, level, password),
    "Settings": renderSettings,
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
    // worst on-time first, non-standard last
    if (a.nonStandardSchedule !== b.nonStandardSchedule) return a.nonStandardSchedule ? 1 : -1;
    return (a.onTimePct ?? 999) - (b.onTimePct ?? 999);
  });
  const flagged = emps.filter(e => !e.nonStandardSchedule && (e.lateCount > 0 || e.lunchOverageCount > 0)).length;
  const perfect = emps.filter(e => !e.nonStandardSchedule && e.lateCount === 0 && e.lunchOverageCount === 0).length;

  content.appendChild(el("div", { class: "kpis" }, [
    statCard("Team On-Time Rate", th.onTimeRatePct + "%", "var(--navy)", "standard-schedule staff"),
    statCard("Perfect Attendance", String(perfect), "var(--green)", "0 late, 0 lunch overage"),
    statCard("Staff With Flags", String(flagged), flagged ? "var(--amber)" : "var(--green)", "late or long-lunch this period"),
  ]));

  content.appendChild(el("p", { class: "muted" }, T(
    "Admin & manager only - the team screen sees on-time rate by department, never individual names. " +
    "This is the team-health half of Keep Metrics (financial health is the other) - tracked monthly, it trends into a per-person performance picture."
  )));

  content.appendChild(sectionHead("Attendance Policy (set in Settings)"));
  content.appendChild(table(
    ["Scheduled Start", "Late After", "Lunch Window", "Lunch Max", "On-Time Goal", "Non-Standard"],
    [[pol.scheduledStart, pol.lateAfter, pol.lunchWindow, pol.lunchMaxMinutes + " min", "95%", pol.nonStandardEmployees.join(", ") || "&mdash;"]]));

  content.appendChild(sectionHead("Per-Employee Scorecard"));
  content.appendChild(table(
    ["Employee", "Dept", "Days", "On-Time", "Late", "Lunch Overages", "Worst Late"],
    emps.map(e => {
      const worst = e.lateDays.length ? e.lateDays.reduce((a, b) => b.deltaMin > a.deltaMin ? b : a) : null;
      return [
        e.employee, e.dept, e.daysWorked,
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

// ---------------- ENTRY WIZARD (admin + manager) ----------------
function renderEntry(content, periodsObj, pk, level, password) {
  const d = JSON.parse(JSON.stringify(periodsObj[pk]));
  const set = (path, val) => { const p = path.split("."); let c = d; for (let i = 0; i < p.length - 1; i++) c = c[p[i]]; c[p[p.length - 1]] = val; };
  const numField = (label, path, val) => {
    const i = el("input", { type: "number", step: "0.01", value: val });
    i.addEventListener("input", () => set(path, parseFloat(i.value) || 0));
    return el("div", { class: "field-row" }, [el("label", {}, T(label)), i]);
  };
  const grid = (fields) => el("div", { class: "field-grid" }, fields);

  // ---- step bodies ----
  const stepPerformance = (body) => {
    body.appendChild(el("p", { class: "wiz-hint" }, [
      el("button", { class: "info-icon", type: "button", title: "Which Dentrix reports", onclick: () => document.getElementById("infoModal").classList.add("visible") }, T("i")),
      el("span", {}, T("From the Provider A/R Totals report — the TOTAL row and its Prev. Month / YTD columns.")),
    ]));
    body.appendChild(grid([
      numField("Gross Production", "performance.current.production", d.performance.current.production),
      numField("Net Collections", "performance.current.collections", d.performance.current.collections),
      numField("Production Adjustments (+)", "performance.current.prodAdj", d.performance.current.prodAdj),
      numField("Ending A/R Balance", "performance.current.arBalance", d.performance.current.arBalance),
      numField("Prior Period Production", "performance.prior.production", d.performance.prior.production),
      numField("Prior Period Collections", "performance.prior.collections", d.performance.prior.collections),
      numField("YTD Production", "performance.ytd.production", d.performance.ytd.production),
      numField("YTD Collections", "performance.ytd.collections", d.performance.ytd.collections),
    ]));
  };
  const stepAging = (body) => {
    body.appendChild(el("p", { class: "wiz-hint" }, T("Patient totals from the Aging Report; claim totals from the Insurance Claim Aging Report.")));
    body.appendChild(el("div", { class: "sub-label" }, T("Patient / Guarantor Aging")));
    body.appendChild(grid([
      numField("Current (0-30)", "patientAging.current", d.patientAging.current),
      numField("31-60 Days", "patientAging.d31_60", d.patientAging.d31_60),
      numField("61-90 Days", "patientAging.d61_90", d.patientAging.d61_90),
      numField("Over 90 Days", "patientAging.over90", d.patientAging.over90),
      numField("Est. Insurance Owed", "patientAging.insEst", d.patientAging.insEst),
      numField("Guarantor Portion", "patientAging.guarPortion", d.patientAging.guarPortion),
    ]));
    body.appendChild(el("div", { class: "sub-label" }, T("Insurance Claims Aging")));
    body.appendChild(grid([
      numField("Primary — Current", "insuranceAging.primary.current", d.insuranceAging.primary.current),
      numField("Secondary — Current", "insuranceAging.secondary.current", d.insuranceAging.secondary.current),
      numField("Primary — 31-60", "insuranceAging.primary.d31_60", d.insuranceAging.primary.d31_60),
      numField("Secondary — 31-60", "insuranceAging.secondary.d31_60", d.insuranceAging.secondary.d31_60),
      numField("Primary — 61-90", "insuranceAging.primary.d61_90", d.insuranceAging.primary.d61_90),
      numField("Secondary — 61-90", "insuranceAging.secondary.d61_90", d.insuranceAging.secondary.d61_90),
      numField("Primary — Over 90", "insuranceAging.primary.over90", d.insuranceAging.primary.over90),
      numField("Secondary — Over 90", "insuranceAging.secondary.over90", d.insuranceAging.secondary.over90),
    ]));
  };
  const stepPatients = (body) => {
    body.appendChild(el("p", { class: "wiz-hint" }, T("New-patient count and production for any add-on services tracked separately.")));
    body.appendChild(grid([numField("New Patients This Period", "newPatients.actual", d.newPatients.actual)]));
    body.appendChild(el("div", { class: "sub-label" }, T("Add-On Services")));
    const box = el("div", {});
    const rr = () => {
      box.innerHTML = "";
      d.addOnServices.forEach((a, idx) => {
        const n = el("input", { value: a.name, placeholder: "Service name" });
        n.addEventListener("input", () => d.addOnServices[idx].name = n.value);
        const p = el("input", { type: "number", step: "0.01", value: a.production, placeholder: "Production" });
        p.addEventListener("input", () => d.addOnServices[idx].production = parseFloat(p.value) || 0);
        box.appendChild(el("div", { class: "provider-row", style: "margin-bottom:8px" }, [n, p,
          el("button", { class: "rm-btn", onclick: () => { d.addOnServices.splice(idx, 1); rr(); } }, T("×"))]));
      });
    };
    rr();
    body.append(box, el("button", { class: "add-btn", onclick: () => { d.addOnServices.push({ name: "", production: 0 }); rr(); } }, T("+ Add service")));
  };
  const stepProviders = (body) => {
    const dz = el("label", { class: "dropzone" }, [
      el("div", { class: "dz-title" }, T("Upload provider CSV")),
      el("div", { class: "dz-sub" }, T("columns: provider_name, provider_role, gross_production, adjustments, net_collections")),
    ]);
    const csv = el("input", { type: "file", accept: ".csv", style: "display:none" });
    dz.appendChild(csv);
    const box = el("div", {});
    const rr = () => {
      box.innerHTML = "";
      box.appendChild(el("div", { class: "provider-head" }, ["Name", "Role", "Production", "Adjustments", "Collections", ""].map(h => el("span", {}, T(h)))));
      d.providers.forEach((p, idx) => {
        const mk = (k, ph, isNum) => { const i = el("input", isNum ? { type: "number", step: "0.01", value: p[k] } : { value: p[k], placeholder: ph }); i.addEventListener("input", () => d.providers[idx][k] = isNum ? (parseFloat(i.value) || 0) : i.value); return i; };
        box.appendChild(el("div", { class: "provider-row", style: "margin-bottom:8px" }, [
          mk("name", "Name"), mk("role", "Role"), mk("production", "", true), mk("adjustments", "", true), mk("collections", "", true),
          el("button", { class: "rm-btn", onclick: () => { d.providers.splice(idx, 1); rr(); } }, T("×"))]));
      });
    };
    csv.addEventListener("change", (ev) => handleCSV(ev, d, rr));
    rr();
    body.append(dz, box, el("button", { class: "add-btn", onclick: () => { d.providers.push({ name: "", role: "", production: 0, adjustments: 0, collections: 0, collRate: 0 }); rr(); } }, T("+ Add provider")));
  };
  const stepReview = (body) => {
    d.providers.forEach(p => p.collRate = p.production ? Math.round(p.collections / p.production * 100) : 0);
    const collRate = d.performance.current.production ? Math.round(d.performance.current.collections / d.performance.current.production * 100) : 0;
    body.appendChild(el("p", { class: "wiz-hint" }, T("Quick check before saving. Save updates the report immediately.")));
    body.appendChild(el("div", { class: "review-grid" }, [
      ["Production", money0(d.performance.current.production)],
      ["Collections", money0(d.performance.current.collections)],
      ["Collection Rate", collRate + "%"],
      ["New Patients", String(d.newPatients.actual)],
      ["Add-On Production", money0(d.addOnServices.reduce((a, x) => a + x.production, 0))],
      ["Providers", String(d.providers.length)],
    ].map(([k, v]) => el("div", { class: "review-cell" }, [el("div", { class: "rc-label" }, T(k)), el("div", { class: "rc-val" }, T(v))]))));
    const status = el("div", { class: "save-status" });
    const saveBtn = el("button", { class: "primary-btn" }, T("Save Numbers"));
    saveBtn.addEventListener("click", () => {
      try {
        const built = buildPayloads(d);
        LEVELS.forEach(lv => saveOverride(pk, lv, built[lv]));
        session.periods[pk] = built[level];
        downloadJSON({ client: d.client, period: d.period, saved: true, numbers: stripToNumbers(d) }, `${CLIENT}-${pk}-numbers.json`);
        status.style.color = "var(--green)";
        status.innerHTML = "✓ Saved. The report now shows these numbers. A numbers file also downloaded for publishing (see README data-path).";
      } catch (e) { status.style.color = "var(--red)"; status.textContent = "Save failed: " + e.message; }
    });
    body.append(saveBtn, status);
  };

  const steps = [
    { title: "Performance", body: stepPerformance },
    { title: "A/R Aging", body: stepAging },
    { title: "Patients & Add-Ons", body: stepPatients },
    { title: "Providers", body: stepProviders },
    { title: "Review & Save", body: stepReview },
  ];
  let cur = 0;

  const wizard = el("div", { class: "wizard" });
  const stepsBar = el("div", { class: "wiz-steps" });
  const bodyWrap = el("div", { class: "entry-form wiz-body" });
  const nav = el("div", { class: "wiz-nav" });
  content.append(wizard);
  wizard.append(stepsBar, bodyWrap, nav);

  function draw() {
    stepsBar.innerHTML = "";
    steps.forEach((s, i) => {
      const cls = "wiz-step" + (i === cur ? " active" : "") + (i < cur ? " done" : "");
      const chip = el("div", { class: cls, onclick: () => { if (i <= cur) { cur = i; draw(); } } }, [
        el("span", { class: "wiz-num" }, T(i < cur ? "✓" : String(i + 1))),
        el("span", { class: "wiz-title" }, T(s.title)),
      ]);
      stepsBar.appendChild(chip);
    });
    bodyWrap.innerHTML = "";
    bodyWrap.appendChild(el("h2", {}, T(steps[cur].title)));
    steps[cur].body(bodyWrap);
    nav.innerHTML = "";
    nav.appendChild(cur > 0 ? el("button", { class: "ghost-btn", onclick: () => { cur--; draw(); } }, T("← Back")) : el("span", {}));
    nav.appendChild(cur < steps.length - 1 ? el("button", { class: "primary-btn", style: "margin-top:0", onclick: () => { cur++; draw(); } }, T("Next →")) : el("span", {}));
  }
  draw();
}

function stripToNumbers(d) {
  return {
    performance: d.performance, patientAging: d.patientAging, insuranceAging: d.insuranceAging,
    newPatients: d.newPatients, addOnServices: d.addOnServices, providers: d.providers,
  };
}

// derive admin/manager/team payloads from an edited full-report object
function buildPayloads(d) {
  const admin = JSON.parse(JSON.stringify(d)); admin.role = "admin"; admin.canEditGoals = true;
  const manager = JSON.parse(JSON.stringify(d)); manager.role = "manager"; manager.canEditGoals = false;
  const deptT = {};
  d.providers.forEach(p => { const k = p.role === "Dentist" ? "Dentists" : "Hygienists"; (deptT[k] = deptT[k] || { production: 0, collections: 0 }); deptT[k].production += p.production; deptT[k].collections += p.collections; });
  const std = d.teamHealth.employees.filter(e => !e.nonStandardSchedule);
  const otDays = std.reduce((a, e) => a + (e.daysWorked - e.lateCount), 0);
  const totDays = std.reduce((a, e) => a + e.daysWorked, 0);
  const deptOT = {};
  std.forEach(e => { const b = deptOT[e.dept] = deptOT[e.dept] || { w: 0, l: 0 }; b.w += e.daysWorked; b.l += e.lateCount; });
  const team = {
    role: "team", client: d.client, period: d.period, prepared: d.prepared,
    kpis: { production: d.performance.current.production, collections: d.performance.current.collections, collectionRatePct: d.performance.current.production ? Math.round(d.performance.current.collections / d.performance.current.production * 100) : 0 },
    byDepartment: Object.entries(deptT).map(([dept, v]) => ({ dept, production: Math.round(v.production * 100) / 100, collections: Math.round(v.collections * 100) / 100 })),
    teamHealth: { onTimeRatePct: totDays ? Math.round(otDays / totDays * 100) : null, byDepartment: Object.fromEntries(Object.entries(deptOT).map(([k, b]) => [k, b.w ? Math.round((b.w - b.l) / b.w * 100) : null])) },
    attendance: { vacationDaysTaken: d.daysOff.vacation.reduce((a, v) => a + (typeof v.days === "number" ? v.days : 1), 0), holidayDate: d.daysOff.holidayDate },
    labor: d.labor.map(l => ({ dept: l.dept, staffCount: l.staffCount, hours: l.hours })),
    newPatients: { actual: d.newPatients.actual },
    addOnProduction: Math.round(d.addOnServices.reduce((a, x) => a + x.production, 0) * 100) / 100,
  };
  return { admin, manager, team };
}

function handleCSV(ev, d, cb) {
  const f = ev.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    const lines = r.result.split(/\r?\n/).filter(l => l.trim());
    const hdr = lines[0].split(",").map(h => h.trim());
    d.providers = lines.slice(1).map(line => {
      const c = line.split(","); const rec = {}; hdr.forEach((h, i) => rec[h] = (c[i] || "").trim());
      const production = parseFloat(rec.gross_production || 0), collections = parseFloat(rec.net_collections || 0);
      return { name: rec.provider_name || "", role: rec.provider_role || "", production, adjustments: parseFloat(rec.adjustments || 0), collections, collRate: production ? Math.round(collections / production * 100) : 0 };
    });
    cb();
  };
  r.readAsText(f);
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
