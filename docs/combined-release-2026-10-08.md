# Combined audit follow-up and Roster panels — October 8, 2026

PR #3 now includes Claude's A2–A9 implementation, the two collapsible Roster panels from PR #4, and a correction to automatic history download. PR #2 is already merged. Merge PR #3 to publish the combined frontend; a separate merge of PR #4 is unnecessary because its commits are included in the combined branch.

## Additional correction

The original post-upload refresh ran while the upload guard was still active and returned without downloading. The refresh now starts after that guard is released. Reconnecting with no queued changes also downloads history. Snapshot refresh acquires the shared guard before reading storage; automatic setup waits while upload or refresh is running. Only a successful history download advances its throttle timestamp.

## Validation

- TypeScript check passed.
- All 145 tests in 24 files passed under Node 24.19.0, including two component regressions for post-upload and empty-queue reconnect downloads, and all 19 admin handler tests.
- The release build passed using the designated project URL and a placeholder publishable key for build validation. This local build is not a production artifact. Vercel builds the pushed source with its configured environment.
- The shell's Node 26.8.1 runtime caused two existing prototype kiosk tests to report localStorage failures. The full suite passed under Node 24 without changes to those tests.
- Fresh physical iPad and real two-device checks are still pending. Mocked handler tests do not establish live admin operation or email delivery.

## Supabase function deployment

Deploy only the updated `supabase/functions/admin-coach-actions/index.ts` from this combined branch or the merged main checkout. The existing production function is version 8 with JWT verification enabled; keep JWT verification enabled.

From the updated repository root, authenticate and deploy:

```sh
npx supabase login
npx supabase functions deploy admin-coach-actions --project-ref pwgqwcvultxihntvaewo --use-api
```

The explicit project reference selects the retained Kaizen Tracker project; `--use-api` bundles on the server without Docker. No `--no-verify-jwt` flag is used. The deployment preserves the JWT/admin checks, removes the unused impersonation action, and restricts browser CORS to the published app and listed localhost origins.

After deployment, confirm the Admin dashboard loads from the public website, and check coach details. Unsigned function requests must still return 401. The purge-pause migration is already applied; no database push is needed for this release. Real reminder emails and dependency/unused-file cleanup remain unfinished.

[Supabase deployment documentation](https://supabase.com/docs/guides/functions/deploy).
