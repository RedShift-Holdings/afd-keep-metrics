// PUBLIC monthly team check-in / WIN report. No login: a link sent to every team
// member. Work + culture, framed on the ASK ALIGN / SHIFT / KEEP vocabulary.
// Submitting produces a feedback file; the live build POSTs it to the backend,
// which rolls responses into the gated Team Health / Culture view (group-level,
// no names on the team screen). See MAP.md.
//
// QUESTIONS MIRROR THE LIVE ss-team CHECK-IN (do NOT reinvent).
// The six agree-scale items + the two free-text prompts below are the exact
// EMPLOYEE self-side ("their six" + "in their words") of the ASK check-in that
// AFD already runs in ss-team (theasksystem.com, SSI group_id=6, 14 employees).
// Verbatim source: ss-team/includes/class-sst-checkin-questions.php::defaults()
// (self side) and class-sst-checkin-templates.php (q16/q17 note fields).
// The manager-scored "your six" side is deliberately NOT here — that is a
// private, scored, quarterly sit-down inside ss-team, not a public monthly link.

const DEPTS = ["Dentists", "Dental Hygienists", "Dental Assistants", "Front Office", "Key Leaders"];

// The six self-side agree-scale items, verbatim from the live ss-team instrument.
// axis "me" = about the person · "office" = about the shop (ss-team's own split;
// office-side items are the culture/experience signal, ss-team group:experience).
const QUESTIONS = [
  { key: "q1", axis: "me",     tag: "How I showed up",         text: "I brought my best to this month — caring, curious, coachable — and I can point to real moments." },
  { key: "q2", axis: "me",     tag: "What I did with feedback", text: "The last feedback I got, I actually did something about it within the week." },
  { key: "q3", axis: "me",     tag: "My wins",                 text: "I know what a good week looks like in my job — and I’m having them." },
  { key: "q4", axis: "office", tag: "The people leading",      text: "The people running this place live the same values they ask of me." },
  { key: "q5", axis: "office", tag: "Being heard",             text: "When I raise a problem, something actually happens." },
  { key: "q6", axis: "office", tag: "Staying",                 text: "I can see myself here a year from now." },
];

const resp = {
  client: CLIENT, type: "team-checkin", name: "", dept: "", period: "", periodKey: "",
  scores: { q1: 0, q2: 0, q3: 0, q4: 0, q5: 0, q6: 0 },
  own: "",        // "One thing you’ll own this month"       (ss-team q16, employee note)
  startStop: "",  // "…start — or stop — doing"              (AFD group spec free-text 2)
  win: "",        // optional WIN-report note (Keep Metrics monthly WIN report add-on)
  questions: QUESTIONS.map(q => ({ key: q.key, tag: q.tag, text: q.text })), // snapshot
};

const root = document.getElementById("feedbackRoot");
const form = el("div", { class: "entry-form public-form" });

function text(label, key, ph) {
  const i = el("input", { type: "text", placeholder: ph || "" });
  i.addEventListener("input", () => resp[key] = i.value);
  return el("div", { class: "field-row" }, [el("label", {}, T(label)), i]);
}
function area(label, key, ph) {
  const t = el("textarea", { placeholder: ph || "", rows: "3" });
  t.addEventListener("input", () => resp[key] = t.value);
  return el("div", { class: "field-row" }, [el("label", {}, T(label)), t]);
}
function select(label, key, opts) {
  const s = el("select", {}, [el("option", { value: "" }, T("Select…")), ...opts.map(o => el("option", { value: o }, T(o)))]);
  s.addEventListener("change", () => resp[key] = s.value);
  return el("div", { class: "field-row" }, [el("label", {}, T(label)), s]);
}
// 1–5 agree scale for one check-in item. Writes into resp.scores[key].
function scaleRow(q) {
  const wrap = el("div", { class: "rating" });
  const dots = [];
  for (let n = 1; n <= 5; n++) {
    const dot = el("button", { type: "button", class: "rating-dot" }, T(String(n)));
    dot.addEventListener("click", () => { resp.scores[q.key] = n; dots.forEach((dd, i) => dd.classList.toggle("on", i < n)); });
    dots.push(dot); wrap.appendChild(dot);
  }
  return el("div", { class: "field-row" }, [
    el("label", {}, T(q.text)),
    wrap,
    el("div", { class: "rating-scale" }, T("1 = Not really · 5 = Absolutely")),
  ]);
}

form.appendChild(sectionHead("About You"));
form.appendChild(el("div", { class: "field-grid" }, [
  monthField("Reporting Month", (label, ym) => { resp.period = label; resp.periodKey = ym; }),
  text("Your Name (required)", "name", "First and last"),
]));
form.appendChild(select("Your Team", "dept", DEPTS));

// ── The six (mirrors the live ss-team self-side instrument) ──
form.appendChild(sectionHead("How I’m doing"));
QUESTIONS.filter(q => q.axis === "me").forEach(q => form.appendChild(scaleRow(q)));

form.appendChild(sectionHead("How I am treated"));
QUESTIONS.filter(q => q.axis === "office").forEach(q => form.appendChild(scaleRow(q)));

// ── In their words (ss-team employee note fields) ──
form.appendChild(sectionHead("In your words"));
form.appendChild(area("One thing you’ll own this month", "own", "The one thing you’re taking on…"));
form.appendChild(area("One thing you wish the practice would start — or stop — doing", "startStop", ""));
form.appendChild(area("A win worth sharing this month (optional)", "win", "A proud moment, something that clicked — work or culture…"));

const status = el("div", { class: "save-status" });
const btn = el("button", { class: "primary-btn" }, T("Submit Check-In"));
btn.addEventListener("click", () => {
  if (!resp.period.trim() || !resp.name.trim() || !resp.dept) { status.style.color = "var(--red)"; status.textContent = "Please add the month, your name, and your team."; return; }
  downloadJSON(resp, `${CLIENT}-${(resp.periodKey || resp.period).replace(/\s+/g, "-").toLowerCase()}-checkin-${resp.name.replace(/\s+/g, "")}.json`);
  root.innerHTML = "";
  root.appendChild(el("div", { class: "done-card" }, [
    el("div", { class: "done-check" }, T("✓")),
    el("h2", {}, T("Thank you")),
    el("p", {}, T("Your check-in is recorded. (Prototype: a file downloaded for hand-off; the live build posts it to leadership and rolls into the group picture — never your name on the team screen.)")),
  ]));
});
form.append(btn, status);
root.appendChild(form);
