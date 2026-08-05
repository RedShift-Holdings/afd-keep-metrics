// PUBLIC monthly team check-in / WIN report. No login: a link sent to every team
// member. Work + culture, framed on the ASK ALIGN / SHIFT / KEEP vocabulary.
// Submitting produces a feedback file; the live build POSTs it to the backend,
// which rolls responses into the gated Team Health / Culture view (group-level,
// no names on the team screen). See MAP.md.

const DEPTS = ["Dentists", "Dental Hygienists", "Dental Assistants", "Front Office", "Key Leaders"];
const resp = { client: CLIENT, type: "team-checkin", name: "", dept: "", cultureRating: 0, align: "", shift: "", keep: "", wins: "", challenges: "", period: "" };

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
function rating(label, key) {
  const wrap = el("div", { class: "rating" });
  let val = 0;
  const dots = [];
  for (let n = 1; n <= 5; n++) {
    const dot = el("button", { type: "button", class: "rating-dot" }, T(String(n)));
    dot.addEventListener("click", () => { val = n; resp[key] = n; dots.forEach((dd, i) => dd.classList.toggle("on", i < n)); });
    dots.push(dot); wrap.appendChild(dot);
  }
  return el("div", { class: "field-row" }, [el("label", {}, T(label)), wrap, el("div", { class: "rating-scale" }, T("1 = struggling · 5 = thriving"))]);
}

form.appendChild(sectionHead("About You"));
form.appendChild(el("div", { class: "field-grid" }, [
  monthField("Reporting Month", (label, ym) => { resp.period = label; resp.periodKey = ym; }),
  text("Your Name (required)", "name", "First and last"),
]));
form.appendChild(select("Your Team", "dept", DEPTS));

form.appendChild(sectionHead("How's It Going"));
form.appendChild(rating("How connected & supported do you feel this month?", "cultureRating"));
form.appendChild(area("WINS — what went well this month? (work or culture)", "wins", "A win, a proud moment, something that clicked…"));
form.appendChild(area("CHALLENGES — what got in the way?", "challenges", "A frustration, a blocker, something that drained you…"));

form.appendChild(sectionHead("ALIGN · SHIFT · KEEP"));
form.appendChild(area("ALIGN — what should we all get on the same page about?", "align", ""));
form.appendChild(area("SHIFT — what should we change or do differently?", "shift", ""));
form.appendChild(area("KEEP — what's working that we should protect and keep doing?", "keep", ""));

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
