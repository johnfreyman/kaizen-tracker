# First-launch coach client review — 2026-09-28

> Current status, 2026-10-07: The public-origin iPad feature checks passed and legacy attendance tables were retired after verified backup/restore. The retained superuser dashboard is now published with overview, account controls and canonical coach details; its authenticated browser check passed. Shell version is 18. See [the hosted release checkpoint](simplification-hosted-release-checkpoint.md). The review below records the earlier local candidate and its original gates.

## Current result

The iPad rehearsal used `/stage4.html`, which is wired to the isolated test project and test-coach sign-in. The repository's ordinary `npm run build` still produces the older prototype. Neither output is an appropriate first-launch coach app.

A separate `stage4-release` build now produces the new coach app at both `/` and `/release.html` with normal email/password sign-in. It requires the exact intended production Supabase URL and a publishable key at build time; the example environment file contains only a placeholder. The release build has its own IndexedDB, Auth storage key, service worker and offline cache namespace. Its output excludes the test service worker, test project address, test-coach selector and browser fault controls. This is a **local release client candidate**, not a deployment or a successful production sign-in.

Build for review with `npm run release:build` after supplying the current publishable key privately through the build environment. The build checks the key prefix and project URL, but only an actual sign-in can establish that the key works. Keep the default deployment build and branch deployment guard unchanged until the database and release checks below pass. The release bundle embeds the public project URL and publishable key by design; never supply a service-role key.

## Verification

- TypeScript check passed; all 58 focused coach app tests passed, including release cache-version and network-boundary checks.
- The isolated `stage4-test` and `stage4-release` builds both completed in separate temporary output directories.
- The release output contains `index.html`, `release.html`, the release asset list, application assets and `sw-release.js`; it does not contain `sw-stage4.js`. The release asset list names the release page and assets.
- A local browser check with a deliberately nonworking publishable key showed the normal email and password form. No production sign-in or write was attempted.
- The release build rejected a missing key, the example's placeholder key and a test-project URL. Static output inspection found no isolated project address, test-coach choice, test storage name or fault-control label in the application bundle. The test build still retains its test controls.
- The offline release cache name matches the current shell version (`kaizen-release-stage6-shell-17`). Real release-origin offline preparation has not been exercised.

## Remaining launch gates

1. Database preparation is complete for the exported schemas and records: the [actual export/restore rehearsal](simplification-restored-release-rehearsal.md) passed the exact migration, repeat application and legacy retirement, with owner/admin/raffle/purge checks. The private database and four Storage-file backups are verified. Prepare the guarded release runner and refresh the recovery point if live state changes; hosting/Auth configuration recovery remains separate.
2. Run the reviewed migration and post-apply role/admin/purge checks in an authorized release window. No production SQL or scheduled job has been changed.
3. Verify this release build with a real authorized coach and administrator in an appropriate nonproduction environment, then complete release-origin iPad preparation, offline attendance, sync, kiosk exit, reports, raffle and update recovery. The physical iPad **test-build** update and offline recovery already passed; it does not prove the release-origin build.
4. Check the remaining targeted Stage 7 partial cases, especially natural sign-in expiry, actual storage failures, concurrent devices, team controls on the iPad, and phone/accessibility behavior. Decide which are launch blockers before publication.
5. Configure the eventual host to use `release:build`, review the output and rollout/forward-fix plan, and only then enable deployment. The current branch remains deployment-disabled in `vercel.json`.

The owner has selected an [in-place, single-project cutover](simplification-single-project-cutover.md): keep the existing Kaizen Tracker project, retire its old attendance tracker after verified launch, and delete the temporary Stage 3 Test project last.

No production schema, data, user account, hosting configuration or deployed app changed in this review. The release client changes remain local and uncommitted.
