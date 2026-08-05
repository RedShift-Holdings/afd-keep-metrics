const money = (v, parens = true) => {
  v = Number(v) || 0;
  const s = "$" + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? (parens ? `(${s})` : `-${s}`) : s;
};
const pct = (v) => (v === null || v === undefined ? "&mdash;" : Number(v).toFixed(0) + "%");

let session = null; // { level, password, periods: {periodKey: dataObject} }

async function fetchJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error("missing " + path);
  return res.json();
}
async function fetchJSONOrNull(path) {
  try { return await fetchJSON(path); } catch (e) { return null; }
}

async function attemptLogin(password) {
  const manifest = await fetchJSON(`data/manifest.json`);
  const periods = (manifest.periods && manifest.periods[CLIENT]) || [];
  periods.sort();

  for (const level of ["owner", "team"]) {
    const decrypted = {};
    let any = false;
    for (const period of periods) {
      try {
        const envelope = await fetchJSON(`data/${CLIENT}/${period}/${level}-view.json.enc`);
        const data = await tryDecrypt(envelope, password);
        if (data) { decrypted[period] = data; any = true; }
      } catch (e) { /* file missing for this period at this level - skip */ }
    }
    if (any) return { level, password, periods: decrypted };
  }
  return null;
}

function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach(c => c && e.appendChild(c));
  return e;
}

function kpiCard(label, value, color) {
  return el("div", { class: "kpi", style: `background:${color}` }, [
    el("div", { class: "lbl" }, document.createTextNode(label)),
    el("div", { class: "val", html: value }),
  ]);
}

function table(headers, rows, alignRight = []) {
  const t = el("table");
  const thead = el("tr", {}, headers.map((h, i) => el("th", { style: alignRight.includes(i) ? "text-align:right" : "" }, document.createTextNode(h))));
  t.appendChild(el("thead", {}, thead));
  const tbody = el("tbody");
  rows.forEach(r => {
    tbody.appendChild(el("tr", {}, r.map((c, i) => el("td", { class: alignRight.includes(i) ? "num" : "", html: String(c) }))));
  });
  t.appendChild(tbody);
  return t;
}

function latestPeriod(periodsObj) {
  const keys = Object.keys(periodsObj).sort();
  return keys[keys.length - 1];
}

function goalBar(label, actual, goal, formatFn) {
  const pctOf = goal ? Math.min(100, Math.round(actual / goal * 100)) : 0;
  const color = pctOf >= 100 ? "var(--green)" : pctOf >= 75 ? "var(--steel)" : "var(--amber)";
  const wrap = el("div", { class: "goalbar" });
  wrap.appendChild(el("div", { class: "goalbar-label" }, document.createTextNode(
    `${label} — ${formatFn(actual)} of ${formatFn(goal)} goal (${pctOf}%)`
  )));
  const track = el("div", { class: "goalbar-track" });
  track.appendChild(el("div", { class: "goalbar-fill", style: `width:${pctOf}%;background:${color}` }));
  wrap.appendChild(track);
  return wrap;
}

function brandRow() {
  return el("div", { class: "app-brand" }, el("img", { src: "assets/ask-logo-color.png", alt: "ASK System" }));
}

// ==================================================================
// OWNER VIEW — tabbed: Financial / Tardiness / Days Off / Entry / Settings
// ==================================================================
const OWNER_TABS = ["Financial", "Tardiness", "Days Off", "Entry / Upload", "Settings"];

function renderOwner(container, periodsObj, password) {
  container.innerHTML = "";
  container.appendChild(brandRow());

  const pk = latestPeriod(periodsObj);
  const d = periodsObj[pk];

  const header = el("div", { class: "app-header" }, [
    el("h1", {}, document.createTextNode(d.client)),
    el("button", { class: "logout", onclick: () => location.reload() }, document.createTextNode("Log out")),
  ]);
  container.appendChild(header);
  container.appendChild(el("span", { class: "badge owner" }, document.createTextNode("Owner / Full Report")));
  container.appendChild(el("p", { class: "subline" }, document.createTextNode(`${d.period} · Prepared ${d.prepared}`)));

  const tabBar = el("div", { class: "tabbar" });
  const content = el("div", { class: "tabcontent" });
  container.appendChild(tabBar);
  container.appendChild(content);

  const renderers = {
    "Financial": renderFinancialTab,
    "Tardiness": renderTardinessTab,
    "Days Off": renderDaysOffTab,
    "Entry / Upload": renderEntryTab,
    "Settings": renderSettingsTab,
  };

  function selectTab(name) {
    [...tabBar.children].forEach(b => b.classList.toggle("active", b.dataset.tab === name));
    content.innerHTML = "";
    renderers[name](content, periodsObj, pk, password);
  }

  OWNER_TABS.forEach((name, i) => {
    const btn = el("button", { class: "tabbtn", "data-tab": name, onclick: () => selectTab(name) }, document.createTextNode(name));
    tabBar.appendChild(btn);
  });
  selectTab(OWNER_TABS[0]);
}

