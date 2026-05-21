# Database Migrations

## Run order

Run these files in the Supabase dashboard — **SQL Editor → New query → paste → Run** — one at a time, in order.

| # | File | Description |
|---|------|-------------|
| 1 | `001_schema.sql` | All application tables, indexes, per-coach RLS, and storage bucket |
| 2 | `002_super_admin.sql` | Profiles table, new-user trigger, super_admins table, read-all policies |

**001 must complete successfully before running 002.** Migration 002 creates policies that reference the tables built in 001. If 001 has errors, fix them before proceeding.

Every statement is idempotent (`IF NOT EXISTS`, `DROP … IF EXISTS`, `ON CONFLICT … DO NOTHING`), so any migration can be re-run safely without side effects.

---

## What each migration creates

### 001_schema.sql

**Tables**

| Table | Key constraint | Purpose |
|-------|---------------|---------|
| `team_settings` | `UNIQUE (coach_id)` | One settings row per coach |
| `roster` | `UNIQUE (coach_id, name)` | Players per coach |
| `events` | `TEXT PRIMARY KEY` (client UUID) | Saved session records |
| `active_session` | `UNIQUE (coach_id)` | At most one in-progress session per coach |
| `archived_event_sets` | `TEXT PRIMARY KEY` (client UUID) | Archived event bundles |

**Indexes** (in addition to PK and UNIQUE indexes created automatically)

| Index | Columns | Supports |
|-------|---------|---------|
| `idx_events_coach_saved_at` | `(coach_id, saved_at DESC)` | Event list ordered newest-first |
| `idx_roster_coach_id` | `(coach_id)` | Roster list scans |
| `idx_archived_sets_coach_archived_at` | `(coach_id, archived_at DESC)` | Archive list ordered newest-first |

**RLS** — every table uses a single `FOR ALL` policy: `coach_id = auth.uid()`. No row is visible or writable unless it belongs to the authenticated user.

**Storage** — creates the public `team-assets` bucket. Write policies are path-scoped to `logos/<uid>/` so a coach can only modify their own uploads. Public read is unrestricted (logos are embedded in the UI for all visitors).

### 002_super_admin.sql

| Object | Purpose |
|--------|---------|
| `profiles` table | Mirrors `auth.users`; used by the super admin dashboard without direct auth schema queries |
| `handle_new_user` trigger | Auto-inserts a profiles row on every new sign-up |
| `super_admins` table | Presence of a `user_id` row grants platform-wide read access |
| Super admin SELECT policies | Additive read-all policies on all five data tables and profiles; write is still blocked by the per-coach policies from 001 |

---

## Promoting a user to super admin

After both migrations have run:

```sql
-- 1. Find the user's UUID
SELECT id FROM auth.users WHERE email = 'admin@example.com';

-- 2. Grant super admin access
INSERT INTO public.super_admins (user_id)
VALUES ('<UUID>')
ON CONFLICT (user_id) DO NOTHING;

-- 3. Backfill the profile row if the account predates the trigger
INSERT INTO public.profiles (id, email, created_at)
SELECT id, email, created_at FROM auth.users WHERE id = '<UUID>'
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
```

---

## Superseded files

These three files in the project root encode the same schema as an initial single-coach version followed by two migrations. They are kept for historical reference but should not be run on a fresh project.

| File | Status |
|------|--------|
| `supabase-schema.sql` | Superseded by `001_schema.sql` |
| `supabase-migration-multi-coach.sql` | Superseded by `001_schema.sql` |
| `supabase-migration-super-admin.sql` | Superseded by `002_super_admin.sql` |
