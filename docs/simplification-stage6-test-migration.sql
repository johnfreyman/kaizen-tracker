-- Stage 6 isolated test project only. This extends the Stage 3 candidate;
-- it is not a production release migration. No historical rows are deleted.

ALTER TABLE public.tracker_operations DROP CONSTRAINT IF EXISTS tracker_operations_kind_check;
ALTER TABLE public.tracker_operations ADD CONSTRAINT tracker_operations_kind_check
  CHECK (kind IN ('start_v1', 'set_present_v1', 'finish_v1', 'start_fresh_v1',
                  'create_team_v1', 'rename_team_v1', 'create_player_v1',
                  'update_player_v1', 'correct_v1', 'retire_player_v1',
                  'restore_player_v1', 'set_exit_pin_v1', 'reset_exit_pin_v1',
                  'set_raffle_v1', 'draw_v1', 'void_draw_v1'));

CREATE TABLE IF NOT EXISTS public.tracker_draws (
  id uuid PRIMARY KEY,
  coach_id uuid NOT NULL REFERENCES auth.users(id),
  round_id uuid NOT NULL,
  operation_id uuid NOT NULL,
  ticket_session_id uuid NOT NULL,
  player_id uuid NOT NULL,
  display_name text NOT NULL,
  prize text NOT NULL DEFAULT '' CHECK (length(prize) <= 120),
  excluded_player_ids uuid[] NOT NULL DEFAULT '{}',
  pool_count integer NOT NULL CHECK (pool_count > 0),
  pool_hash text NOT NULL CHECK (pool_hash ~ '^[a-f0-9]{32}$'),
  drawn_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz,
  void_operation_id uuid,
  UNIQUE (coach_id,id),
  UNIQUE (coach_id,operation_id),
  FOREIGN KEY (coach_id,round_id) REFERENCES public.tracker_rounds(coach_id,id),
  FOREIGN KEY (coach_id,ticket_session_id,player_id)
    REFERENCES public.tracker_session_roster(coach_id,session_id,player_id),
  FOREIGN KEY (coach_id,operation_id)
    REFERENCES public.tracker_operations(coach_id,operation_id),
  FOREIGN KEY (coach_id,void_operation_id)
    REFERENCES public.tracker_operations(coach_id,operation_id),
  CHECK ((voided_at IS NULL AND void_operation_id IS NULL)
      OR (voided_at IS NOT NULL AND void_operation_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS tracker_draws_by_round
  ON public.tracker_draws (coach_id,round_id,drawn_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS tracker_draws_ticket_fk
  ON public.tracker_draws (coach_id,ticket_session_id,player_id);
CREATE INDEX IF NOT EXISTS tracker_draws_void_operation_fk
  ON public.tracker_draws (coach_id,void_operation_id)
  WHERE void_operation_id IS NOT NULL;
ALTER TABLE public.tracker_draws ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tracker_draws FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.tracker_draws TO authenticated;
DROP POLICY IF EXISTS tracker_owner_select ON public.tracker_draws;
CREATE POLICY tracker_owner_select ON public.tracker_draws FOR SELECT TO authenticated
  USING (coach_id = (select auth.uid()));

-- Ticket changes and session starts/finalizations serialize with an online
-- draw on the assigned round. No attendance or ticket is consumed by a draw.
CREATE OR REPLACE FUNCTION tracker_private.lock_ticket_round_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $fn$
DECLARE v_round uuid;
BEGIN
  IF TG_TABLE_NAME = 'tracker_sessions' THEN
    v_round := NEW.round_id;
  ELSE
    SELECT round_id INTO v_round FROM public.tracker_sessions
      WHERE coach_id=NEW.coach_id AND id=NEW.session_id;
  END IF;
  PERFORM 1 FROM public.tracker_rounds
    WHERE coach_id=NEW.coach_id AND id=v_round FOR UPDATE;
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS tracker_session_round_lock ON public.tracker_sessions;
CREATE TRIGGER tracker_session_round_lock BEFORE INSERT OR UPDATE ON public.tracker_sessions
  FOR EACH ROW EXECUTE FUNCTION tracker_private.lock_ticket_round_v1();
DROP TRIGGER IF EXISTS tracker_attendance_round_lock ON public.tracker_attendance;
CREATE TRIGGER tracker_attendance_round_lock BEFORE INSERT OR UPDATE ON public.tracker_attendance
  FOR EACH ROW EXECUTE FUNCTION tracker_private.lock_ticket_round_v1();
REVOKE ALL ON FUNCTION tracker_private.lock_ticket_round_v1() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION tracker_private.raffle_pool_v1(
  p_owner uuid,p_round uuid,p_excluded uuid[]
) RETURNS TABLE(session_id uuid,player_id uuid,display_name text)
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $fn$
  SELECT t.session_id,t.player_id,
    r.first_name || CASE WHEN r.short_label <> '' THEN ' ' || r.short_label ELSE '' END ||
    CASE WHEN r.jersey_number IS NOT NULL THEN ' · #' || r.jersey_number ELSE '' END
  FROM public.tracker_ticket_entitlements t
  JOIN public.tracker_session_roster r
    ON r.coach_id=t.coach_id AND r.session_id=t.session_id AND r.player_id=t.player_id
  WHERE t.coach_id=p_owner AND t.round_id=p_round
    AND NOT (t.player_id = ANY(p_excluded))
$fn$;
REVOKE ALL ON FUNCTION tracker_private.raffle_pool_v1(uuid,uuid,uuid[])
  FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION tracker_private.raffle_snapshot_v1(p_exclude_last_n integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_owner uuid := auth.uid();
  v_round public.tracker_rounds%ROWTYPE;
  v_excluded uuid[];
  v_tickets jsonb;
  v_count integer;
  v_hash text;
  v_draws jsonb;
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE='42501'; END IF;
  IF p_exclude_last_n IS NULL OR p_exclude_last_n NOT BETWEEN 0 AND 20 THEN
    RAISE EXCEPTION 'invalid exclusion count' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_round FROM public.tracker_rounds WHERE coach_id=v_owner AND is_current;
  IF NOT FOUND THEN RAISE EXCEPTION 'raffle round missing' USING ERRCODE='55000'; END IF;
  SELECT coalesce(array_agg(DISTINCT recent.player_id),'{}'::uuid[]) INTO v_excluded
    FROM (SELECT player_id FROM public.tracker_draws
      WHERE coach_id=v_owner AND round_id=v_round.id AND voided_at IS NULL
      ORDER BY drawn_at DESC,id DESC LIMIT p_exclude_last_n) recent;
  SELECT coalesce(jsonb_agg(jsonb_build_object('session_id',session_id,
      'player_id',player_id,'display_name',display_name)
      ORDER BY session_id,player_id),'[]'::jsonb),count(*),
      md5(coalesce(string_agg(session_id::text || ':' || player_id::text,','
        ORDER BY session_id,player_id),''))
    INTO v_tickets,v_count,v_hash
    FROM tracker_private.raffle_pool_v1(v_owner,v_round.id,v_excluded);
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'round_id',round_id,
      'player_id',player_id,'display_name',display_name,'prize',prize,
      'drawn_at',drawn_at,'voided_at',voided_at,'pool_count',pool_count)
      ORDER BY drawn_at DESC,id DESC),'[]'::jsonb)
    INTO v_draws FROM public.tracker_draws WHERE coach_id=v_owner;
  RETURN jsonb_build_object('round_id',v_round.id,'round_revision',v_round.revision,
    'generation',v_round.generation,'raffle_enabled',
    (SELECT raffle_enabled FROM public.team_settings WHERE coach_id=v_owner),
    'tickets',v_tickets,'pool_count',v_count,'pool_hash',v_hash,
    'excluded_player_ids',to_jsonb(v_excluded),'draws',v_draws);
END $fn$;

CREATE OR REPLACE FUNCTION public.tracker_raffle_snapshot_v1(p_exclude_last_n integer)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $fn$
  SELECT tracker_private.raffle_snapshot_v1(p_exclude_last_n)
$fn$;
REVOKE ALL ON FUNCTION tracker_private.raffle_snapshot_v1(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION tracker_private.raffle_snapshot_v1(integer) TO authenticated;
REVOKE ALL ON FUNCTION public.tracker_raffle_snapshot_v1(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tracker_raffle_snapshot_v1(integer) TO authenticated;

CREATE OR REPLACE FUNCTION tracker_private.apply_raffle_operation_v1(
  p_operation_id uuid,p_device_id uuid,p_device_sequence bigint,
  p_kind text,p_base_revision bigint,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_owner uuid := auth.uid();
  v_existing jsonb;
  v_round public.tracker_rounds%ROWTYPE;
  v_result jsonb;
  v_excluded uuid[];
  v_count integer;
  v_hash text;
  v_ticket record;
  v_draw public.tracker_draws%ROWTYPE;
  v_exclude_last_n integer;
  v_mode text;
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE='42501'; END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('set_raffle_v1','draw_v1','void_draw_v1') THEN
    RAISE EXCEPTION 'unsupported raffle operation' USING ERRCODE='22023';
  END IF;
  v_existing := tracker_private.claim_operation_v1(v_owner,p_operation_id,
    p_device_id,p_device_sequence,p_kind,NULL,p_base_revision,p_payload);
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  SELECT * INTO v_round FROM public.tracker_rounds
    WHERE coach_id=v_owner AND is_current FOR UPDATE;
  IF NOT FOUND OR v_round.id IS DISTINCT FROM (p_payload->>'round_id')::uuid
     OR v_round.revision <> p_base_revision THEN
    RAISE EXCEPTION 'stale raffle round' USING ERRCODE='40001';
  END IF;
  IF p_kind = 'set_raffle_v1' THEN
    v_mode := p_payload->>'mode';
    IF v_mode IS NULL OR v_mode NOT IN ('off','keep','fresh')
      OR (SELECT count(*) FROM jsonb_object_keys(p_payload)) <> 2 THEN
      RAISE EXCEPTION 'invalid raffle choice' USING ERRCODE='22023';
    END IF;
    IF v_mode = 'fresh' THEN
      IF EXISTS (SELECT 1 FROM public.tracker_sessions
          WHERE coach_id=v_owner AND state='active') THEN
        RAISE EXCEPTION 'active session blocks raffle reset' USING ERRCODE='40001';
      END IF;
      UPDATE public.tracker_rounds SET is_current=false,revision=revision+1,
        closed_at=now() WHERE coach_id=v_owner AND id=v_round.id;
      INSERT INTO public.tracker_rounds(coach_id,generation)
        VALUES(v_owner,v_round.generation+1) RETURNING * INTO v_round;
    ELSE
      UPDATE public.tracker_rounds SET revision=revision+1
        WHERE coach_id=v_owner AND id=v_round.id RETURNING * INTO v_round;
    END IF;
    UPDATE public.team_settings SET raffle_enabled=(v_mode <> 'off')
      WHERE coach_id=v_owner;
    v_result := jsonb_build_object('round_id',v_round.id,
      'round_revision',v_round.revision,'raffle_enabled',(v_mode <> 'off'));
  ELSIF p_kind = 'draw_v1' THEN
    IF NOT (SELECT raffle_enabled FROM public.team_settings WHERE coach_id=v_owner)
      OR EXISTS (SELECT 1 FROM public.tracker_sessions
          WHERE coach_id=v_owner AND state='active') THEN
      RAISE EXCEPTION 'draw unavailable during active attendance or while raffle off' USING ERRCODE='55000';
    END IF;
    IF jsonb_typeof(p_payload->'exclude_last_n') IS DISTINCT FROM 'number'
      OR (p_payload->>'exclude_last_n') !~ '^[0-9]{1,2}$'
      OR jsonb_typeof(p_payload->'prize') IS DISTINCT FROM 'string'
      OR length(p_payload->>'prize') > 120
      OR coalesce(p_payload->>'pool_hash','') !~ '^[a-f0-9]{32}$'
      OR p_payload->>'draw_id' IS NULL
      OR (SELECT count(*) FROM jsonb_object_keys(p_payload)) <> 5 THEN
      RAISE EXCEPTION 'invalid draw request' USING ERRCODE='22023';
    END IF;
    v_exclude_last_n := (p_payload->>'exclude_last_n')::integer;
    IF v_exclude_last_n NOT BETWEEN 0 AND 20 THEN
      RAISE EXCEPTION 'invalid exclusion count' USING ERRCODE='22023';
    END IF;
    SELECT coalesce(array_agg(DISTINCT recent.player_id),'{}'::uuid[])
      INTO v_excluded FROM (SELECT player_id FROM public.tracker_draws
        WHERE coach_id=v_owner AND round_id=v_round.id AND voided_at IS NULL
        ORDER BY drawn_at DESC,id DESC LIMIT v_exclude_last_n) recent;
    SELECT count(*),md5(coalesce(string_agg(session_id::text || ':' || player_id::text,','
      ORDER BY session_id,player_id),'')) INTO v_count,v_hash
      FROM tracker_private.raffle_pool_v1(v_owner,v_round.id,v_excluded);
    IF v_count = 0 THEN RAISE EXCEPTION 'no eligible tickets' USING ERRCODE='55000'; END IF;
    IF v_hash <> p_payload->>'pool_hash' THEN
      RAISE EXCEPTION 'raffle pool changed; refresh before drawing' USING ERRCODE='40001';
    END IF;
    SELECT * INTO v_ticket FROM tracker_private.raffle_pool_v1(v_owner,v_round.id,v_excluded)
      ORDER BY random() LIMIT 1;
    INSERT INTO public.tracker_draws(id,coach_id,round_id,operation_id,
      ticket_session_id,player_id,display_name,prize,excluded_player_ids,
      pool_count,pool_hash)
    VALUES ((p_payload->>'draw_id')::uuid,v_owner,v_round.id,p_operation_id,
      v_ticket.session_id,v_ticket.player_id,v_ticket.display_name,
      coalesce(p_payload->>'prize',''),v_excluded,v_count,v_hash)
    RETURNING * INTO v_draw;
    UPDATE public.tracker_rounds SET revision=revision+1
      WHERE coach_id=v_owner AND id=v_round.id RETURNING * INTO v_round;
    v_result := jsonb_build_object('draw_id',v_draw.id,'round_id',v_round.id,
      'round_revision',v_round.revision,'session_id',v_draw.ticket_session_id,
      'player_id',v_draw.player_id,'display_name',v_draw.display_name,
      'pool_count',v_count,'drawn_at',v_draw.drawn_at);
  ELSE
    IF (SELECT count(*) FROM jsonb_object_keys(p_payload)) <> 2
      OR p_payload->>'draw_id' IS NULL THEN
      RAISE EXCEPTION 'invalid void request' USING ERRCODE='22023';
    END IF;
    SELECT * INTO v_draw FROM public.tracker_draws
      WHERE coach_id=v_owner AND id=(p_payload->>'draw_id')::uuid
        AND round_id=v_round.id AND voided_at IS NULL FOR UPDATE;
    IF NOT FOUND OR EXISTS (SELECT 1 FROM public.tracker_draws
      WHERE coach_id=v_owner AND round_id=v_round.id AND voided_at IS NULL
        AND (drawn_at,id) > (v_draw.drawn_at,v_draw.id)) THEN
      RAISE EXCEPTION 'only the last current-round draw can be undone' USING ERRCODE='55000';
    END IF;
    UPDATE public.tracker_draws SET voided_at=now(),void_operation_id=p_operation_id
      WHERE coach_id=v_owner AND id=v_draw.id RETURNING * INTO v_draw;
    UPDATE public.tracker_rounds SET revision=revision+1
      WHERE coach_id=v_owner AND id=v_round.id RETURNING * INTO v_round;
    v_result := jsonb_build_object('draw_id',v_draw.id,'voided_at',v_draw.voided_at,
      'round_id',v_round.id,'round_revision',v_round.revision);
  END IF;
  UPDATE public.tracker_operations SET result=v_result
    WHERE coach_id=v_owner AND operation_id=p_operation_id;
  RETURN v_result;
END $fn$;

CREATE OR REPLACE FUNCTION public.tracker_apply_raffle_operation_v1(
  p_operation_id uuid,p_device_id uuid,p_device_sequence bigint,
  p_kind text,p_base_revision bigint,p_payload jsonb
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $fn$
  SELECT tracker_private.apply_raffle_operation_v1(p_operation_id,p_device_id,
    p_device_sequence,p_kind,p_base_revision,p_payload)
$fn$;
REVOKE ALL ON FUNCTION tracker_private.apply_raffle_operation_v1(uuid,uuid,bigint,text,bigint,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION tracker_private.apply_raffle_operation_v1(uuid,uuid,bigint,text,bigint,jsonb)
  TO authenticated;
REVOKE ALL ON FUNCTION public.tracker_apply_raffle_operation_v1(uuid,uuid,bigint,text,bigint,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tracker_apply_raffle_operation_v1(uuid,uuid,bigint,text,bigint,jsonb)
  TO authenticated;