function renderFinancialTab(content, periodsObj, pk) {
  const d = periodsObj[pk];
  const patientAged = d.patientAging.d31_60 + d.patientAging.d61_90 + d.patientAging.over90;
  const insAged = (d.insuranceAging.primary.d31_60 + d.insuranceAging.primary.d61_90 + d.insuranceAging.primary.over90)
                + (d.insuranceAging.secondary.d31_60 + d.insuranceAging.secondary.d61_90 + d.insuranceAging.secondary.over90);
  const collRate = d.performance.current.production ? (d.performance.current.collections / d.performance.current.production * 100) : 0;

  content.appendChild(el("div", { class: "kpis" }, [
    kpiCard("Production", money(d.performance.current.production, false), "var(--steel)"),
    kpiCard("Collections", money(d.performance.current.collections, false), "var(--green)"),
    kpiCard("Collection Rate", pct(collRate), "var(--navy)"),
    kpiCard("Actionable AR (31+ days)", money(patientAged + insAged, false), "var(--red)"),
  ]));

  const perfSection = el("div", { class: "section" });
  perfSection.appendChild(el("h2", {}, document.createTextNode("Practice Performance")));
  perfSection.appendChild(table(
    ["Metric", "This Period", "Prior Period", "YTD"],
    [
      ["Gross Production", money(d.performance.current.production, false), money(d.performance.prior.production, false), money(d.performance.ytd.production, false)],
      ["Net Collections", money(d.performance.current.collections, false), money(d.performance.prior.collections, false), money(d.performance.ytd.collections, false)],
      ["Ending A/R Balance", money(d.performance.current.arBalance), "&mdash;", "&mdash;"],
    ], [1, 2, 3]
  ));
  content.appendChild(perfSection);

  const provSection = el("div", { class: "section" });
  provSection.appendChild(el("h2", {}, document.createTextNode("Provider Productivity")));
  provSection.appendChild(el("div", { class: "chart-box" }, el("canvas", { id: "providerChart" })));
  provSection.appendChild(table(
    ["Name", "Role", "Production", "Adjustments", "Collections", "Coll. Rate"],
    d.providers.map(p => [p.name, p.role, money(p.production, false), money(p.adjustments, false), money(p.collections, false), p.collRate + "%"]),
    [2, 3, 4, 5]
  ));
  content.appendChild(provSection);

  const newPatSection = el("div", { class: "section" });
  newPatSection.appendChild(el("h2", {}, document.createTextNode("New Patients & Add-On Services")));
  newPatSection.appendChild(el("p", {}, document.createTextNode(`New patients this period: ${d.newPatients.actual}`)));
  newPatSection.appendChild(table(
    ["Add-On Service", "Production"],
    d.addOnServices.map(a => [a.name, money(a.production, false)]),
    [1]
  ));
  content.appendChild(newPatSection);

  const arSection = el("div", { class: "section" });
  arSection.appendChild(el("h2", {}, document.createTextNode("Accounts Receivable Health")));
  arSection.appendChild(el("p", {}, document.createTextNode("Patient/Guarantor Aging")));
  arSection.appendChild(table(
    ["Current (0-30)", "31-60", "61-90", "Over 90", "Est. Ins. Owed", "Guarantor Portion"],
    [[money(d.patientAging.current), money(d.patientAging.d31_60, false), money(d.patientAging.d61_90, false),
      money(d.patientAging.over90, false), money(d.patientAging.insEst, false), money(d.patientAging.guarPortion)]],
    [0, 1, 2, 3, 4, 5]
  ));
  arSection.appendChild(el("p", { class: "muted" }, document.createTextNode(
    `Real aged patient debt (31+ days): ${money(patientAged, false)}. Aged insurance claims (31+ days): ${money(insAged, false)}.`
  )));
  arSection.appendChild(el("h2", {}, document.createTextNode("Largest Aged Insurance Claims")));
  arSection.appendChild(table(
    ["Patient", "Payer", "Bucket", "Amount"],
    d.agedClaims.map(c => [c.patient, c.payer, c.bucket, money(c.amount, false)]),
    [3]
  ));
  content.appendChild(arSection);

  const laborSection = el("div", { class: "section" });
  laborSection.appendChild(el("h2", {}, document.createTextNode("Labor & Staffing")));
  laborSection.appendChild(table(
    ["Department", "Staff", "Hours", "Notes"],
    d.labor.map(l => [l.dept, l.staffCount, l.hours, l.notes || ""]),
    [1, 2]
  ));
  content.appendChild(laborSection);

  new Chart(document.getElementById("providerChart"), {
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

function renderTardinessTab(content, periodsObj, pk) {
  const d = periodsObj[pk];
  content.appendChild(el("p", { class: "muted" }, document.createTextNode(
    "Admin only - not shown on the team view. " + d.tardiness.methodology
  )));
  const refRows = Object.entries(d.tardiness.deptMedianArrival).map(([dept, t]) => [dept, t]);
  content.appendChild(el("h2", {}, document.createTextNode("Department Reference — Typical First Arrival")));
  content.appendChild(table(["Department", "Median First Arrival"], refRows, [1]));

  content.appendChild(el("h2", {}, document.createTextNode("Per-Employee Summary")));
  content.appendChild(table(
    ["Employee", "Dept", "Days Worked", "Median Arrival", "Late Instances", "Worst Instance"],
    d.tardiness.employees.map(e => {
      const worst = e.lateDays[0];
      return [e.employee, e.dept, e.daysWorked, e.medianArrival, e.lateDays.length,
        worst ? `${worst.time} on ${worst.date} (+${worst.deltaMin}m)` : "&mdash;"];
    }),
    [2, 4]
  ));

  const detailRows = [];
  d.tardiness.employees.forEach(e => e.lateDays.forEach(ld =>
    detailRows.push([e.employee, ld.date, ld.time, `+${ld.deltaMin} min`])
  ));
  if (detailRows.length) {
    content.appendChild(el("h2", {}, document.createTextNode("Every Flagged Late Arrival")));
    content.appendChild(table(["Employee", "Date", "Arrival", "Minutes Late"], detailRows, [2, 3]));
  }
}

function renderDaysOffTab(content, periodsObj, pk) {
  const d = periodsObj[pk];
  content.appendChild(el("p", { class: "muted" }, document.createTextNode("Admin only - not shown on the team view.")));
  content.appendChild(el("h2", {}, document.createTextNode("Vacation Taken")));
  content.appendChild(table(
    ["Employee", "Dept", "Dates", "Days", "Hours"],
    d.daysOff.vacation.map(v => [v.employee, v.dept, v.dates, v.days, v.hours.toFixed(1)]),
    [4]
  ));
  content.appendChild(el("h2", {}, document.createTextNode("No-Punch Gaps")));
  content.appendChild(table(
    ["Employee", "Dept", "No-Punch Days", "Note"],
    d.daysOff.noPunchGaps.map(g => [g.employee, g.dept, g.gapDays + "/" + d.daysOff.businessDays, g.note || ""]),
    [2]
  ));
}

// ---------------- ENTRY / UPLOAD ----------------
function renderEntryTab(content, periodsObj, pk, password) {
  const d = JSON.parse(JSON.stringify(periodsObj[pk])); // working copy

  const introRow = el("div", { style: "display:flex;align-items:center;gap:8px;margin-bottom:4px;" });
  const infoIcon = el("button", { class: "info-icon", type: "button", title: "Instructions", "aria-label": "Instructions" }, document.createTextNode("i"));
  infoIcon.addEventListener("click", () => document.getElementById("infoModal").classList.add("visible"));
  introRow.appendChild(infoIcon);
  introRow.appendChild(el("span", { class: "muted" }, document.createTextNode(
    "Covers the numbers off Dentrix report totals. Tardiness and days-off come separately, straight from the " +
    "doctor - this form edits and re-publishes " + d.period + ". Click the info icon for the report checklist."
  )));
  content.appendChild(introRow);

  const form = el("div", { class: "entry-form" });

  function numField(label, path, value) {
    const input = el("input", { type: "number", step: "0.01", value: value });
    input.addEventListener("input", () => setPath(d, path, parseFloat(input.value) || 0));
    return el("div", { class: "field-row" }, [el("label", {}, document.createTextNode(label)), input]);
  }
  function setPath(obj, path, val) {
    const parts = path.split(".");
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
    cur[parts[parts.length - 1]] = val;
  }

  form.appendChild(el("h2", {}, document.createTextNode("Practice Performance")));
  form.appendChild(numField("Gross Production", "performance.current.production", d.performance.current.production));
  form.appendChild(numField("Production Adjustments (+)", "performance.current.prodAdj", d.performance.current.prodAdj));
  form.appendChild(numField("Net Collections", "performance.current.collections", d.performance.current.collections));
  form.appendChild(numField("Ending A/R Balance", "performance.current.arBalance", d.performance.current.arBalance));
  form.appendChild(numField("Prior Period Production", "performance.prior.production", d.performance.prior.production));
  form.appendChild(numField("Prior Period Collections", "performance.prior.collections", d.performance.prior.collections));
  form.appendChild(numField("YTD Production", "performance.ytd.production", d.performance.ytd.production));
  form.appendChild(numField("YTD Collections", "performance.ytd.collections", d.performance.ytd.collections));

  form.appendChild(el("h2", {}, document.createTextNode("New Patients")));
  form.appendChild(numField("New Patients This Period", "newPatients.actual", d.newPatients.actual));

  form.appendChild(el("h2", {}, document.createTextNode("Patient/Guarantor Aging — from Dentrix Aging Report")));
  form.appendChild(numField("Current (0-30)", "patientAging.current", d.patientAging.current));
  form.appendChild(numField("31-60 Days", "patientAging.d31_60", d.patientAging.d31_60));
  form.appendChild(numField("61-90 Days", "patientAging.d61_90", d.patientAging.d61_90));
  form.appendChild(numField("Over 90 Days", "patientAging.over90", d.patientAging.over90));
  form.appendChild(numField("Est. Insurance Owed", "patientAging.insEst", d.patientAging.insEst));
  form.appendChild(numField("Guarantor Portion", "patientAging.guarPortion", d.patientAging.guarPortion));

  form.appendChild(el("h2", {}, document.createTextNode("Insurance Claims Aging — from Dentrix Insurance Aging Report")));
  form.appendChild(numField("Primary — Current", "insuranceAging.primary.current", d.insuranceAging.primary.current));
  form.appendChild(numField("Primary — 31-60", "insuranceAging.primary.d31_60", d.insuranceAging.primary.d31_60));
  form.appendChild(numField("Primary — 61-90", "insuranceAging.primary.d61_90", d.insuranceAging.primary.d61_90));
  form.appendChild(numField("Primary — Over 90", "insuranceAging.primary.over90", d.insuranceAging.primary.over90));
  form.appendChild(numField("Secondary — Current", "insuranceAging.secondary.current", d.insuranceAging.secondary.current));
  form.appendChild(numField("Secondary — 31-60", "insuranceAging.secondary.d31_60", d.insuranceAging.secondary.d31_60));
  form.appendChild(numField("Secondary — 61-90", "insuranceAging.secondary.d61_90", d.insuranceAging.secondary.d61_90));
  form.appendChild(numField("Secondary — Over 90", "insuranceAging.secondary.over90", d.insuranceAging.secondary.over90));
  form.appendChild(el("p", { class: "muted" }, document.createTextNode(
    "Largest aged claims, tardiness, and days-off still come from the raw Dentrix export via the parser scripts - " +
    "those are per-line/per-punch detail that isn't practical to hand-type. See the Dentrix Report Checklist."
  )));

  form.appendChild(el("h2", {}, document.createTextNode("Add-On Services")));
  const addOnBox = el("div", { id: "addOnBox" });
  function renderAddOns() {
    addOnBox.innerHTML = "";
    d.addOnServices.forEach((a, i) => {
      const nameInput = el("input", { value: a.name, placeholder: "Service name" });
      nameInput.addEventListener("input", () => d.addOnServices[i].name = nameInput.value);
      const prodInput = el("input", { type: "number", step: "0.01", value: a.production });
      prodInput.addEventListener("input", () => d.addOnServices[i].production = parseFloat(prodInput.value) || 0);
      const rmBtn = el("button", { class: "rm-btn", onclick: () => { d.addOnServices.splice(i, 1); renderAddOns(); } }, document.createTextNode("×"));
      addOnBox.appendChild(el("div", { class: "field-row" }, [nameInput, prodInput, rmBtn]));
    });
  }
  renderAddOns();
  form.appendChild(addOnBox);
  form.appendChild(el("button", { class: "add-btn", onclick: () => { d.addOnServices.push({ name: "", production: 0 }); renderAddOns(); } },
    document.createTextNode("+ Add service")));

  form.appendChild(el("h2", {}, document.createTextNode("Providers")));
  form.appendChild(el("p", { class: "muted" }, document.createTextNode("Type them in below, or upload a CSV (provider_name, provider_role, gross_production, adjustments, net_collections).")));
  const csvInput = el("input", { type: "file", accept: ".csv" });
  csvInput.addEventListener("change", (ev) => handleCSVUpload(ev, d, renderProviders));
  form.appendChild(csvInput);
  const provBox = el("div", { id: "provBox" });
  function renderProviders() {
    provBox.innerHTML = "";
    d.providers.forEach((p, i) => {
      const nameInput = el("input", { value: p.name, placeholder: "Name" });
      nameInput.addEventListener("input", () => d.providers[i].name = nameInput.value);
      const roleInput = el("input", { value: p.role, placeholder: "Role" });
      roleInput.addEventListener("input", () => d.providers[i].role = roleInput.value);
      const prodInput = el("input", { type: "number", step: "0.01", value: p.production });
      prodInput.addEventListener("input", () => d.providers[i].production = parseFloat(prodInput.value) || 0);
      const adjInput = el("input", { type: "number", step: "0.01", value: p.adjustments });
      adjInput.addEventListener("input", () => d.providers[i].adjustments = parseFloat(adjInput.value) || 0);
      const collInput = el("input", { type: "number", step: "0.01", value: p.collections });
      collInput.addEventListener("input", () => d.providers[i].collections = parseFloat(collInput.value) || 0);
      const rmBtn = el("button", { class: "rm-btn", onclick: () => { d.providers.splice(i, 1); renderProviders(); } }, document.createTextNode("×"));
      provBox.appendChild(el("div", { class: "field-row provider-row" }, [nameInput, roleInput, prodInput, adjInput, collInput, rmBtn]));
    });
  }
  renderProviders();
  form.appendChild(provBox);
  form.appendChild(el("button", { class: "add-btn", onclick: () => { d.providers.push({ name: "", role: "", production: 0, adjustments: 0, collections: 0, collRate: 0 }); renderProviders(); } },
    document.createTextNode("+ Add provider")));

  const statusEl = el("div", { class: "gate-error" });
  const genBtn = el("button", { class: "primary-btn" }, document.createTextNode("Generate & Download Updated Files"));
  genBtn.addEventListener("click", async () => {
    statusEl.textContent = "Encrypting...";
    try {
      d.providers.forEach(p => p.collRate = p.production ? Math.round(p.collections / p.production * 100) : 0);
      const dept_totals = {};
      d.providers.forEach(p => {
        const dept = p.role === "Dentist" ? "Dentists" : "Hygienists";
        dept_totals[dept] = dept_totals[dept] || { production: 0, collections: 0 };
        dept_totals[dept].production += p.production;
        dept_totals[dept].collections += p.collections;
      });
      const onTimeDays = d.tardiness.employees.reduce((a, e) => a + (e.daysWorked - e.lateDays.length), 0);
      const totalDays = d.tardiness.employees.reduce((a, e) => a + e.daysWorked, 0);
      const team = {
        client: d.client, period: d.period, prepared: d.prepared,
        kpis: {
          production: d.performance.current.production,
          collections: d.performance.current.collections,
          collectionRatePct: d.performance.current.production ? Math.round(d.performance.current.collections / d.performance.current.production * 100) : 0,
          productionChangePct: d.performance.prior.production ? Math.round((d.performance.current.production - d.performance.prior.production) / d.performance.prior.production * 1000) / 10 : 0,
        },
        byDepartment: Object.entries(dept_totals).map(([dept, v]) => ({ dept, production: Math.round(v.production * 100) / 100, collections: Math.round(v.collections * 100) / 100 })),
        attendance: {
          onTimeRatePct: totalDays ? Math.round(onTimeDays / totalDays * 100) : null,
          vacationDaysTaken: d.daysOff.vacation.reduce((a, v) => a + (typeof v.days === "number" ? v.days : 1), 0),
          holidayDate: d.daysOff.holidayDate,
          note: "Team-wide on-time rate and time-off totals only - individual detail lives in the owner report.",
        },
        labor: d.labor.map(l => ({ dept: l.dept, staffCount: l.staffCount, hours: l.hours })),
        newPatients: { actual: d.newPatients.actual },
        addOnProduction: Math.round(d.addOnServices.reduce((a, x) => a + x.production, 0) * 100) / 100,
      };

      const ownerEnc = await encryptJSON(d, password);
      const teamEnc = await encryptJSON(team, session.teamPassword || password);
      downloadJSON(ownerEnc, "owner-view.json.enc");
      downloadJSON(teamEnc, "team-view.json.enc");
      statusEl.style.color = "var(--green)";
      statusEl.textContent = `Downloaded both files. Commit them to data/${CLIENT}/${pk}/ to publish.`;
    } catch (e) {
      statusEl.style.color = "var(--red)";
      statusEl.textContent = "Encryption failed: " + e.message;
    }
  });
  form.appendChild(genBtn);
  form.appendChild(statusEl);
  form.appendChild(el("p", { class: "muted" }, document.createTextNode(
    "Note: the team file needs the TEAM password to encrypt, not the owner password you logged in with. " +
    "Enter it once below (kept in memory only, never saved)."
  )));
  const teamPwInput = el("input", { type: "password", placeholder: "Team password (for re-encrypting the team file)" });
  teamPwInput.addEventListener("input", () => session.teamPassword = teamPwInput.value);
  form.appendChild(teamPwInput);

  content.appendChild(form);
}

function handleCSVUpload(ev, d, callback) {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const lines = reader.result.split(/\r?\n/).filter(l => l.trim());
    const headers = lines[0].split(",").map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      const cells = line.split(",");
      const rec = {};
      headers.forEach((h, i) => rec[h] = (cells[i] || "").trim());
      return rec;
    });
    d.providers = rows.map(r => {
      const production = parseFloat(r.gross_production || 0);
      const collections = parseFloat(r.net_collections || 0);
      return {
        name: r.provider_name || "", role: r.provider_role || "",
        production, adjustments: parseFloat(r.adjustments || 0), collections,
        collRate: production ? Math.round(collections / production * 100) : 0,
      };
    });
    callback();
  };
  reader.readAsText(file);
}

