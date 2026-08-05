// Shared helpers for the PUBLIC entry pages (enter.html, feedback.html).
// The gated dashboard (app.js) keeps its own copy so the two stay decoupled -
// public forms will eventually POST to a backend; the dashboard only reads.
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
const money0 = (v) => "$" + Math.round(Number(v) || 0).toLocaleString();
function sectionHead(txt) { return el("h2", {}, T(txt)); }
function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
// current month as YYYY-MM (browser-local; fine client-side)
function currentYM() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function ymToLabel(ym) { if (!ym) return ""; const p = ym.split("-"); return (MONTH_NAMES[(+p[1]) - 1] || "") + " " + p[0]; }
// native month picker (calendar icon built in), defaults to the current month
function monthField(label, onChange) {
  const i = el("input", { type: "month", value: currentYM() });
  const apply = () => onChange(ymToLabel(i.value), i.value);
  i.addEventListener("input", apply);
  apply(); // seed the data model with the current month
  return el("div", { class: "field-row" }, [el("label", {}, T(label)), i]);
}
