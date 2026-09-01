// PUBLIC monthly-numbers wizard (management). No login: this page is a link you
// send to whoever runs the Dentrix reports. It starts BLANK (a public page must
// never pre-fill last month's real financials). On submit it produces a numbers
// file; in the live build this POSTs to the backend, which validates, encrypts
// the three report tiers, and publishes. See MAP.md.
//
// Presented as a one-question-at-a-time "quiz": big question-mark badge, one
// plain-language question per screen, floating with no card/background chrome.
// Ends by showing this month's report directly (not just a thank-you), with a
// last-month comparison pulled from this browser's local history if one exists.

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
  providers: [{ name: "Dr. Mitchell", role: "Dentist", production: 0, adjustments: 0, collections: 0 }, { name: "Dr. Yassa", role: "Dentist", production: 0, adjustments: 0, collections: 0 }],
  hygienists: [{ name: "", collections: 0 }, { name: "", collections: 0 }, { name: "", collections: 0 }],
  treatmentAcceptanceRate: 0,
};

const d = JSON.parse(JSON.stringify(BLANK));
const set = (path, val) => { const p = path.split("."); let c = d; for (let i = 0; i < p.length - 1; i++) c = c[p[i]]; c[p[p.length - 1]] = val; };
const HISTORY_KEY = "keepMetricsHistory:" + CLIENT;

// ---- quiz-card building blocks ----
const bigNumberInput = (path, val, onEnter) => {
  const wrap = el("div", { class: "quiz-input-wrap" });
  const dollar = el("span", { class: "quiz-input-prefix" }, T("$"));
  const i = el("input", { type: "number", step: "0.01", inputmode: "decimal", value: val, placeholder: "0", class: "quiz-input quiz-input-money" });
  i.addEventListener("input", () => set(path, parseFloat(i.value) || 0));
  if (onEnter) i.addEventListener("keydown", (ev) => { if (ev.key === "Enter") onEnter(); });
  wrap.append(dollar, i);
  return wrap;
};
const bigPlainInput = (path, val, ph, onEnter) => {
  const i = el("input", { type: "number", inputmode: "numeric", value: val, placeholder: ph || "0", class: "quiz-input" });
  i.addEventListener("input", () => set(path, parseInt(i.value, 10) || 0));
  if (onEnter) i.addEventListener("keydown", (ev) => { if (ev.key === "Enter") onEnter(); });
  return i;
};
const bigPercentInput = (path, val, onEnter) => {
  const wrap = el("div", { class: "quiz-input-wrap" });
  const i = el("input", { type: "number", step: "0.1", inputmode: "decimal", value: val, placeholder: "0", class: "quiz-input quiz-input-money" });
  i.addEventListener("input", () => set(path, parseFloat(i.value) || 0));
  if (onEnter) i.addEventListener("keydown", (ev) => { if (ev.key === "Enter") onEnter(); });
  const pct = el("span", { class: "quiz-input-suffix" }, T("%"));
  wrap.append(i, pct);
  return wrap;
};
const quizCard = (root, { step, total, title, hint, body, onNext, nextLabel, showBack, onBack, skip }) => {
  root.innerHTML = "";
  const card = el("div", { class: "quiz-card" });
  card.appendChild(el("div", { class: "quiz-qmark" }, T("?")));
  card.appendChild(el("div", { class: "quiz-progress" }, T(`STEP ${step} OF ${total}`)));
  card.appendChild(el("h2", { class: "quiz-title" }, T(title)));
  if (hint) card.appendChild(el("p", { class: "quiz-hint" }, T(hint)));
  const bodyWrap = el("div", { class: "quiz-body" });
  body(bodyWrap);
  card.appendChild(bodyWrap);
  const nav = el("div", { class: "quiz-nav" });
  nav.appendChild(showBack
    ? el("button", { class: "quiz-back", type: "button", onclick: onBack }, T("← Back"))
    : el("span", {}));
  const rightNav = el("div", { class: "quiz-nav-right" });
  if (skip) rightNav.appendChild(el("button", { class: "quiz-skip", type: "button", onclick: skip }, T("Skip")));
  rightNav.appendChild(el("button", { class: "quiz-next", type: "button", onclick: onNext }, T(nextLabel || "Next →")));
  nav.appendChild(rightNav);
  card.appendChild(nav);
  root.appendChild(card);
};

