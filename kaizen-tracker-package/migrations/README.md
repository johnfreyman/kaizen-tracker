# Database Migrations Workflow

This directory contains the canonical database migrations for the Kaizen Tracker application. 

> [!WARNING]
> All legacy/duplicate schema files in the project root (`supabase-schema.sql`, `supabase-migration-multi-coach.sql`, and `supabase-migration-super-admin.sql`) have been **completely deleted** to avoid operational confusion and security risks. 
> 
> Use **ONLY** the sequential migrations in this folder for both fresh installations and upgrades.

---

## Migration Philosophy & Order

We follow a strict, sequential migration philosophy. Migrations must be run one at a time, in order. Every script is fully **idempotent** (utilizing `IF NOT EXISTS`, `OR REPLACE`, and `DROP ... IF EXISTS`), meaning they can be safely re-run against an existing database without destroying data or causing constraint errors.

| Order | File | Description |
|---|---|---|
| **1** | [`001_schema.sql`](file:///Users/jfreyman/left-brain-projects/kaizen-tracker/migrations/001_schema.sql) | **Base Schema:** Table creation, indexes, Row-Level Security (RLS) policies scoped strictly per coach, and path-scoped Storage bucket initialization. |
| **2** | [`002_super_admin.sql`](file:///Users/jfreyman/left-brain-projects/kaizen-tracker/migrations/002_super_admin.sql) | **Profiles & Super Admin:** User profiles tracking via triggers, super-admin capability tables, and permissive read-all SELECT policies. Depends entirely on the tables defined in `001_schema.sql`. |
| **3** | [`003_atomic_operations.sql`](file:///Users/jfreyman/left-brain-projects/kaizen-tracker/migrations/003_atomic_operations.sql) | **Transactional RPCs:** Creates database-level functions (`save_session`, `archive_events`, `restore_archive`) to execute multi-table DML inside safe atomic transactions. |
| **4** | [`004_adjust_logo_constraint.sql`](file:///Users/jfreyman/left-brain-projects/kaizen-tracker/migrations/004_adjust_logo_constraint.sql) | **Adjust constraints:** Drops the old 200-character CHECK constraint on `team_logo` and expands it to 2048 characters to accommodate long storage URLs. |
| **5** | [`005_admin_coach_summary_view.sql`](file:///Users/jfreyman/left-brain-projects/kaizen-tracker/migrations/005_admin_coach_summary_view.sql) | **Admin Coach Summary View:** Creates a `SECURITY DEFINER` view (`admin_coach_summary_view`) that aggregates coach health and activity metrics — including auth metadata, team settings, session counts, last active timestamp, archive counts, and email verification status — in a single query for the Super Admin Dashboard. |

---

## Setup & Fresh-Install Instructions

To configure a new Supabase project from scratch:

1. Open your **Supabase Dashboard**.
2. Go to **SQL Editor** &rarr; **New query**.
3. Open [`001_schema.sql`](file:///Users/jfreyman/left-brain-projects/kaizen-tracker/migrations/001_schema.sql), copy its entire contents, paste it into the editor, and click **Run**.
4. Create another new query, copy [`002_super_admin.sql`](file:///Users/jfreyman/left-brain-projects/kaizen-tracker/migrations/002_super_admin.sql), paste, and click **Run**.
5. Create a third new query, copy [`003_atomic_operations.sql`](file:///Users/jfreyman/left-brain-projects/kaizen-tracker/migrations/003_atomic_operations.sql), paste, and click **Run**.
6. Create a fourth new query, copy [`004_adjust_logo_constraint.sql`](file:///Users/jfreyman/left-brain-projects/kaizen-tracker/migrations/004_adjust_logo_constraint.sql), paste, and click **Run**.
7. Create a fifth new query, copy [`005_admin_coach_summary_view.sql`](file:///Users/jfreyman/left-brain-projects/kaizen-tracker/migrations/005_admin_coach_summary_view.sql), paste, and click **Run**.

Verify that all migrations execute successfully without errors.

---

## Detailed Schema & RLS Organization

### 1. Row-Level Security (RLS)
RLS is active across all data-bearing tables:
* `team_settings`
* `roster`
* `events`
* `active_session`
* `archived_event_sets`
* `profiles`

Every table enforces a single `FOR ALL` policy: `coach_id = auth.uid()`. No user can read, insert, update, or delete rows belonging to another coach under any circumstances.

### 2. Path-Scoped Storage Security
We utilize a public storage bucket called `team-assets` for custom team logos. 
* **Read Access:** Publicly readable by any client, allowing logos to load seamlessly in the application.
* **Write Access:** Authenticated users are strictly path-scoped. A coach can only `INSERT`, `UPDATE`, or `DELETE` objects matching the template:
  ```text
  logos/{auth.uid()}/...
  ```
  This prevents a malicious authenticated user from overwriting or injecting files into another tenant's namespace.

### 3. Super Admin Permissive Access
A user whose UUID is added to the `super_admins` table receives permissive, read-only (`SELECT`) access across all coaches' data tables. Write permissions are still completely blocked, preserving data ownership and integrity.

To promote a user to super admin:
```sql
-- Step 1: Find the target coach's UUID
SELECT id FROM auth.users WHERE email = 'your-admin@example.com';

-- Step 2: Insert that UUID into super_admins table
INSERT INTO public.super_admins (user_id)
VALUES ('<UUID-FROM-STEP-1>')
ON CONFLICT (user_id) DO NOTHING;

-- Step 3: Backfill the public profile (if the account predates the automatic signup trigger)
INSERT INTO public.profiles (id, email, created_at)
VALUES ('<UUID-FROM-STEP-1>', 'your-admin@example.com', now())
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
```
