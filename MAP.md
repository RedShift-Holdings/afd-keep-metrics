# Keep Metrics — build map (where this lives)

Design decision (Glenn): **entry is public, results are gated.** The forms are
links you send people; nobody logs in to submit. The reports live behind the
password wall. That split also resolves the static-site key problem — a person
entering numbers never touches an encryption key.

## Three surfaces

| Surface | Gated? | File(s) today | Who |
|---|---|---|---|
| **Monthly Numbers** (wizard) | Public link | `enter.html` + `assets/entry-app.js` | Management / financial lead |
| **Team Check-In** (WIN: work + culture, ALIGN/SHIFT/KEEP) | Public link | `feedback.html` + `assets/feedback-app.js` | Every team member |
| **Reports** (financial + team health, 3 tiers) | Password wall | `index.html` + `assets/app.js` | Admin / Manager / Team |

Right now the two public forms **download a JSON file** on submit (honest
prototype stand-in). The reports read committed encrypted payloads. The only
thing between "prototype" and "product" is the **backend** that catches a
submission and publishes it.

## The one missing piece: a submit endpoint

A public form needs somewhere to POST. Options, cleanest first for AFD since the
site is WordPress:

1. **WordPress REST endpoint (recommended).** A small companion plugin exposes
   `POST /wp-json/keep-metrics/v1/submit`. It receives the form JSON, stores it,
   and either (a) writes the encrypted `.enc` tiers into the repo via a GitHub
   action, or (b) serves them from WP directly. Encryption keys live server-side
   in WP config — never in the browser.
2. **Cloudflare Worker + KV/R2.** Same idea, serverless; the Worker holds the
   keys and publishes the static payloads. Good if we move hosting off Pages.
3. **Interim, zero-build:** Google Form → Sheet → a scheduled script that
   encrypts + commits. Ugly but works this month with no code.

Only the forms' **submit action** changes (download-JSON → `fetch(endpoint)`);
everything else the prototype already does is the real front end.

## FE shortcodes on the website

The prototype's front-end files are the shortcode payload as-is. A companion WP
plugin registers:

- `[km_entry client="afd"]`   → enqueues `entry-app.js`, drops the wizard
- `[km_checkin client="afd"]` → enqueues `feedback-app.js`, drops the check-in
- `[km_dashboard client="afd"]` (optional) → iframes/links the gated reports

Then the pages on redshiftconsulting.co:

- **`/afd-team-meeting-preparation/`** = the launcher / monthly agenda. Links to:
  the Team Check-In (sent to all staff), the Monthly Numbers form (sent to the
  financial lead), and the gated Reports. It is the human ritual page, **not** a
  second copy of the data.
- A management-only page carrying `[km_entry]`.
- An all-staff page carrying `[km_checkin]`.

`client="afd"` on the shortcodes is what makes this reusable per client — same
plugin, different client code, different data folder + passwords.

## Data flow (target state)

```
 Dentrix reports ──► Monthly Numbers form ─┐
                                           ├─► submit endpoint ─► encrypt 3 tiers ─► publish
 Team members ─────► Team Check-In form ───┘         (WP/CF)         (server-side)      │
                                                                                        ▼
 Doctor ──────────► Timecard export (attendance) ─► parser ─────────────────────►  Gated Reports
                                                                                   (admin/manager/team)
```

**MIA end state:** MIA ingests the raw Dentrix + timecard exports directly
(parsing patterns already proven this session), populates the numbers, and
publishes on a schedule — the Monthly Numbers form becomes optional, used only
for by-hand corrections.

## Month-over-month (the "showing progress" piece)

The data model is already per-period (`data/<client>/<yyyy-mm>/`). The reports
show one month. The unlock for *trends* is loading a **second month** (e.g.
June) so a Trends view has two points to plot — production, collection rate,
on-time rate, goal attainment over time. That's the next report-side build once
a second month of data exists.

## Two health axes → one progress picture

- **Financial health** — Monthly Numbers → Financial tab.
- **Team health** — Timecard (attendance) + Team Check-In (culture) → Team
  Health tab. The check-in is the qualitative half; attendance the quantitative.

Tracked monthly, together they are the "personal & performance master plan."
The ss-team check-in system already runs for AFD (14 employees); this Team
Check-In form is the ASK-monthly WIN report — keep them coordinated (the raw
pulse can stay in ss-team; Keep Metrics shows the rolled-up group picture).