// ---- confetti (pure CSS/DOM, no external libs) ----
function fireConfetti() {
  const colors = ["#1B2A4A", "#3D5A80", "#1E7145", "#70996F", "#B8860B", "#B3261E"];
  const layer = el("div", { class: "confetti-layer" });
  for (let i = 0; i < 90; i++) {
    const piece = el("div", { class: "confetti-piece" });
    const left = Math.random() * 100;
    const delay = Math.random() * 0.6;
    const duration = 2.2 + Math.random() * 1.6;
    const drift = (Math.random() * 160 - 80).toFixed(0) + "px";
    const rot = (Math.random() * 720 - 360).toFixed(0) + "deg";
    const size = 6 + Math.round(Math.random() * 6);
    piece.style.left = left + "%";
    piece.style.background = colors[i % colors.length];
    piece.style.width = size + "px";
    piece.style.height = (size * 0.4) + "px";
    piece.style.animationDelay = delay + "s";
    piece.style.animationDuration = duration + "s";
    piece.style.setProperty("--drift", drift);
    piece.style.setProperty("--rot", rot);
    layer.appendChild(piece);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 4200);
}

// ---- local history (this device only — stand-in until there's a real backend) ----
function loadHistory() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "{}"); } catch (e) { return {}; } }
function saveToHistory(record) {
  const hist = loadHistory();
  hist[record.periodKey || record.period] = record;
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(hist)); } catch (e) { /* storage unavailable, non-fatal */ }
}
function priorMonthKey(periodKey) {
  if (!periodKey) return null;
  const [y, m] = periodKey.split("-").map(Number);
  const prevM = m === 1 ? 12 : m - 1;
  const prevY = m === 1 ? y - 1 : y;
  return prevY + "-" + String(prevM).padStart(2, "0");
}

// ---- steps ----
let cur = 0;
const TOTAL_STEPS = 9;
const root = document.getElementById("entryRoot");

function drawIntro() {
  quizCard(root, {
    step: 1, total: TOTAL_STEPS, title: "Hi! Let's get this month's numbers.",
    hint: "Just your name and the month this is for. Takes about five minutes.",
    body: (b) => {
      b.appendChild(el("button", {
        class: "quiz-help-link", type: "button",
        onclick: () => document.getElementById("infoModal").classList.add("visible"),
      }, T("Want the full report checklist first? Tap here.")));
      b.appendChild(el("div", { class: "quiz-mini-label" }, T("Reporting Month")));
      const monthWrap = el("div", { class: "quiz-month-wrap" });
      monthWrap.appendChild(monthField("", (label, ym) => { d.period = label; d.periodKey = ym; }));
      b.appendChild(monthWrap);
      b.appendChild(el("div", { class: "quiz-mini-label", style: "margin-top:22px" }, T("Your Name")));
      const name = el("input", { type: "text", placeholder: "Type your name here", class: "quiz-input quiz-input-text", value: d.submittedBy });
      name.addEventListener("input", () => set("submittedBy", name.value));
      b.appendChild(name);
    },
    onNext: () => {
      if (!d.submittedBy.trim()) { flash("Add your name before moving on."); return; }
      cur++; draw();
    },
    showBack: false,
  });
}

function drawProduction() {
  quizCard(root, {
    step: 2, total: TOTAL_STEPS, title: "What was your Gross Production this month?",
    hint: "Find this on the Provider A/R Totals report, in the TOTAL row at the bottom, under Production. It's everything the practice billed for work done this month, before any money came in.",
    body: (b) => b.appendChild(bigNumberInput("performance.current.production", d.performance.current.production || "", () => { cur++; draw(); })),
    onNext: () => { cur++; draw(); },
    showBack: true, onBack: () => { cur--; draw(); },
  });
}

function drawCollections() {
  quizCard(root, {
    step: 3, total: TOTAL_STEPS, title: "What did you actually Collect?",
    hint: "Same report, same TOTAL row, just look one column over to Collections. This is the money that actually came in this month, not just what was billed.",
    body: (b) => b.appendChild(bigNumberInput("performance.current.collections", d.performance.current.collections || "", () => { cur++; draw(); })),
    onNext: () => { cur++; draw(); },
    showBack: true, onBack: () => { cur--; draw(); },
  });
}

