// PUBLIC monthly-numbers wizard (management). No login: this page is a link you
// send to whoever runs the Dentrix reports. It starts BLANK (a public page must
// never pre-fill last month's real financials). On submit it produces a numbers
// file; in the live build this POSTs to the backend, which validates, encrypts
// the three report tiers, and publishes. See MAP.md.

const BLANK = {
  period: "",
  submittedBy: "",
  performance: {
    current: { production: 0, prodAdj: 0, collections: 0, arBalance: 0 },
    prior: { production: 0, collections: 0 },
    ytd: { production: 0, collections: 0 },
  },
  patientAging: { current: 0, d31_60: 0, d61_90: 0, over90: 0, insEst: 0, guarPortion: 0 },
  insuranceAging: {
    primary: { current: 0, d31_60: 0, d61_90: 0, over90: 0 },
    secondary: { current: 0, d31_60: 0, d61_90: 0, over90: 0 },
  },
  newPatients: { actual: 0 },
  addOnServices: [{ name: "Orthodontics", production: 0 }, { name: "Teeth Whitening", production: 0 }, { name: "Implants", production: 0 }],
  providers: [{ name: "", role: "Dentist", production: 0, adjustments: 0, collections: 0 }],
};

const d = JSON.parse(JSON.stringify(BLANK));
const set = (path, val) => { const p = path.split("."); let c = d; for (let i = 0; i < p.length - 1; i++) c = c[p[i]]; c[p[p.length - 1]] = val; };
const numField = (label, path, val) => {
  const i = el("input", { type: "number", step: "0.01", value: val, placeholder: "0" });
  i.addEventListener("input", () => set(path, parseFloat(i.value) || 0));
  return el("div", { class: "field-row" }, [el("label", {}, T(label)), i]);
};
const textField = (label, path, ph) => {
  const i = el("input", { type: "text", placeholder: ph || "" });
  i.addEventListener("input", () => set(path, i.value));
  return el("div", { class: "field-row" }, [el("label", {}, T(label)), i]);
};
const grid = (f) => el("div", { class: "field-grid" }, f);

