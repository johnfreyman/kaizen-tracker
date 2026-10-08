-- Rollback-only first-launch admin summary assertions in the isolated project.
-- Existing synthetic fixtures remain untouched after this transaction.
BEGIN;
DO $first_launch_admin_test$
DECLARE
  v_coach uuid := 'd4a00000-0000-4000-8000-00000000000a';
  v_players integer;
  v_sessions integer;
  v_archives integer;
  v_after record;
BEGIN
  SELECT count(*)::integer INTO v_players
  FROM public.tracker_players
  WHERE coach_id = v_coach AND retired_at IS NULL;
  SELECT count(*)::integer INTO v_sessions
  FROM public.tracker_sessions
  WHERE coach_id = v_coach AND state = 'completed';
  SELECT count(*)::integer INTO v_archives
  FROM public.tracker_sessions
  WHERE coach_id = v_coach AND state = 'completed' AND archived_at IS NOT NULL;

  SELECT player_count, session_count, total_archives INTO STRICT v_after
  FROM public.admin_coach_summary_view WHERE coach_id = v_coach;
  IF v_after.player_count <> v_players OR v_after.session_count <> v_sessions
     OR v_after.total_archives <> v_archives THEN
    RAISE EXCEPTION 'Canonical admin totals differ from base rows';
  END IF;

  -- Old sample rows must have no effect on first-launch counts.
  INSERT INTO public.roster (coach_id,id,name,is_guest)
  VALUES (v_coach,gen_random_uuid(),'Prelaunch sample only',false);
  INSERT INTO public.events (coach_id,id,date,type,duration,players,saved_at)
  VALUES (v_coach,gen_random_uuid()::text,'2026-09-20','Practice',1.5,'[]'::jsonb,now()::text);
  INSERT INTO public.archived_event_sets (coach_id,id,archived_at,events)
  VALUES (v_coach,gen_random_uuid()::text,now()::text,'[]'::jsonb);

  SELECT player_count, session_count, total_archives INTO STRICT v_after
  FROM public.admin_coach_summary_view WHERE coach_id = v_coach;
  IF v_after.player_count <> v_players OR v_after.session_count <> v_sessions
     OR v_after.total_archives <> v_archives THEN
    RAISE EXCEPTION 'Prelaunch rows changed first-launch totals';
  END IF;

  IF has_table_privilege('anon','public.admin_coach_summary_view','SELECT')
     OR has_table_privilege('authenticated','public.admin_coach_summary_view','SELECT')
     OR NOT has_table_privilege('service_role','public.admin_coach_summary_view','SELECT') THEN
    RAISE EXCEPTION 'Admin view grant boundary changed';
  END IF;
END
$first_launch_admin_test$;

-- Start from an owner with no canonical or legacy data and add one new
-- practice. The admin row must move from zero to one without a backfill.
DO $fresh_owner_test$
DECLARE
  v_coach uuid := 'd4b00000-0000-4000-8000-00000000000b';
  v_player uuid := gen_random_uuid();
  v_round uuid := gen_random_uuid();
  v_session uuid := gen_random_uuid();
  v_row record;
BEGIN
  IF EXISTS (SELECT 1 FROM public.tracker_players WHERE coach_id = v_coach)
     OR EXISTS (SELECT 1 FROM public.tracker_sessions WHERE coach_id = v_coach)
     OR EXISTS (SELECT 1 FROM public.roster WHERE coach_id = v_coach)
     OR EXISTS (SELECT 1 FROM public.events WHERE coach_id = v_coach) THEN
    RAISE EXCEPTION 'Fresh-owner fixture is no longer empty';
  END IF;
  SELECT player_count, session_count, total_archives INTO STRICT v_row
  FROM public.admin_coach_summary_view WHERE coach_id = v_coach;
  IF v_row.player_count <> 0 OR v_row.session_count <> 0 OR v_row.total_archives <> 0 THEN
    RAISE EXCEPTION 'Fresh owner did not begin at zero';
  END IF;

  INSERT INTO public.tracker_players (id,coach_id,first_name,jersey_number)
  VALUES (v_player,v_coach,'First launch','7');
  INSERT INTO public.tracker_rounds (id,coach_id,generation)
  VALUES (v_round,v_coach,1);
  INSERT INTO public.tracker_sessions
    (id,coach_id,session_date,kind,credit_hours,state,round_id,all_kaizen,completed_at)
  VALUES (v_session,v_coach,'2026-09-27','Practice',1.5,'completed',v_round,true,now());
  INSERT INTO public.tracker_session_roster
    (coach_id,session_id,player_id,first_name,jersey_number,is_guest)
  VALUES (v_coach,v_session,v_player,'First launch','7',false);
  INSERT INTO public.tracker_session_expected_players (coach_id,session_id,player_id)
  VALUES (v_coach,v_session,v_player);
  INSERT INTO public.tracker_attendance
    (coach_id,session_id,player_id,present,revision,source_operation_id)
  VALUES (v_coach,v_session,v_player,true,1,gen_random_uuid());

  SELECT player_count, session_count, total_archives INTO STRICT v_row
  FROM public.admin_coach_summary_view WHERE coach_id = v_coach;
  IF v_row.player_count <> 1 OR v_row.session_count <> 1 OR v_row.total_archives <> 0 THEN
    RAISE EXCEPTION 'First canonical practice did not appear once in admin totals';
  END IF;
  IF (SELECT count(*) FROM public.tracker_attendance
      WHERE coach_id = v_coach AND session_id = v_session AND present) <> 1 THEN
    RAISE EXCEPTION 'First practice attendance did not persist';
  END IF;
END
$fresh_owner_test$;
ROLLBACK;