function drawDoctorCollections() {
  quizCard(root, {
    step: 4, total: TOTAL_STEPS, title: "What did each Doctor collect?",
    hint: "Same Provider A/R Totals report, this time use each doctor's own row, Collections column, instead of the TOTAL row.",
    body: (b) => {
      const box = el("div", { class: "quiz-addon-list" });
      const rr = () => {
        box.innerHTML = "";
        d.providers.forEach((p, idx) => {
          const n = el("input", { value: p.name, placeholder: "Doctor name", class: "quiz-addon-name" });
          n.addEventListener("input", () => d.providers[idx].name = n.value);
          const dollar = el("span", { class: "quiz-addon-prefix" }, T("$"));
          const c = el("input", { type: "number", step: "0.01", value: p.collections || "", placeholder: "0", class: "quiz-addon-amt" });
          c.addEventListener("input", () => d.providers[idx].collections = parseFloat(c.value) || 0);
          const amtWrap = el("div", { class: "quiz-addon-amt-wrap" }, [dollar, c]);
          box.appendChild(el("div", { class: "quiz-addon-row" }, [n, amtWrap,
            el("button", { class: "quiz-rm", type: "button", onclick: () => { d.providers.splice(idx, 1); rr(); } }, T("×"))]));
        });
      };
      rr();
      b.append(box, el("button", { class: "quiz-add-more", type: "button", onclick: () => { d.providers.push({ name: "", role: "Dentist", production: 0, adjustments: 0, collections: 0 }); rr(); } }, T("+ Add another doctor")));
    },
    onNext: () => { cur++; draw(); },
    showBack: true, onBack: () => { cur--; draw(); },
  });
}

function drawHygieneCollections() {
  quizCard(root, {
    step: 5, total: TOTAL_STEPS, title: "What did each Hygienist collect?",
    hint: "Same Provider A/R Totals report, each hygienist's own row, Collections column.",
    body: (b) => {
      const box = el("div", { class: "quiz-addon-list" });
      const rr = () => {
        box.innerHTML = "";
        d.hygienists.forEach((h, idx) => {
          const n = el("input", { value: h.name, placeholder: "Hygienist name", class: "quiz-addon-name" });
          n.addEventListener("input", () => d.hygienists[idx].name = n.value);
          const dollar = el("span", { class: "quiz-addon-prefix" }, T("$"));
          const c = el("input", { type: "number", step: "0.01", value: h.collections || "", placeholder: "0", class: "quiz-addon-amt" });
          c.addEventListener("input", () => d.hygienists[idx].collections = parseFloat(c.value) || 0);
          const amtWrap = el("div", { class: "quiz-addon-amt-wrap" }, [dollar, c]);
          box.appendChild(el("div", { class: "quiz-addon-row" }, [n, amtWrap,
            el("button", { class: "quiz-rm", type: "button", onclick: () => { d.hygienists.splice(idx, 1); rr(); } }, T("×"))]));
        });
      };
      rr();
      b.append(box, el("button", { class: "quiz-add-more", type: "button", onclick: () => { d.hygienists.push({ name: "", collections: 0 }); rr(); } }, T("+ Add another hygienist")));
    },
    onNext: () => { cur++; draw(); },
    showBack: true, onBack: () => { cur--; draw(); },
  });
}

function drawTreatmentAcceptance() {
  quizCard(root, {
    step: 6, total: TOTAL_STEPS, title: "What was the Treatment Plan Acceptance rate?",
    hint: "The percent of proposed treatment plans patients said yes to this month. Pull this from Dentrix's Treatment Plan or Case Acceptance report.",
    body: (b) => b.appendChild(bigPercentInput("treatmentAcceptanceRate", d.treatmentAcceptanceRate || "", () => { cur++; draw(); })),
    onNext: () => { cur++; draw(); },
    showBack: true, onBack: () => { cur--; draw(); },
  });
}

