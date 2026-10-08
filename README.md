# Kaizen Tracker

Team attendance, offline iPad check-in, roster management, reports, raffles, and a protected administrator dashboard.

The production app is [teamtracker.leftbraincreative.xyz](https://teamtracker.leftbraincreative.xyz/). Its entry point is `release.html`, which loads `src/stage4/main.tsx` and `CoachApp.tsx`. The `stage4` directory name is historical: it contains the current production coach application. `src/app/components` also contains the shared administrator dashboard.

## Run the current app

Use Node.js 24 (the Vercel project runtime) and the committed npm lockfile.

```sh
npm ci
cp .env.stage4-release.example .env.stage4-release.local
```

Set `VITE_SUPABASE_ANON_KEY` in that ignored local file to the retained project's publishable key. The project URL is supplied in the example. Never use a service-role or secret key in a browser build.

```sh
npm run release:dev
```

Open `/release.html` when using the development server. This release configuration connects to the retained production Supabase project, so actions in the app affect real data. Tests below use mocked APIs and local fixtures. The former Stage 3 test project was deleted; `stage4:dev` and `stage4:build` preserve its historical test mode and cannot sync to that deleted backend.

The default `npm run dev` and `npm run build` still select the legacy app. Use the explicit `release:*` commands for current work. `src/prototype` and legacy coach pages are historical references, not the deployed coach workflow.

## Verify and build

```sh
npm run typecheck
npm test -- --run
npm run release:build
```

The release build creates `dist/index.html`, `dist/release.html`, the hashed app/admin assets, `release-assets.json`, and `sw-release.js`. Generated `dist` files are not versioned. The release excludes fault-injection controls and uses separate browser storage from historical test mode.

## Database and deployment

See [the database release history](supabase/migrations/README.md). The three timestamped migrations match SQL already applied to the retained project. They document an upgrade from a pre-existing database, not a complete fresh-project bootstrap. Do not rerun them, run old `migrations/` SQL, or blindly push database changes to production.

Vercel uses `npm run release:build`, output directory `dist`, and the production environment's publishable configuration. The project is linked to this repository. Treat a merge to `main` as a possible production deployment. Database migrations and the `admin-coach-actions` Edge Function are separate releases; a frontend Git deployment does not apply them.

Commit reviewed release source, push a PR, verify its checks, and merge before considering GitHub up to date. Record any manual publication against its source commit. Private backups, Auth exports, environment files, and local Supabase metadata belong outside Git.

## Review context

- [October 7 audit](docs/attendance-tracker-audit-2026-10-07.md): current findings and disposition of the older Claude audit. Audit recommendations are not implemented by the release-source reconciliation.
- [Hosted release checkpoint](docs/simplification-hosted-release-checkpoint.md): publication, database retirement, and device-check evidence.
- [Release source reconciliation](docs/release-source-reconciliation-2026-10-07.md): source and migration provenance, verification, and scope.
- [Simplification specification](docs/simplification-spec.md): product decisions and offline behavior.

For future audits, identify the exact commit, read this release entry-point map, and distinguish historical SQL and prototype screens from current production code.
