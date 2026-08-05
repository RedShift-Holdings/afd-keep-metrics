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