function drawNewPatients() {
  quizCard(root, {
    step: 7, total: TOTAL_STEPS, title: "How many New Patients this month?",
    hint: "Pull this from Dentrix's New Patient report, or the front-desk tracker if that's easier. Just the count of first-time patients seen this month.",
    body: (b) => b.appendChild(bigPlainInput("newPatients.actual", d.newPatients.actual || "", "0", () => { cur++; draw(); })),
    onNext: () => { cur++; draw(); },
    showBack: true, onBack: () => { cur--; draw(); },
  });
}

function drawAddOns() {
  quizCard(root, {
    step: 8, total: TOTAL_STEPS, title: "Any Add-On Production?",
    hint: "Only if Ortho, Whitening, Implants, or similar are tracked as their own procedure codes in Dentrix. Not sure, or none this month? Just hit Skip.",
    body: (b) => {
      const box = el("div", { class: "quiz-addon-list" });
      const rr = () => {
        box.innerHTML = "";
        d.addOnServices.forEach((a, idx) => {
          const n = el("input", { value: a.name, placeholder: "Service name", class: "quiz-addon-name" });
          n.addEventListener("input", () => d.addOnServices[idx].name = n.value);
          const dollar = el("span", { class: "quiz-addon-prefix" }, T("$"));
          const p = el("input", { type: "number", step: "0.01", value: a.production || "", placeholder: "0", class: "quiz-addon-amt" });
          p.addEventListener("input", () => d.addOnServices[idx].production = parseFloat(p.value) || 0);
          const amtWrap = el("div", { class: "quiz-addon-amt-wrap" }, [dollar, p]);
          box.appendChild(el("div", { class: "quiz-addon-row" }, [n, amtWrap,
            el("button", { class: "quiz-rm", type: "button", onclick: () => { d.addOnServices.splice(idx, 1); rr(); } }, T("×"))]));
        });
      };
      rr();
      b.append(box, el("button", { class: "quiz-add-more", type: "button", onclick: () => { d.addOnServices.push({ name: "", production: 0 }); rr(); } }, T("+ Add another service")));
    },
    onNext: () => { cur++; draw(); },
    skip: () => { cur++; draw(); },
    showBack: true, onBack: () => { cur--; draw(); },
  });
}

function drawReview() {
  const collRate = d.performance.current.production ? Math.round(d.performance.current.collections / d.performance.current.production * 100) : 0;
  const addOnTotal = d.addOnServices.reduce((a, s) => a + (s.production || 0), 0);
  const docTotal = d.providers.reduce((a, p) => a + (p.collections || 0), 0);
  const hygTotal = d.hygienists.reduce((a, h) => a + (h.collections || 0), 0);
  root.innerHTML = "";
  const card = el("div", { class: "quiz-card" });
  card.appendChild(el("div", { class: "quiz-qmark" }, T("?")));
  card.appendChild(el("div", { class: "quiz-progress" }, T(`STEP 9 OF ${TOTAL_STEPS}`)));
  card.appendChild(el("h2", { class: "quiz-title" }, T(`Looks good, ${d.submittedBy.trim() || "there"}. Here's what you told us:`)));
  card.appendChild(el("div", { class: "quiz-review-grid" }, [
    ["Month", d.period || "—"],
    ["Production", money0(d.performance.current.production)],
    ["Collections", money0(d.performance.current.collections)],
    ["Collection Rate", collRate + "%"],
    ["Doctor Collections", money0(docTotal)],
    ["Hygiene Collections", money0(hygTotal)],
    ["Treatment Acceptance", (d.treatmentAcceptanceRate || 0) + "%"],
    ["New Patients", String(d.newPatients.actual)],
    ["Add-On Production", money0(addOnTotal)],
  ].map(([k, v]) => el("div", { class: "quiz-review-cell" }, [el("div", { class: "quiz-review-label" }, T(k)), el("div", { class: "quiz-review-val" }, T(v))]))));
  const status = el("div", { class: "quiz-status" });
  const nav = el("div", { class: "quiz-nav" });
  nav.appendChild(el("button", { class: "quiz-back", type: "button", onclick: () => { cur--; draw(); } }, T("← Back")));
  const rightNav = el("div", { class: "quiz-nav-right" });
  rightNav.appendChild(el("button", { class: "quiz-next quiz-submit", type: "button", onclick: submit }, T("Submit Numbers 🎉")));
  nav.appendChild(rightNav);
  card.append(status, nav);
  root.appendChild(card);

  function submit() {
    if (!d.period.trim()) { status.textContent = "Pick the reporting month first (go back to step 1)."; return; }
    if (!d.submittedBy.trim()) { status.textContent = "We're missing your name (go back to step 1)."; return; }
    const record = { client: CLIENT, type: "monthly-numbers", ...d };
    saveToHistory(record);
    drawReport(record);
  }
}

