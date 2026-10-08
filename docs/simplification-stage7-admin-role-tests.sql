-- Isolated test-project only: mixed legacy/canonical admin summary checks.
-- All synthetic writes and their logging triggers roll back.
BEGIN;
DO $admin_test$
DECLARE
  v_coach uuid := 'd4a00000-0000-4000-8000-00000000000a';
  v_player uuid;
  v_session uuid;
  v_new_player uuid := gen_random_uuid();
  v_new_event text := gen_random_uuid()::text;
  v_base_players integer;
  v_base_sessions integer;
  v_base_archives integer;
  v_actual_players integer;
  v_actual_sessions integer;
  v_actual_archives integer;
BEGIN
  SELECT id INTO STRICT v_player
  FROM public.tracker_players
  WHERE coach_id = v_coach AND retired_at IS NULL
  ORDER BY id LIMIT 1;
  SELECT id INTO STRICT v_session
  FROM public.tracker_sessions
  WHERE coach_id = v_coach AND state = 'completed'
  ORDER BY id LIMIT 1;
  SELECT player_count, session_count, total_archives
  INTO STRICT v_base_players, v_base_sessions, v_base_archives
  FROM public.admin_coach_summary_view WHERE coach_id = v_coach;

  -- Backfilled same-ID identity must not count twice.
  INSERT INTO public.roster (coach_id,id,name,is_guest)
  VALUES (v_coach,v_player,'Admin test imported identity',false);
  -- A distinct legacy-only record still counts.
  INSERT INTO public.roster (coach_id,id,name,is_guest)
  VALUES (v_coach,v_new_player,'Admin test legacy identity',false);

  -- A legacy event sharing a canonical UUID/text ID must not count twice.
  INSERT INTO public.events (coach_id,id,date,type,duration,players,saved_at)
  VALUES (v_coach,v_session::text,'2026-09-20','Practice',1.5,'[]'::jsonb,'2026-09-27T10:00:00Z');
  -- A distinct legacy-only session still counts.
  INSERT INTO public.events (coach_id,id,date,type,duration,players,saved_at)
  VALUES (v_coach,v_new_event,'2026-09-20','Practice',1.5,'[]'::jsonb,'2026-09-27T11:00:00Z');
  INSERT INTO public.archived_event_sets (coach_id,id,archived_at,events)
  VALUES (v_coach,gen_random_uuid()::text,'2026-09-27T11:00:00Z','[]'::jsonb);

  SELECT player_count, session_count, total_archives
  INTO STRICT v_actual_players, v_actual_sessions, v_actual_archives
  FROM public.admin_coach_summary_view WHERE coach_id = v_coach;
  IF v_actual_players <> v_base_players + 1
     OR v_actual_sessions <> v_base_sessions + 1
     OR v_actual_archives <> v_base_archives + 1 THEN
    RAISE EXCEPTION 'Mixed admin totals diverged: players %/% sessions %/% archives %/%',
      v_actual_players, v_base_players + 1,
      v_actual_sessions, v_base_sessions + 1,
      v_actual_archives, v_base_archives + 1;
  END IF;
  IF has_table_privilege('anon','public.admin_coach_summary_view','SELECT')
     OR has_table_privilege('authenticated','public.admin_coach_summary_view','SELECT')
     OR NOT has_table_privilege('service_role','public.admin_coach_summary_view','SELECT') THEN
    RAISE EXCEPTION 'Privileged admin-view grants changed';
  END IF;
END
$admin_test$;
ROLLBACK;
