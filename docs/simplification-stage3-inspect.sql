-- READ ONLY. Run only against an isolated deployed-like Supabase database.
-- Do not run against the live Kaizen project during Stages 1–7.
-- Save catalog output without credentials or personal data. These queries do
-- not establish that policies work; follow with authenticated role tests.

-- Table, view and RLS inventory.
SELECT n.nspname AS schema_name, c.relname AS object_name, c.relkind,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'auth')
  AND (n.nspname <> 'auth' OR c.relname IN ('users', 'sessions'))
  AND c.relkind IN ('r', 'p', 'v', 'm')
ORDER BY 1, 2;

-- Columns, types, defaults and nullability for public records.
SELECT table_name, ordinal_position, column_name, data_type, udt_name,
       is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- Constraints and indexes; inspect date checks and ownership keys in detail.
SELECT c.conrelid::regclass::text AS table_name, c.conname,
       pg_catalog.pg_get_constraintdef(c.oid, true) AS definition
FROM pg_catalog.pg_constraint c
JOIN pg_catalog.pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public'
ORDER BY 1, 2;

SELECT schemaname, tablename, indexname, indexdef
FROM pg_catalog.pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Policy predicates and object-level grants. RLS and grants are separate.
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual,
       with_check
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

SELECT table_name, grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee, privilege_type;

-- This privileged aggregate must not be directly readable by a browser role.
SELECT to_regclass('public.admin_coach_summary_view') AS admin_view,
       CASE WHEN to_regclass('public.admin_coach_summary_view') IS NULL
            THEN NULL
            ELSE has_table_privilege('anon',
                 'public.admin_coach_summary_view', 'SELECT') END AS anon_can_select,
       CASE WHEN to_regclass('public.admin_coach_summary_view') IS NULL
            THEN NULL
            ELSE has_table_privilege('authenticated',
                 'public.admin_coach_summary_view', 'SELECT') END AS authenticated_can_select;

-- Functions and browser execution grants. Review actual definitions below.
SELECT n.nspname AS schema_name, p.proname AS function_name,
       pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE')
         AS authenticated_can_execute
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY 1, 2, 3;

SELECT p.proname AS function_name,
       pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_catalog.pg_get_functiondef(p.oid) AS definition
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'save_session', 'archive_events', 'restore_archive', 'remove_player',
    'admin_extend_purge_deadline', 'admin_purge_now',
    'handle_new_user', 'log_session_saved'
  )
ORDER BY 1, 2;

-- User-defined triggers and view definitions.
SELECT t.tgrelid::regclass::text AS table_name, t.tgname,
       pg_catalog.pg_get_triggerdef(t.oid, true) AS definition
FROM pg_catalog.pg_trigger t
JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE NOT t.tgisinternal
  AND n.nspname = 'public'
ORDER BY 1, 2;

SELECT schemaname, viewname, definition
FROM pg_catalog.pg_views
WHERE schemaname = 'public'
ORDER BY viewname;

-- Isolated fixture only: check the shape of admin membership without listing
-- emails. A clone without auth users may report zero; that does not establish
-- the production release check.
SELECT count(*) AS admin_count,
       coalesce(bool_and(lower(u.email) = 'johnfreyman70@gmail.com'), false)
         AS all_admins_are_designated_user
FROM public.super_admins sa
JOIN auth.users u ON u.id = sa.user_id;