// ---- mailto hand-off (interim, until this posts straight to the ASK System) ----
function buildMailtoLink(record) {
  const collRate = record.performance.current.production ? Math.round(record.performance.current.collections / record.performance.current.production * 100) : 0;
  const addOnTotal = record.addOnServices.reduce((a, s) => a + (s.production || 0), 0);
  const lines = [
    `Hi Glenn,`, ``,
    `Here are ${record.period}'s numbers from ${record.submittedBy}:`, ``,
    `Gross Production: ${money0(record.performance.current.production)}`,
    `Net Collections: ${money0(record.performance.current.collections)}`,
    `Collection Rate: ${collRate}%`,
    `Doctor Collections:`,
    ...record.providers.filter(p => p.name).map(p => `  ${p.name}: ${money0(p.collections)}`),
    `Hygiene Collections: ${money0(record.hygienists.reduce((a, h) => a + (h.collections || 0), 0))}`,
    ...record.hygienists.filter(h => h.name).map(h => `  ${h.name}: ${money0(h.collections)}`),
    `Treatment Plan Acceptance: ${record.treatmentAcceptanceRate || 0}%`,
    `New Patients: ${record.newPatients.actual}`,
    `Add-On Production: ${money0(addOnTotal)}`,
    ...(addOnTotal ? record.addOnServices.filter(s => s.name && s.production).map(s => `  ${s.name}: ${money0(s.production)}`) : []),
    ``, `Sent from the Keep Metrics numbers form.`,
  ];
  const subject = encodeURIComponent(`AFD Monthly Numbers: ${record.period}`);
  const body = encodeURIComponent(lines.join("\n"));
  return `mailto:glenn@shiftagent.co?subject=${subject}&body=${body}`;
}

// simple flat SVG smiley (not a 3D/emoji-style face)
const SMILEY_SVG = `<svg viewBox="0 0 100 100" width="88" height="88" role="img" aria-label="Smiley face">
  <circle cx="50" cy="50" r="46" fill="#FFD35E" stroke="#1B2A4A" stroke-width="4"/>
  <circle cx="34" cy="42" r="6" fill="#1B2A4A"/>
  <circle cx="66" cy="42" r="6" fill="#1B2A4A"/>
  <path d="M27 60 Q50 84 73 60" stroke="#1B2A4A" stroke-width="5" fill="none" stroke-linecap="round"/>
</svg>`;

