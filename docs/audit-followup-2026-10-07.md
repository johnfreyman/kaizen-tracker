# Audit follow-up — October 7, 2026

Work on the [October 7 audit](attendance-tracker-audit-2026-10-07.md), done by Claude after Astra's session ran out of usage. The table records the original staged branches. The October 8 continuation combines their changes and the Roster panels from PR #4 in PR #3; see [the combined release record](combined-release-2026-10-08.md). PR #2 is already merged.

| Order | Item | Branch | Production state |
|---|---|---|---|
| 1 | A1 Git matches the live release | `claude/dazzling-sagan-hxrwfp` (PR #2) | Source only. The release build is byte-identical to the live bundle. **Owner must merge PR #2 and push tag `release-2026-10-07` (commit `4d18e9b`).** |
| 2 | A2 Purge reminders not delivered | `claude/a2-pause-purge` | **Applied** with owner approval: migration `20261007232052` paused the `process-purge-lifecycle` cron job. Function, state and admin actions are unchanged. |
| 3 | A4 + A5 Automatic setup, safe updates | `claude/a4-a5-auto-prepare` | Not deployed. |
| 4 | A3 Report freshness | `claude/a3-report-freshness` | Not deployed. |
| 5 | A6–A9 History, recovery, navigation, admin hardening | `claude/a6-a8-history-recovery-nav` | Not deployed. The admin function change needs `supabase functions deploy admin-coach-actions`. |

## What changed

- **A4:** The device sets itself up after sign-in, after an app update and when the connection returns. Roster and Reports show loading states, and the PIN shows "not loaded" instead of 0000. Settings keeps "Refresh offline copy" for recovery.
- **A5:** Refreshing while changes wait to upload now also saves the new app shell. If shell caching fails, the old shell and the queue stay as they were.
- **A3:** Upload time and server-download time are separate. History downloads on start, on focus, when the connection returns and after an upload, at most once a minute. Reports has **Refresh history**, and CSV/PDF say "History last downloaded from server".
- **A6:** History has type and date filters, shows 20 at a time with "Show 20 more", and sorts newest first. Reports' recent sessions link to the correction screen.
- **A7:** A blocked change shows the action, session, player and requested value, the saved version and a plain reason. The choices are **Keep my change** and **Use saved version**, which states how many changes it removes. Raw codes and payloads moved under "Technical details".
- **A8:** The page is kept in the URL hash, so reload and Back work. The nav has `aria-current`, the report table headers have `aria-sort`, and the team-name input has a label.
- **A9:** The unused `view-as-coach` magic-link action is removed. CORS now echoes only the coach app origin and localhost dev ports.
- The shell version is `stage6-shell-19`.

## Verification

Typecheck passes, 143/143 tests pass (new tests cover each item above) and the release build passes. None of this was run on a physical iPad. Before deploying, repeat the iPad checks: sign-in auto-setup, offline Practice, reopen, sync, a second device's session appearing in Reports, and an app update with a pending change.

## Not done

- Real email delivery for purge reminders. The job stays paused until that exists.
- Dependency cleanup and removal of the legacy app files (audit A9/16). Prove that the files are unused first.
- Supabase leaked-password protection needs the Pro plan.