// ---------------- SETTINGS (GOALS) ----------------
async function renderSettingsTab(content, periodsObj, pk) {
  content.appendChild(el("p", { class: "muted" }, document.createTextNode(
    "Goals are a standing baseline, not encrypted (a target number alone doesn't disclose real performance). " +
    "Stored at data/" + CLIENT + "/" + pk + "/goals.json - edit and re-download to update."
  )));
  const goals = (await fetchJSONOrNull(`data/${CLIENT}/${pk}/goals.json`)) || {
    collectionsGoal: 0, departmentGoals: {}, addOnGoal: 0, newPatientsGoal: 0,
  };
  const d = periodsObj[pk];
  const depts = [...new Set(d.providers.map(p => p.role === "Dentist" ? "Dentists" : "Hygienists"))];
  depts.forEach(dep => { if (!(dep in goals.departmentGoals)) goals.departmentGoals[dep] = 0; });

  const form = el("div", { class: "entry-form" });
  function goalField(label, getVal, setVal) {
    const input = el("input", { type: "number", step: "0.01", value: getVal() });
    input.addEventListener("input", () => setVal(parseFloat(input.value) || 0));
    form.appendChild(el("div", { class: "field-row" }, [el("label", {}, document.createTextNode(label)), input]));
  }
  goalField("Collections Goal", () => goals.collectionsGoal, v => goals.collectionsGoal = v);
  Object.keys(goals.departmentGoals).forEach(dep => {
    goalField(`${dep} Goal`, () => goals.departmentGoals[dep], v => goals.departmentGoals[dep] = v);
  });
  goalField("Add-On Services Goal", () => goals.addOnGoal, v => goals.addOnGoal = v);
  goalField("New Patients Goal", () => goals.newPatientsGoal, v => goals.newPatientsGoal = v);

  const dlBtn = el("button", { class: "primary-btn", onclick: () => downloadJSON(goals, "goals.json") },
    document.createTextNode("Download goals.json"));
  form.appendChild(dlBtn);
  content.appendChild(form);
}

