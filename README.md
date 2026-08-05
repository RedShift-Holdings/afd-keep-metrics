# Keep Metrics (prototype)

A password-gated, non-indexed monthly metrics dashboard, built as an ASK System
offering. One deployment = one client engagement — the page never names the
client anywhere a search engine, browser tab, or shoulder-surfer could see it
before entering a password.

## Getting data from the client

`Dentrix Monthly Report Checklist.pdf` is what to hand the client (or their
staff) — it lists exactly which four Dentrix reports to run each month and
which Entry tab field each number goes into. The dividing line: anything
that's a single totals-row number goes in the form; the Timecard report
(tardiness/days-off) stays a raw-file handoff since it's per-punch detail
across dozens of rows, not something to hand-type.

## What's real vs. what's a placeholder right now

- **Real and working:** the encryption pipeline, the two-tier password model,
  both dashboards, the chart rendering, seeded with AFD's actual July 2026
  numbers (same data as the three PDF reports built this session).
- **Placeholder:** the two passwords below, and the CSV column mapping in
  `scripts/parse_csv_example.py` (we don't have a real export from AFD's
  practice-management system yet — swap in real headers the moment we do).
- **Not yet deployed anywhere.** This lives locally in `_prototypes/` until
  you've confirmed the security model and picked a real hosting target —
  see "Going live" below.

## The two-password model (why, not just how)

GitHub Pages (and static hosting generally) can't actually gate file access —
anyone with a direct URL to a JSON file can fetch it, no matter what a
password screen on `index.html` says. A password prompt in JavaScript alone
is a UI suggestion, not a lock.

So the actual protection here is **encryption, not a login check**: each
month's data is encrypted twice, once per audience, with two independent
passwords:

- `owner-view.json.enc` — the full detail (every provider, every aged claim
  by patient name, every employee's tardiness/attendance). Only the **doctor's
  password** derives the key that decrypts this.
- `team-view.json.enc` — department-level aggregates only. No named
  tardiness or absence call-outs, no per-patient claim detail. The **team
  password** derives a completely different key that can only ever decrypt
  this file — it mathematically cannot unlock the owner file, even if someone
  guesses at it.

The gate page has one password field. On submit, the site tries the owner
key first, then the team key; whichever one actually decrypts something
determines which dashboard loads. There's no role flag to spoof — the
boundary is "do you have a key that works," full stop.

**Current placeholder passwords** (change before anything real goes near
this): `owner-changeme-2026` and `team-changeme-2026`, set in
`scripts/build_seed_json.py` → `encrypt_data.py` invocation. Re-run
`encrypt_data.py` with real passwords before deploying.

## Pipeline (for now — no database)

1. Client sends a monthly report (ideally CSV; PDF works too, just slower to
   parse — see the AFD Timecard PDF parser from this session for the
   pdfplumber approach when CSV isn't available).
2. A parser script turns it into the shared JSON schema (see
   `scripts/build_seed_json.py` for the schema shape; `parse_csv_example.py`
   for the CSV-driven version once we have a real export to map columns
   from).
3. `scripts/encrypt_data.py` encrypts the owner and team payloads separately.
4. Commit `data/<client>/<yyyy-mm>/*.json.enc` — that's the entire "database"
   for now. `data/manifest.json` just lists which periods exist (plaintext,
   but only period labels like `2026-07`, nothing sensitive).
5. The dashboard reads whichever periods it can decrypt at page-load time —
   no build step, no server. Add a month, push, done.

## Two views

- **Owner** (`renderOwner` in `assets/app.js`) — everything: provider-level
  production/collections, full A/R aging, named aged insurance claims, labor
  hours, per-employee tardiness and days-off detail. Meant for the doctor
  only.
- **Team** (`renderTeam`) — practice-wide KPIs, production/collections by
  department, staffing hours, and time-off *totals* only (no names attached
  to lateness or absences). Meant to go up on a screen once a month without
  putting anyone on the spot individually.

## Local testing

```bash
python3 -m http.server 8744 --directory .
```

Then open `http://localhost:8744`. (A `.claude/launch.json` entry named
`keep-metrics` does this for you via the preview tooling.) Opening
`index.html` directly via `file://` will NOT work — the browser blocks
`fetch()` of local files under the `file://` origin, so a real (even local)
HTTP server is required.

## Going live — what's still a decision, not a default

- **Where to host.** Plain GitHub Pages works with the encryption model
  above (confidentiality survives even though the files are technically
  public). If real server-side access control is wanted instead of
  encryption-as-the-boundary, Cloudflare Pages + Cloudflare Access (still
  deploys from the same GitHub repo) is the stronger option — worth asking
  before picking.
- **Real passwords.** Replace both placeholders and re-encrypt before this
  touches anything live.
- **Team-member data entry.** The "ideal world" version — a team member logs
  in, fills in numbers, and saves — needs an actual backend (there's nowhere
  for a static site to write to). A small serverless form (Cloudflare
  Worker + KV, or a locked-down Google Form → Sheet → script pipeline) would
  be the next real piece of infrastructure, not something to fake with
  client-side JS.
