# Release source reconciliation — October 7, 2026

## Purpose and scope

Bring GitHub `main` up to date with the application already published at `teamtracker.leftbraincreative.xyz`. Before this reconciliation, `main` was `40d9b0c`; the development branch `claude/dazzling-sagan-hxrwfp` was 30 commits ahead at `eaeea7c`, and additional release source remained uncommitted locally. This explains why a repository audit of `main` reviewed the retired coach implementation.

The existing PR #2 is the integration path. Its original prototype title and description need to describe the complete release before merge. The earlier planning/prototype commits are already ancestors of this branch; no independent experimental-branch merge is needed.

## Included work

- Current release entry point/configuration, coach attendance, durable offline queue, kiosk/PIN recovery, reports/exports, raffle operations, and shared protected administrator dashboard.
- Relevant tests, release/rehearsal documentation, and source-only backup/release helpers.
- Exact SQL for all three recorded production migrations, verified against remote history; see `supabase/migrations/README.md`.
- Corrected setup documentation, explicit release development/typecheck commands, and exclusions for generated output, local metadata, scratch scripts and archive artifacts.

The audit's recommended product changes remain separate work. In particular, this reconciliation does not automate offline preparation, change report freshness behavior, add History pagination, or alter purge notification policy. No database migration, Edge Function redeployment, account action, or email is required for this source merge.

## Release identity before reconciliation

The public release manifest identifies:

- `/assets/release-CAZ9Zqa2.js`
- `/assets/release-MDsUosnS.css`
- `/assets/SuperAdminDashboard-DNbUD_Ca.js`
- `/release.html`

The worker is `stage6-shell-18`. A build of the existing working source using the public release configuration reproduced those asset names and the main bundle SHA-256 `3488b36acefdd94bc071aeb551c6fd13d8dc104b1317c289174556a4cbeffc72`. Subsequent clean-checkout verification is recorded below before publication.

## Database provenance

Read-only remote migration records matched local recovered SQL exactly by character count and MD5:

| Version | Characters | MD5 |
| --- | ---: | --- |
| `20260930215729` | 99,174 | `d482b62bf1599b0febfa8f6fbb9ad76b` |
| `20261006023411` | 10,371 | `5e6f70404fb0193166c7672567ea0fba` |
| `20261007211057` | 2,703 | `8f99621a4a40f8eba10d667e47eb0010` |

The first two files were recovered from the private release records; only their reviewed migration SQL is included. Backups, data exports, manifests containing private records, environment files and credentials are excluded.

## Validation

Completed 2026-10-07 by Claude (Astra's session ran out of usage before this step) in a fresh clone of `claude/dazzling-sagan-hxrwfp` with the Mac working tree applied:

- `npm ci` from the committed lockfile: pass.
- `npm run typecheck`: pass.
- Full suite `npx vitest run`: **23 files / 134 tests pass.** Two legacy tests were repaired first; neither file is part of the release build:
  - `src/lib/stats.test.ts` failed to load because the legacy store imports the Supabase client, which needs env vars. The test now mocks that client.
  - `LaunchPage.test.tsx` used May 2026 fixture dates against a 30-day window, so it began failing in late June. The test now pins the date.
- `npm run release:build` with the public release configuration reproduced `/assets/release-CAZ9Zqa2.js`, SHA-256 `3488b36acefdd94bc071aeb551c6fd13d8dc104b1317c289174556a4cbeffc72`, identical to the live main bundle recorded above, plus `SuperAdminDashboard-DNbUD_Ca.js` and `release-MDsUosnS.css`.
- Staged changes were scanned for secret keys and passwords; none found. Generated output, `scratch/`, `supabase/.temp/`, `.DS_Store` and the archive were removed from tracking.

Tag: `release-2026-10-07`.
