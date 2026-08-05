# Keep Metrics — next builds (handoff)

Live: https://redshift-holdings.github.io/afd-keep-metrics/ · repo:
RedShift-Holdings/afd-keep-metrics · full context in the memory file
`keep-metrics-ask-system-initiative.md`. Architecture in `MAP.md`.

Passwords (in Glenn's hands, not in repo): admin `maple-jasper-orbit-horizon-cobalt-14`
· manager `lagoon-granite-ridge-summit-forge-11` · team `violet-umber-quartz-glacier-nectar-97`.

## Done to date
Three-tier gated reports (admin/manager/team, separately encrypted) · real
tardiness policy (7:50/8:10, 60-min lunch) with per-employee on-time %
scorecard · Key Leaders (Leny A / Sammie R) examined separately from DAs ·
public entry as links (enter.html numbers wizard, feedback.html team check-in),
results gated · month picker + required names on both forms · KEEP capitalized.

## Next builds, in order

1. **History → Trends view.** Glenn is emailing Kori (main1@afdnsb.com) for
   May/Jun 2026 + the back-catalog (~11 months exist Aug 2025→Apr 2026, same
   5-file set). Gmail tools can't download attachments — they must land in
   Drive `_clients/AFD/Reports/<yyyy-mm>/` (same as July). Then: parse each
   month → Keep Metrics period → build a month-over-month Trends view
   (production, collections, collection rate, on-time, new patients, goal
   attainment). This is the "showing progress" piece. Data-model is already
   per-period; only the Trends UI + the per-month parse are new.

2. **Align Team Check-In questions with the existing ASK electronic check-ins.**
   Do NOT reinvent the feedback questions. AFD already runs the ASK check-in in
   ss-team ([[afd-team-group-checkin]] LIVE, 14 employees; question format in
   [[ask-checkin-sheet-format]] and [[checkin-format-config-refinement]] "v11").
   Decide: does feedback.html mirror those questions, or does it just link to
   the live electronic check-in? Leverage what exists. NEEDS ss-team context —
   read the check-in memories / the ss-team repo first.

3. **Submit backend (MAP.md step 2).** Turn the two forms from download-JSON
   into real submissions: WP REST endpoint (recommended — site is WordPress) or
   Cloudflare Worker that holds keys server-side, encrypts the 3 tiers, and
   publishes. Then wrap as WP shortcodes `[km_entry]` / `[km_checkin]`. This is
   what makes "entry is a link, results gated" real.

4. **Launcher page** = redshiftconsulting.co/afd-team-meeting-preparation/ —
   links to the two forms + gated reports; the monthly meeting agenda. Not a
   second copy of the data.

5. **Converge into ss-team** (Glenn's end-state: "move all of this to team").
   Keep Metrics is the proving ground; the Progress/KEEP module lives in ss-team
   with Mia ingesting Dentrix/timecard/check-in inputs. Per
   [[stay-in-module-thread]] this is a spawned ss-team session, not this repo.

## Data corrections pending
- Real **July new-patient count** (July Reports email body was empty; using
  placeholder 34).
- **Collections goal**: Kori's May-2025 email said **$233,000**; tool has $250K.
  Confirm current.
- Load **May/Jun 2026** once Kori sends.