const stepPerformance = (b) => {
  b.appendChild(el("p", { class: "wiz-hint" }, [
    el("button", { class: "info-icon", type: "button", title: "Which reports", onclick: () => document.getElementById("infoModal").classList.add("visible") }, T("i")),
    el("span", {}, T("From the Provider A/R Totals report — the TOTAL row and its Prev. Month / YTD columns.")),
  ]));
  b.appendChild(grid([
    monthField("Reporting Month", (label, ym) => { d.period = label; d.periodKey = ym; }),
    textField("Submitted By (required)", "submittedBy", "Your name"),
    numField("Gross Production", "performance.current.production", ""),
    numField("Net Collections", "performance.current.collections", ""),
    numField("Production Adjustments (+)", "performance.current.prodAdj", ""),
    numField("Ending A/R Balance", "performance.current.arBalance", ""),
    numField("Prior Period Production", "performance.prior.production", ""),
    numField("Prior Period Collections", "performance.prior.collections", ""),
    numField("YTD Production", "performance.ytd.production", ""),
    numField("YTD Collections", "performance.ytd.collections", ""),
  ]));
};
const stepAging = (b) => {
  b.appendChild(el("p", { class: "wiz-hint" }, T("Patient totals from the Aging Report; claim totals from the Insurance Claim Aging Report.")));
  b.appendChild(el("div", { class: "sub-label" }, T("Patient / Guarantor Aging")));
  b.appendChild(grid([
    numField("Current (0-30)", "patientAging.current", ""),
    numField("31-60 Days", "patientAging.d31_60", ""),
    numField("61-90 Days", "patientAging.d61_90", ""),
    numField("Over 90 Days", "patientAging.over90", ""),
    numField("Est. Insurance Owed", "patientAging.insEst", ""),
    numField("Guarantor Portion", "patientAging.guarPortion", ""),
  ]));
  b.appendChild(el("div", { class: "sub-label" }, T("Insurance Claims Aging")));
  b.appendChild(grid([
    numField("Primary — Current", "insuranceAging.primary.current", ""),
    numField("Secondary — Current", "insuranceAging.secondary.current", ""),
    numField("Primary — 31-60", "insuranceAging.primary.d31_60", ""),
    numField("Secondary — 31-60", "insuranceAging.secondary.d31_60", ""),
    numField("Primary — 61-90", "insuranceAging.primary.d61_90", ""),
    numField("Secondary — 61-90", "insuranceAging.secondary.d61_90", ""),
    numField("Primary — Over 90", "insuranceAging.primary.over90", ""),
    numField("Secondary — Over 90", "insuranceAging.secondary.over90", ""),
  ]));
};
const stepPatients = (b) => {
  b.appendChild(el("p", { class: "wiz-hint" }, T("New-patient count and production for any add-on services tracked separately.")));
  b.appendChild(grid([numField("New Patients This Period", "newPatients.actual", "")]));
  b.appendChild(el("div", { class: "sub-label" }, T("Add-On Services")));
  const box = el("div", {});
  const rr = () => {
    box.innerHTML = "";
    d.addOnServices.forEach((a, idx) => {
      const n = el("input", { value: a.name, placeholder: "Service name" });
      n.addEventListener("input", () => d.addOnServices[idx].name = n.value);
      const p = el("input", { type: "number", step: "0.01", value: a.production || "", placeholder: "Production" });
      p.addEventListener("input", () => d.addOnServices[idx].production = parseFloat(p.value) || 0);
      box.appendChild(el("div", { class: "provider-row", style: "margin-bottom:8px" }, [n, p,
        el("button", { class: "rm-btn", onclick: () => { d.addOnServices.splice(idx, 1); rr(); } }, T("×"))]));
    });
  };
  rr();
  b.append(box, el("button", { class: "add-btn", onclick: () => { d.addOnServices.push({ name: "", production: 0 }); rr(); } }, T("+ Add service")));
};
const stepProviders = (b) => {
  b.appendChild(el("p", { class: "wiz-hint" }, T("One row per provider — use each provider's own row on the A/R Totals report.")));
  const box = el("div", {});
  const rr = () => {
    box.innerHTML = "";
    box.appendChild(el("div", { class: "provider-head" }, ["Name", "Role", "Production", "Adjustments", "Collections", ""].map(h => el("span", {}, T(h)))));
    d.providers.forEach((p, idx) => {
      const mk = (k, ph, isNum) => { const i = el("input", isNum ? { type: "number", step: "0.01", value: p[k] || "", placeholder: ph } : { value: p[k], placeholder: ph }); i.addEventListener("input", () => d.providers[idx][k] = isNum ? (parseFloat(i.value) || 0) : i.value); return i; };
      box.appendChild(el("div", { class: "provider-row", style: "margin-bottom:8px" }, [
        mk("name", "Name"), mk("role", "Role"), mk("production", "0", true), mk("adjustments", "0", true), mk("collections", "0", true),
        el("button", { class: "rm-btn", onclick: () => { d.providers.splice(idx, 1); rr(); } }, T("×"))]));
    });
  };
  rr();
  b.append(box, el("button", { class: "add-btn", onclick: () => { d.providers.push({ name: "", role: "Dentist", production: 0, adjustments: 0, collections: 0 }); rr(); } }, T("+ Add provider")));
};
const stepReview = (b) => {
  const collRate = d.performance.current.production ? Math.round(d.performance.current.collections / d.performance.current.production * 100) : 0;
  b.appendChild(el("p", { class: "wiz-hint" }, T("Quick check, then submit. In the live build this goes straight to us; the reports update once it's published.")));
  b.appendChild(el("div", { class: "review-grid" }, [
    ["Month", d.period || "—"],
    ["Production", money0(d.performance.current.production)],
    ["Collections", money0(d.performance.current.collections)],
    ["Collection Rate", collRate + "%"],
    ["New Patients", String(d.newPatients.actual)],
    ["Providers", String(d.providers.filter(p => p.name).length)],
  ].map(([k, v]) => el("div", { class: "review-cell" }, [el("div", { class: "rc-label" }, T(k)), el("div", { class: "rc-val" }, T(v))]))));
  const status = el("div", { class: "save-status" });
  const btn = el("button", { class: "primary-btn" }, T("Submit Numbers"));
  btn.addEventListener("click", () => {
    if (!d.period.trim()) { status.style.color = "var(--red)"; status.textContent = "Pick the reporting month first."; return; }
    if (!d.submittedBy.trim()) { status.style.color = "var(--red)"; status.textContent = "Add who's submitting (Submitted By)."; return; }
    downloadJSON({ client: CLIENT, type: "monthly-numbers", ...d }, `${CLIENT}-${(d.periodKey || d.period).replace(/\s+/g, "-").toLowerCase()}-numbers.json`);
    document.getElementById("entryRoot").innerHTML = "";
    document.getElementById("entryRoot").appendChild(el("div", { class: "done-card" }, [
      el("div", { class: "done-check" }, T("✓")),
      el("h2", {}, T("Submitted — thank you")),
      el("p", {}, T(`${d.period} numbers recorded. (Prototype: a file downloaded for hand-off; the live build posts this to us automatically and updates the gated reports.)`)),
    ]));
  });
  b.append(btn, status);
};

const steps = [
  { title: "Performance", body: stepPerformance },
  { title: "A/R Aging", body: stepAging },
  { title: "Patients & Add-Ons", body: stepPatients },
  { title: "Providers", body: stepProviders },
  { title: "Review & Submit", body: stepReview },
];
let cur = 0;
const root = document.getElementById("entryRoot");
const wizard = el("div", { class: "wizard" });
const stepsBar = el("div", { class: "wiz-steps" });
const bodyWrap = el("div", { class: "entry-form wiz-body" });
const nav = el("div", { class: "wiz-nav" });
root.appendChild(wizard);
wizard.append(stepsBar, bodyWrap, nav);
function draw() {
  stepsBar.innerHTML = "";
  steps.forEach((s, i) => {
    const cls = "wiz-step" + (i === cur ? " active" : "") + (i < cur ? " done" : "");
    stepsBar.appendChild(el("div", { class: cls, onclick: () => { if (i <= cur) { cur = i; draw(); } } }, [
      el("span", { class: "wiz-num" }, T(i < cur ? "✓" : String(i + 1))),
      el("span", { class: "wiz-title" }, T(s.title)),
    ]));
  });
  bodyWrap.innerHTML = "";
  bodyWrap.appendChild(el("h2", {}, T(steps[cur].title)));
  steps[cur].body(bodyWrap);
  nav.innerHTML = "";
  nav.appendChild(cur > 0 ? el("button", { class: "ghost-btn", onclick: () => { cur--; draw(); } }, T("← Back")) : el("span", {}));
  nav.appendChild(cur < steps.length - 1 ? el("button", { class: "primary-btn", style: "margin-top:0", onclick: () => { cur++; draw(); } }, T("Next →")) : el("span", {}));
}
draw();

document.getElementById("infoClose").addEventListener("click", () => document.getElementById("infoModal").classList.remove("visible"));
document.getElementById("infoModal").addEventListener("click", (ev) => { if (ev.target.id === "infoModal") ev.currentTarget.classList.remove("visible"); });