// ==================================================================
// TEAM VIEW — goal vs. actual, department by department. Simple, positive.
// ==================================================================
async function renderTeam(container, periodsObj) {
  container.innerHTML = "";
  container.appendChild(brandRow());

  const pk = latestPeriod(periodsObj);
  const d = periodsObj[pk];
  const goals = (await fetchJSONOrNull(`data/${CLIENT}/${pk}/goals.json`)) || {};

  const header = el("div", { class: "app-header" }, [el("h1", {}, document.createTextNode(d.client))]);
  header.appendChild(el("button", { class: "logout", onclick: () => location.reload() }, document.createTextNode("Log out")));
  container.appendChild(header);
  container.appendChild(el("span", { class: "badge team" }, document.createTextNode("Team Performance")));
  container.appendChild(el("p", { class: "subline" }, document.createTextNode(`${d.period} · Prepared ${d.prepared}`)));

  const goalSection = el("div", { class: "section" });
  goalSection.appendChild(el("h2", {}, document.createTextNode("Goal vs. Actual")));
  goalSection.appendChild(goalBar("Collections", d.kpis.collections, goals.collectionsGoal, v => money(v, false)));
  d.byDepartment.forEach(dept => {
    const goal = (goals.departmentGoals || {})[dept.dept] || 0;
    goalSection.appendChild(goalBar(dept.dept, dept.production, goal, v => money(v, false)));
  });
  goalSection.appendChild(goalBar("Add-On Services", d.addOnProduction || 0, goals.addOnGoal, v => money(v, false)));
  goalSection.appendChild(goalBar("New Patients", d.newPatients.actual, goals.newPatientsGoal, v => Math.round(v)));
  container.appendChild(goalSection);

  const kpis = el("div", { class: "kpis" }, [
    kpiCard("Collection Rate", d.kpis.collectionRatePct + "%", "var(--navy)"),
    kpiCard("On-Time Rate", (d.attendance.onTimeRatePct ?? "&mdash;") + "%", "var(--amber)"),
  ]);
  container.appendChild(kpis);

  const laborSection = el("div", { class: "section" });
  laborSection.appendChild(el("h2", {}, document.createTextNode("Staffing Hours")));
  laborSection.appendChild(table(["Department", "Staff", "Hours"], d.labor.map(l => [l.dept, l.staffCount, l.hours]), [1, 2]));
  container.appendChild(laborSection);

  const noteSection = el("div", { class: "section" });
  noteSection.appendChild(el("h2", {}, document.createTextNode("Time Off This Period")));
  noteSection.appendChild(el("p", {}, document.createTextNode(
    `Company holiday: ${d.attendance.holidayDate}. Vacation days taken: ${d.attendance.vacationDaysTaken}.`
  )));
  container.appendChild(noteSection);
}

// ---------------- GATE ----------------
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("gateForm");
  const input = document.getElementById("gatePassword");
  const errorEl = document.getElementById("gateError");
  const gate = document.getElementById("gate");
  const app = document.getElementById("app");

  const infoModal = document.getElementById("infoModal");
  const infoClose = document.getElementById("infoClose");
  infoClose.addEventListener("click", () => infoModal.classList.remove("visible"));
  infoModal.addEventListener("click", (ev) => { if (ev.target === infoModal) infoModal.classList.remove("visible"); });

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    errorEl.textContent = "";
    form.querySelector("button").disabled = true;
    try {
      const result = await attemptLogin(input.value);
      if (!result) {
        errorEl.textContent = "Incorrect password.";
        form.querySelector("button").disabled = false;
        return;
      }
      session = result;
      gate.style.display = "none";
      app.classList.add("visible");
      if (session.level === "owner") renderOwner(app, session.periods, session.password);
      else renderTeam(app, session.periods);
    } catch (e) {
      errorEl.textContent = "Could not load report data.";
      form.querySelector("button").disabled = false;
    }
  });
});
