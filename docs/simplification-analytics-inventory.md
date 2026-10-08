# Original analytics inventory and preservation recommendations

Investigated 2026-09-21. This is a source review and recommendation, not new implementation or approval of changed metric definitions.

## Evidence and scope

The original app still routes Reports to `src/app/components/SummaryPage.tsx`. Its report screen, `src/lib/stats.ts`, CSV module, leaderboard podium, player-detail component and PDF module are unchanged between pre-simplification baseline `40d9b0c` and this local checkout (`adcc727`). The isolated prototype's smaller Progress screen is not a full replacement for the old reports. No live production data or browser session was inspected. This investigation did not modify application code or rerun application tests.

## What exists and can be reused

| Existing feature | Source / behavior | Recommendation |
| --- | --- | --- |
| Report date filters | SummaryPage: 30, 90, 180 days and All | Keep; label archive/season scope accurately. |
| Overview tiles | Events, practice session-hours, optional session-hours, average regular-player practice attendance, guest appearances | Keep; distinguish session-hours from summed player-hours. |
| Coach insight cards | Highest practice attendance, longest best practice streak, lowest-attendance player / Needs follow-up | Keep with sample counts and honest empty/tie handling. No implication that optional-training absence requires follow-up. |
| Monthly trends | Area chart of session-hours and average practice attendance; shown after at least two months | Reuse chart and adapt calculations to canonical IDs/dates. Include years in cross-year labels. |
| Weekday breakdown | Practice attendance percentages and session counts by weekday, plus a below-average weekday callout | Keep as secondary detail; no start/end times needed. |
| Player comparisons | Attendance bar chart; sortable name, practice attendance %, practice hours, optional hours and current practice streak table | Keep and add approved jersey/membership display and team filters. |
| Individual practice history | Click a report row to show chronological present/absent squares for practices in the selected range | Keep; distinguish unknown eligibility from an actual absence. |
| Session log | Expandable latest 10 sessions, date/type/recorded hours/present count and Copy roster | Keep; show credited hours for new fixed-credit sessions. |
| CSV report | src/lib/csv.ts: player hours, practice attendance %, current/best streak and session log | Reuse; share data selection/calculation with on-screen reports. |
| Effort leaderboard | LeaderboardPodium: top three plus ranks 4–10, combined practice + training hours; mobile strip shows top five | Reusable. Recommend keeping it in Progress or behind optional expansion to retain a simple start screen. Rankings include paid training, so distinguish effort from practice consistency. |
| PDF export | SettingsPage renders ExportPdfDrawer; exportPdf.ts builds a print-ready report with selectable sections/date range/layout | Preserve the reachable Settings flow; independently verify output and align metric definitions before release. |
| Standalone player drawer | PlayerDetailDrawer.tsx exists but no current importing caller was found | Treat as a reusable design component, not a confirmed current feature. Reports already has the inline history described above. |

## Preserve useful features, repair old assumptions

1. **Names are currently identity keys.** Port joins and selections to stable player IDs; first name/number/team labels are display only. Multi-team membership must never duplicate a player/session credit.
2. **Practice percentage needs an expected-attendance denominator.** Current stats divide practices attended by every practice in the selected range for every current regular-roster player. New joiners or players from a different sub-team can therefore appear absent from sessions they were never expected to attend. Preserve available historical facts and mark unknown expectations; Stage 3 needs a representation for eligibility/snapshots. Do not invent past membership or approve session targeting implicitly.
3. **Report and PDF percentages differ.** Reports uses practice session counts; the PDF helper uses attended practice hours divided by available practice hours. For one attended one-hour practice and one missed two-hour practice, those are 50% and 33%. Fixed 1.5-hour new sessions hide this difference, but historical varied durations do not. Recommend explicit labels or a single approved shared definition, never silently changing history.
4. **All is not lifetime across archives.** SummaryPage reads `state.events`, while archived bundles are separate. Label the selected scope and add an explicit archive/lifetime choice if approved; do not claim archived attendance was included before.
5. **Insight cards are simple rankings.** Needs follow-up always picks the lowest-ranked player even when everyone attended, and streak labeling can imply a best streak is still running when a shorter current streak exists. Preserve the coaching questions, but fix misleading copy/empty/tie cases.
6. **Time is not required.** Dates, session type, recorded credit and attendance support all these analyses. New sessions use 1.5 hours and older ones retain their recorded durations. Same-date session ordering for streaks needs a stable tie-breaker, not a new time-entry requirement.
7. **Offline reports need a completeness label.** Distinguish locally finished, pending-sync records from synchronized records and incomplete cached history. Reconciliation must not count both copies. These are D09 adaptation requirements; the original analytics were not verified offline.

## Recommended path

- Retain the old Reports screen's capabilities as the Stage 6 preservation checklist under already-approved R11 (Keep analytics). Keep new Start Practice/Start Optional Training and kiosk flows simple.
- Before finalizing Stage 3, resolve expected-attendance/session-targeting policy and preserve the IDs, attendance facts, credit, historical membership/eligibility snapshots and pending-sync provenance needed by reports. Do not design only for the prototype's summary table.
- Stage 6 should adapt the reusable charts/components and CSV/PDF output to shared ID-based metrics rather than rebuild or drop them without review. Denominator changes, automatic follow-up rules, leaderboard placement and archive/lifetime selection above are recommendations awaiting review.
- Stage 7 should compare known historical examples against preserved metric definitions and explicitly test duplicate names, multi-team players, transfers/new joiners, retired players, different historical durations, optional-only attendance, date ranges and offline-to-synced deduplication.

No code, migration, deployment or publication was performed. Findings are source-confirmed; visual preference review and end-to-end verification remain future work.

## Subsequent owner decisions — D10–D12

The owner confirmed that different teams practice on different days and approved a Who’s expected? team-card step for practices. D10 now supplies saved expected-player sets for practice percentages/streaks. D11 confirms all prelaunch data is sample/test data; real-history reconstruction is unnecessary and no deletion is authorized. D12 confirms preserving the original rich analytics. Earlier requests in this inventory to resolve session targeting are superseded by D10; exception/excused-absence handling and exact presentation refinements remain recommendations. This inventory is included in the planning publication on Claude’s branch.