// ---- this month's report (shown immediately after submit) ----
function drawReport(record) {
  root.innerHTML = "";
  const collRate = record.performance.current.production ? Math.round(record.performance.current.collections / record.performance.current.production * 100) : 0;
  const addOnTotal = record.addOnServices.reduce((a, s) => a + (s.production || 0), 0);
  const docTotal = record.providers.reduce((a, p) => a + (p.collections || 0), 0);
  const hygTotal = record.hygienists.reduce((a, h) => a + (h.collections || 0), 0);

  const wrap = el("div", { class: "quiz-card quiz-report" });
  wrap.appendChild(el("div", { class: "quiz-done-face", html: SMILEY_SVG }));
  wrap.appendChild(el("h2", { class: "quiz-title" }, T("All done, thank you!")));
  wrap.appendChild(el("p", { class: "quiz-hint" }, T(`Here's this month's report, the one we'll use for the team meeting.`)));

  wrap.appendChild(el("div", { class: "report-header" }, [
    el("div", { class: "report-period" }, T(record.period)),
    el("div", { class: "report-sub" }, T(`Submitted by ${record.submittedBy}`)),
  ]));

  wrap.appendChild(el("a", {
    class: "quiz-next quiz-submit report-email-btn", href: buildMailtoLink(record),
  }, T("📧 Email These Numbers to Us")));

  const priorKey = priorMonthKey(record.periodKey);
  const hist = loadHistory();
  const prior = priorKey ? hist[priorKey] : null;
  const priorCollRate = prior && prior.performance.current.production
    ? Math.round(prior.performance.current.collections / prior.performance.current.production * 100) : null;

  const deltaRow = (label, cur, prior, fmt) => {
    const cell = [el("div", { class: "report-tile-label" }, T(label)), el("div", { class: "report-tile-val" }, T(fmt(cur)))];
    if (prior !== null && prior !== undefined) {
      const diff = cur - prior;
      const pct = prior ? Math.round((diff / Math.abs(prior)) * 100) : null;
      const dir = diff > 0 ? "▲" : diff < 0 ? "▼" : "•";
      const cls = diff > 0 ? "report-up" : diff < 0 ? "report-down" : "report-flat";
      cell.push(el("div", { class: "report-tile-delta " + cls }, T(`${dir} ${pct !== null ? Math.abs(pct) + "% " : ""}vs last month`)));
    }
    return el("div", { class: "report-tile" }, cell);
  };

  wrap.appendChild(el("div", { class: "report-grid" }, [
    deltaRow("Gross Production", record.performance.current.production, prior ? prior.performance.current.production : null, money0),
    deltaRow("Net Collections", record.performance.current.collections, prior ? prior.performance.current.collections : null, money0),
    deltaRow("Collection Rate", collRate, priorCollRate, (v) => v + "%"),
    deltaRow("New Patients", record.newPatients.actual, prior ? prior.newPatients.actual : null, (v) => String(v)),
    deltaRow("Hygiene Collections", hygTotal, prior ? prior.hygienists.reduce((a, h) => a + (h.collections || 0), 0) : null, money0),
    deltaRow("Treatment Acceptance", record.treatmentAcceptanceRate || 0, prior ? (prior.treatmentAcceptanceRate || 0) : null, (v) => v + "%"),
    deltaRow("Add-On Production", addOnTotal, prior ? prior.addOnServices.reduce((a, s) => a + (s.production || 0), 0) : null, money0),
    deltaRow("Doctor Collections (total)", docTotal, prior ? prior.providers.reduce((a, p) => a + (p.collections || 0), 0) : null, money0),
  ]));

  if (record.providers.filter(p => p.name).length) {
    wrap.appendChild(el("div", { class: "report-subhead" }, T("By Doctor")));
    wrap.appendChild(el("div", { class: "report-provider-list" }, record.providers.filter(p => p.name).map(p =>
      el("div", { class: "report-provider-row" }, [el("span", {}, T(p.name)), el("span", { class: "report-provider-amt" }, T(money0(p.collections)))])
    )));
  }
  if (record.hygienists.filter(h => h.name).length) {
    wrap.appendChild(el("div", { class: "report-subhead" }, T("By Hygienist")));
    wrap.appendChild(el("div", { class: "report-provider-list" }, record.hygienists.filter(h => h.name).map(h =>
      el("div", { class: "report-provider-row" }, [el("span", {}, T(h.name)), el("span", { class: "report-provider-amt" }, T(money0(h.collections)))])
    )));
  }

  wrap.appendChild(el("div", { class: "report-note" }, T(
    prior
      ? "Compared against last month's submitted numbers, saved on this device."
      : "This is the first month on record on this device. Next month we'll show a comparison here."
  )));
  wrap.appendChild(el("p", { class: "quiz-hint report-fineprint" }, T(
    "(Prototype: this report is built from the numbers you just entered and saved on this device for next month's comparison. Tap the button above to email them to us, that's the one step left until this saves itself automatically.)"
  )));

  root.appendChild(wrap);
  fireConfetti();
}

function flash(msg) {
  const existing = document.querySelector(".quiz-flash");
  if (existing) existing.remove();
  const f = el("div", { class: "quiz-flash" }, T(msg));
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 2400);
}

const stepDrawers = [drawIntro, drawProduction, drawCollections, drawDoctorCollections, drawHygieneCollections, drawTreatmentAcceptance, drawNewPatients, drawAddOns, drawReview];
function draw() { stepDrawers[cur](); }
draw();

document.getElementById("infoClose").addEventListener("click", () => document.getElementById("infoModal").classList.remove("visible"));
document.getElementById("infoModal").addEventListener("click", (ev) => { if (ev.target.id === "infoModal") ev.currentTarget.classList.remove("visible"); });
