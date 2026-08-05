# Keep Metrics

A password-gated, non-indexed monthly metrics dashboard, built as an **ASK
System** offering. It reports on **two things — financial health and team
health** — for a single client. One deployment = one client engagement; the
page never names the client anywhere a search engine, browser tab, or
shoulder-surfer could see before a password is entered (`robots.txt`
disallow-all + `noindex`, generic `<title>Keep Metrics`).

Live (AFD): **https://redshift-holdings.github.io/afd-keep-metrics/**

## Three roles

| Role | Sees | Does |
|------|------|------|
| **Admin** (doctor) | Everything: financials, per-employee team health, days off | **Sets goals & baselines** (Settings tab) |
| **Manager** | Same reports as admin, minus goal-setting | **Enters the month's numbers** (Entry wizard) |
| **Team** (view-only) | Goal-vs-actual + on-time rate *by department* — no names | Nothing; it's the breakroom screen |

Each role is a **separately-encrypted payload with its own password**
(`admin-view.json.enc`, `manager-view.json.enc`, `team-view.json.enc`). The
security boundary is *which key decrypts*, not a client-side role flag — a team
password mathematically cannot open the manager or admin file. The gate tries
admin → manager → team and loads the richest view that decrypts.

Why encryption is the boundary: static hosting can't gate file access — anyone
with a direct URL to a `.json` file can fetch it. A JS password prompt is a UI
suggestion, not a lock. Encrypting each tier separately *is* the lock.

## Entering numbers — the wizard (Entry / Upload tab)

Managers (and admin) get a 5-step wizard: **Performance → A/R Aging → Patients
& Add-Ons → Providers → Review & Save**. Fill it from the Dentrix report totals
(click the ⓘ for which reports), or upload a provider CSV on the Providers
step. **Save** updates the report immediately — no passwords, no key handling.

Save writes the edited numbers to the browser's local storage (so the report
reflects them right away on that machine) **and** downloads a plain
`afd-<period>-numbers.json` file. That numbers file is the hand-off for
*publishing* — see the data path below. This keeps the manager's job simple:
type numbers, click Save. Keys and encryption never touch their screen.

> Prototype limit: local-storage Save reflects only on the machine that entered
> it. Publishing to the live site for *everyone* is the server/MIA step below,
> not something a static page can do on its own.

## Data path — now → near-term → MIA

**The `Dentrix Monthly Report Checklist.pdf`** tells the client which reports to
run. The dividing line: a single totals-row number goes in the wizard; the
Timecard report (attendance) stays a raw-file hand-off (per-punch detail across
dozens of rows — parsed, not hand-typed; tardiness also comes from the doctor).

1. **Now (prototype):** manager runs Dentrix reports → types totals into the
   wizard → Save → sends us the `numbers.json` (and the raw Timecard export) →
   we run `scripts/build_seed_json.py` + `scripts/encrypt_data.py` and commit
   the `.enc` files.
2. **Near-term (low-touch):** manager drops the Dentrix exports into an intake
   (upload form / email / Drive folder). A small serverless endpoint holds the
   keys, parses the totals, re-encrypts all three tiers server-side, and
   publishes. The manager submits raw reports and never types a number or a key
   — which also dissolves the static-site problem that a manager can't
   re-encrypt tiers they don't hold keys for.
3. **Future (MIA):** MIA ingests the raw Dentrix exports directly (she already
   has the parsing patterns from this build — pdfplumber for the Timecard PDF,
   totals-row extraction for the A/R reports), populates the numbers, regenerates
   the encrypted payloads, and publishes on a schedule. Fully hands-off.

The through-line: **entry stays dead simple; publishing moves server-side.**
Steps 2–3 are the "real backend" that the prototype's honest limits point to.

## Team health → performance master plan

The Team Health tab turns attendance into a **per-employee scorecard** (on-time
%, late count, lunch overages, worst instance) against the real policy — not a
statistical guess. Policy: scheduled start 7:50 AM, late after 8:10 AM (20-min
grace), 60-min lunch, on-time goal 95%; part-time / non-standard staff are
excluded. Tracked monthly, this trends into a per-person performance picture.
Paired with the ss-team **check-ins** (the qualitative half), the two together
are the "personal & performance master plan" — quantitative attendance +
qualitative check-in. (The ss-team integration itself lives in that repo, not
here.)

## Files

- `index.html` — gate + info modal
- `assets/app.js` — login, the three render paths (`renderFull` for admin/
  manager, `renderTeam`), the Entry wizard, `buildPayloads` (derives all three
  tiers from one edited object)
- `assets/crypto.js` — Web Crypto decrypt/encrypt, mirrors `encrypt_data.py`
- `assets/style.css` — the visual system (squared, white cards, colored
  accents, underline tabs, rate chips)
- `scripts/build_seed_json.py` — assembles the three payloads + `goals.json`
  from verified figures (+ `recomputed_tardiness.json`, gitignored — it holds
  plaintext names/times and must never be committed)
- `scripts/encrypt_data.py` — PBKDF2-SHA256 (200k) → AES-GCM-256 per tier
- `scripts/parse_csv_example.py` — placeholder CSV→providers mapping (swap for
  real Dentrix export headers when we have one)
- `data/<client>/<yyyy-mm>/` — the encrypted payloads + plaintext `goals.json`
  (a target/policy value discloses no actual performance, so goals stay
  unencrypted and the team screen can read them)

## Passwords

Real passphrase-style passwords are set at encrypt time and live only in the
handoff to Glenn — never written into a file in this repo. Rotate by re-running
`encrypt_data.py` with new values. (The old `*-changeme-*` placeholders are
retired.)

## Local testing

```bash
python3 -m http.server 8744 --directory .
```

Open `http://localhost:8744`. Opening `index.html` via `file://` will NOT work
— the browser blocks `fetch()` of local files, so a real (even local) HTTP
server is required. A `.claude/launch.json` entry named `keep-metrics` starts
this for the preview tooling.

## Hosting note

Live on GitHub Pages (public repo — a private repo's Pages output is visible
only to GitHub collaborators, which would lock out the doctor/staff who only
ever get a password). Confidentiality survives the public repo because
encryption, not repo secrecy, is the boundary. Cloudflare Pages + Access is the
stronger option if real server-side gating is ever wanted — and it's the
natural home for the step-2/3 backend above.
