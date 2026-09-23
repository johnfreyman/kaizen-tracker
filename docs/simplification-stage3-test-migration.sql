-- Stage 3 isolated rehearsal only. Applied to the dedicated test project,
-- never to Kaizen production. Keep this exact SQL with the rehearsal record;
-- it is not yet a release migration. No legacy data is deleted or rewritten.

CREATE SCHEMA IF NOT EXISTS tracker_private;
REVOKE ALL ON SCHEMA tracker_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA tracker_private TO authenticated;

CREATE TABLE IF NOT EXISTS public.tracker_players (
  id uuid PRIMARY KEY,
  coach_id uuid NOT NULL REFERENCES auth.users(id),
  first_name text NOT NULL CHECK (length(btrim(first_name)) BETWEEN 1 AND 80),
  jersey_number text CHECK (jersey_number ~ '^[0-9]{1,3}$'),
  short_label text NOT NULL DEFAULT '' CHECK (length(short_label) <= 24),
  is_guest boolean NOT NULL DEFAULT false,
  retired_at timestamptz,
  legacy_name text,
  UNIQUE (coach_id, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS tracker_players_active_card_unique
  ON public.tracker_players
  (coach_id, lower(btrim(first_name)), coalesce(jersey_number, ''), lower(btrim(short_label)))
  WHERE retired_at IS NULL;
CREATE INDEX IF NOT EXISTS tracker_players_number
  ON public.tracker_players (coach_id, jersey_number)
  WHERE retired_at IS NULL;

CREATE TABLE IF NOT EXISTS public.tracker_sub_teams (
  id uuid PRIMARY KEY,
  coach_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  retired_at timestamptz,
  UNIQUE (coach_id, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS tracker_sub_teams_active_name_unique
  ON public.tracker_sub_teams (coach_id, lower(btrim(name)))
  WHERE retired_at IS NULL;

CREATE TABLE IF NOT EXISTS public.tracker_memberships (
  coach_id uuid NOT NULL REFERENCES auth.users(id),
  player_id uuid NOT NULL,
  team_id uuid NOT NULL,
  PRIMARY KEY (coach_id, player_id, team_id),
  FOREIGN KEY (coach_id, player_id)
    REFERENCES public.tracker_players (coach_id, id),
  FOREIGN KEY (coach_id, team_id)
    REFERENCES public.tracker_sub_teams (coach_id, id)
);
CREATE INDEX IF NOT EXISTS tracker_memberships_by_team
  ON public.tracker_memberships (coach_id, team_id, player_id);

CREATE TABLE IF NOT EXISTS public.tracker_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id),
  generation bigint NOT NULL CHECK (generation > 0),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  is_current boolean NOT NULL DEFAULT true,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  UNIQUE (coach_id, id),
  UNIQUE (coach_id, generation),
  CHECK ((is_current AND closed_at IS NULL)
      OR (NOT is_current AND closed_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS tracker_rounds_one_current
  ON public.tracker_rounds (coach_id) WHERE is_current;

CREATE TABLE IF NOT EXISTS public.tracker_sessions (
  id uuid PRIMARY KEY,
  coach_id uuid NOT NULL REFERENCES auth.users(id),
  session_date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('Practice', 'Optional Training')),
  credit_hours numeric(8,2) NOT NULL CHECK (credit_hours > 0),
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'completed')),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  round_id uuid NOT NULL,
  all_kaizen boolean NOT NULL DEFAULT false,
  needs_round_review boolean NOT NULL DEFAULT false,
  prepared_cache_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  archived_at timestamptz,
  UNIQUE (coach_id, id),
  FOREIGN KEY (coach_id, round_id)
    REFERENCES public.tracker_rounds (coach_id, id),
  CHECK ((state = 'active' AND completed_at IS NULL)
      OR (state = 'completed' AND completed_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS tracker_sessions_one_active
  ON public.tracker_sessions (coach_id) WHERE state = 'active';
CREATE INDEX IF NOT EXISTS tracker_sessions_by_date
  ON public.tracker_sessions (coach_id, session_date, id);
CREATE INDEX IF NOT EXISTS tracker_sessions_by_round
  ON public.tracker_sessions (coach_id, round_id, kind, state);

CREATE TABLE IF NOT EXISTS public.tracker_session_roster (
  coach_id uuid NOT NULL,
  session_id uuid NOT NULL,
  player_id uuid NOT NULL,
  first_name text NOT NULL,
  jersey_number text,
  short_label text NOT NULL DEFAULT '',
  is_guest boolean NOT NULL,
  PRIMARY KEY (coach_id, session_id, player_id),
  FOREIGN KEY (coach_id, session_id)
    REFERENCES public.tracker_sessions (coach_id, id),
  FOREIGN KEY (coach_id, player_id)
    REFERENCES public.tracker_players (coach_id, id)
);
CREATE INDEX IF NOT EXISTS tracker_session_roster_by_player
  ON public.tracker_session_roster (coach_id, player_id, session_id);

CREATE TABLE IF NOT EXISTS public.tracker_session_memberships (
  coach_id uuid NOT NULL,
  session_id uuid NOT NULL,
  player_id uuid NOT NULL,
  team_id uuid NOT NULL,
  PRIMARY KEY (coach_id, session_id, player_id, team_id),
  FOREIGN KEY (coach_id, session_id, player_id)
    REFERENCES public.tracker_session_roster (coach_id, session_id, player_id),
  FOREIGN KEY (coach_id, team_id)
    REFERENCES public.tracker_sub_teams (coach_id, id)
);
CREATE INDEX IF NOT EXISTS tracker_session_memberships_by_team
  ON public.tracker_session_memberships (coach_id, team_id, session_id, player_id);

CREATE TABLE IF NOT EXISTS public.tracker_session_expected_teams (
  coach_id uuid NOT NULL,
  session_id uuid NOT NULL,
  team_id uuid NOT NULL,
  PRIMARY KEY (coach_id, session_id, team_id),
  FOREIGN KEY (coach_id, session_id)
    REFERENCES public.tracker_sessions (coach_id, id),
  FOREIGN KEY (coach_id, team_id)
    REFERENCES public.tracker_sub_teams (coach_id, id)
);
CREATE INDEX IF NOT EXISTS tracker_expected_teams_by_team
  ON public.tracker_session_expected_teams (coach_id, team_id, session_id);

CREATE TABLE IF NOT EXISTS public.tracker_session_expected_players (
  coach_id uuid NOT NULL,
  session_id uuid NOT NULL,
  player_id uuid NOT NULL,
  PRIMARY KEY (coach_id, session_id, player_id),
  FOREIGN KEY (coach_id, session_id, player_id)
    REFERENCES public.tracker_session_roster (coach_id, session_id, player_id)
);
CREATE INDEX IF NOT EXISTS tracker_expected_by_player
  ON public.tracker_session_expected_players (coach_id, player_id, session_id);

CREATE TABLE IF NOT EXISTS public.tracker_attendance (
  coach_id uuid NOT NULL,
  session_id uuid NOT NULL,
  player_id uuid NOT NULL,
  present boolean NOT NULL,
  revision bigint NOT NULL CHECK (revision >= 0),
  source_operation_id uuid NOT NULL,
  PRIMARY KEY (coach_id, session_id, player_id),
  FOREIGN KEY (coach_id, session_id, player_id)
    REFERENCES public.tracker_session_roster (coach_id, session_id, player_id)
);
CREATE INDEX IF NOT EXISTS tracker_attendance_by_player
  ON public.tracker_attendance (coach_id, player_id, session_id)
  WHERE present;

CREATE TABLE IF NOT EXISTS public.tracker_operations (
  coach_id uuid NOT NULL REFERENCES auth.users(id),
  operation_id uuid NOT NULL,
  device_id uuid NOT NULL,
  device_sequence bigint NOT NULL CHECK (device_sequence > 0),
  session_id uuid,
  kind text NOT NULL CHECK (kind IN ('start_v1', 'set_present_v1', 'finish_v1', 'start_fresh_v1')),
  base_revision bigint NOT NULL CHECK (base_revision >= 0),
  request jsonb NOT NULL,
  result jsonb,
  applied_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (coach_id, operation_id),
  UNIQUE (coach_id, device_id, device_sequence)
);
CREATE INDEX IF NOT EXISTS tracker_operations_by_session
  ON public.tracker_operations (coach_id, session_id, device_sequence);

-- Browser roles can read only their own canonical rows. All canonical writes
-- use versioned operations, so they cannot bypass revisions or the ledger.
DO $rls$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'tracker_players', 'tracker_sub_teams', 'tracker_memberships',
    'tracker_rounds', 'tracker_sessions', 'tracker_session_roster',
    'tracker_session_memberships', 'tracker_session_expected_teams',
    'tracker_session_expected_players', 'tracker_attendance',
    'tracker_operations'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', v_table);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', v_table);
    EXECUTE format('DROP POLICY IF EXISTS tracker_owner_select ON public.%I', v_table);
    EXECUTE format(
      'CREATE POLICY tracker_owner_select ON public.%I FOR SELECT TO authenticated USING (coach_id = (select auth.uid()))',
      v_table
    );
  END LOOP;
END $rls$;

-- The existing admin backend uses service_role. Browser roles must not read
-- this privileged view directly, even if an old migration granted SELECT.
REVOKE ALL ON public.admin_coach_summary_view FROM PUBLIC, anon, authenticated;
ALTER VIEW public.admin_coach_summary_view SET (security_invoker = true);
GRANT SELECT ON public.admin_coach_summary_view TO service_role;

-- Defense against a future SQL-side mutation outside the RPC contract.
CREATE OR REPLACE FUNCTION tracker_private.protect_session_round_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $fn$
BEGIN
  IF NEW.coach_id IS DISTINCT FROM OLD.coach_id
     OR NEW.round_id IS DISTINCT FROM OLD.round_id THEN
    RAISE EXCEPTION 'session owner and raffle round are immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS tracker_session_round_immutable ON public.tracker_sessions;
CREATE TRIGGER tracker_session_round_immutable
  BEFORE UPDATE ON public.tracker_sessions
  FOR EACH ROW EXECUTE FUNCTION tracker_private.protect_session_round_v1();

CREATE OR REPLACE FUNCTION tracker_private.initialize_owner_v1()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_owner uuid; v_round public.tracker_rounds%ROWTYPE;
BEGIN
  v_owner := auth.uid();
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.team_settings (coach_id, raffle_enabled)
  VALUES (v_owner, true) ON CONFLICT (coach_id) DO NOTHING;
  INSERT INTO public.tracker_rounds (coach_id, generation)
  VALUES (v_owner, 1) ON CONFLICT (coach_id, generation) DO NOTHING;
  SELECT * INTO v_round FROM public.tracker_rounds
   WHERE coach_id = v_owner AND is_current;
  RETURN jsonb_build_object('round_id', v_round.id,
      'round_revision', v_round.revision,
      'raffle_enabled', (SELECT raffle_enabled FROM public.team_settings
                         WHERE coach_id = v_owner));
END $fn$;

CREATE OR REPLACE FUNCTION public.tracker_initialize_owner_v1()
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $fn$
  SELECT tracker_private.initialize_owner_v1()
$fn$;

CREATE OR REPLACE FUNCTION tracker_private.apply_operation_v1(
  p_operation_id uuid, p_device_id uuid, p_device_sequence bigint,
  p_kind text, p_session_id uuid, p_base_revision bigint, p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_owner uuid;
  v_request jsonb;
  v_existing public.tracker_operations%ROWTYPE;
  v_session public.tracker_sessions%ROWTYPE;
  v_round public.tracker_rounds%ROWTYPE;
  v_result jsonb;
  v_player uuid;
  v_present boolean;
  v_snapshot jsonb;
  v_item jsonb;
  v_expected uuid[];
  v_calculated uuid[];
BEGIN
  v_owner := auth.uid();
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_operation_id IS NULL OR p_device_id IS NULL OR p_device_sequence IS NULL
     OR p_device_sequence <= 0 OR p_base_revision IS NULL
     OR p_base_revision < 0 OR p_payload IS NULL
     OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid operation envelope' USING ERRCODE = '22023';
  END IF;
  v_request := jsonb_build_object('device_id',p_device_id,
    'device_sequence',p_device_sequence,'kind',p_kind,
    'session_id',p_session_id,'base_revision',p_base_revision,
    'payload',p_payload);

  -- The unique insert serializes concurrent retries of the same operation.
  INSERT INTO public.tracker_operations
    (coach_id, operation_id, device_id, device_sequence, session_id, kind,
     base_revision, request)
  VALUES (v_owner, p_operation_id, p_device_id, p_device_sequence,
          p_session_id, p_kind, p_base_revision, v_request)
  ON CONFLICT (coach_id, operation_id) DO NOTHING;
  SELECT * INTO v_existing FROM public.tracker_operations
   WHERE coach_id = v_owner AND operation_id = p_operation_id FOR UPDATE;
  IF v_existing.request IS DISTINCT FROM v_request THEN
    RAISE EXCEPTION 'operation id reused with different request'
      USING ERRCODE = '23505';
  END IF;
  IF v_existing.result IS NOT NULL THEN RETURN v_existing.result; END IF;

  IF p_kind = 'start_v1' THEN
    IF p_session_id IS NULL OR p_base_revision <> 0
       OR jsonb_typeof(p_payload->'roster') <> 'array'
       OR jsonb_typeof(p_payload->'selected_team_ids') <> 'array'
       OR jsonb_typeof(p_payload->'expected_player_ids') <> 'array'
       OR jsonb_typeof(p_payload->'all_kaizen') <> 'boolean' THEN
      RAISE EXCEPTION 'invalid start payload' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_round FROM public.tracker_rounds
     WHERE coach_id = v_owner AND id = (p_payload->>'round_id')::uuid
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'raffle round does not belong to coach'
        USING ERRCODE = '42501';
    END IF;
    IF p_payload->>'kind' NOT IN ('Practice','Optional Training') THEN
      RAISE EXCEPTION 'invalid session kind' USING ERRCODE = '22023';
    END IF;
    IF p_payload->>'kind' = 'Practice' AND NOT
       ((p_payload->>'all_kaizen')::boolean OR jsonb_array_length(p_payload->'selected_team_ids') > 0) THEN
      RAISE EXCEPTION 'practice requires expected scope' USING ERRCODE = '22023';
    END IF;
    IF p_payload->>'kind' = 'Optional Training' AND
       ((p_payload->>'all_kaizen')::boolean
        OR jsonb_array_length(p_payload->'selected_team_ids') <> 0
        OR jsonb_array_length(p_payload->'expected_player_ids') <> 0) THEN
      RAISE EXCEPTION 'training has no expected set' USING ERRCODE = '22023';
    END IF;
    IF (p_payload->>'all_kaizen')::boolean
       AND jsonb_array_length(p_payload->'selected_team_ids') <> 0 THEN
      RAISE EXCEPTION 'all kaizen cannot also select teams' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_payload->'roster') AS x
      WHERE NOT EXISTS (SELECT 1 FROM public.tracker_players p
                        WHERE p.coach_id = v_owner
                          AND p.id = (x->>'player_id')::uuid)
    ) OR EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(p_payload->'selected_team_ids') AS x
      WHERE NOT EXISTS (SELECT 1 FROM public.tracker_sub_teams t
                        WHERE t.coach_id = v_owner AND t.id = x::uuid)
    ) OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_payload->'roster') AS x,
                    LATERAL jsonb_array_elements_text(coalesce(x->'team_ids','[]'::jsonb)) AS team_id
      WHERE NOT EXISTS (SELECT 1 FROM public.tracker_sub_teams t
                        WHERE t.coach_id = v_owner AND t.id = team_id::uuid)
    ) THEN
      RAISE EXCEPTION 'foreign or invalid roster/team id'
        USING ERRCODE = '42501';
    END IF;
    SELECT coalesce(array_agg(DISTINCT x::uuid ORDER BY x::uuid), ARRAY[]::uuid[])
      INTO v_expected
      FROM jsonb_array_elements_text(p_payload->'expected_player_ids') AS x;
    IF p_payload->>'kind' = 'Practice' THEN
      IF (p_payload->>'all_kaizen')::boolean THEN
        SELECT coalesce(array_agg(DISTINCT (x->>'player_id')::uuid
                                  ORDER BY (x->>'player_id')::uuid), ARRAY[]::uuid[])
          INTO v_calculated
          FROM jsonb_array_elements(p_payload->'roster') AS x;
      ELSE
        SELECT coalesce(array_agg(DISTINCT (x->>'player_id')::uuid
                                  ORDER BY (x->>'player_id')::uuid), ARRAY[]::uuid[])
          INTO v_calculated
          FROM jsonb_array_elements(p_payload->'roster') AS x
          WHERE EXISTS (
            SELECT 1
              FROM jsonb_array_elements_text(coalesce(x->'team_ids','[]'::jsonb)) AS team_id
              WHERE team_id::uuid IN (
                SELECT selected_id::uuid
                FROM jsonb_array_elements_text(p_payload->'selected_team_ids') AS selected_id
              )
          );
      END IF;
      IF v_expected IS DISTINCT FROM v_calculated THEN
        RAISE EXCEPTION 'expected players do not match saved team selection'
          USING ERRCODE = '22023';
      END IF;
    END IF;
    INSERT INTO public.tracker_sessions
      (id, coach_id, session_date, kind, credit_hours, round_id,
       all_kaizen, needs_round_review, prepared_cache_version)
    VALUES (p_session_id, v_owner, (p_payload->>'session_date')::date,
      p_payload->>'kind', 1.5, v_round.id,
      (p_payload->>'all_kaizen')::boolean, NOT v_round.is_current,
      p_payload->>'prepared_cache_version');

    INSERT INTO public.tracker_session_roster
      (coach_id,session_id,player_id,first_name,jersey_number,short_label,is_guest)
    SELECT v_owner,p_session_id,(x->>'player_id')::uuid,
      coalesce(nullif(x->>'first_name',''),p.first_name),
      coalesce(x->>'jersey_number',p.jersey_number),
      coalesce(x->>'short_label',p.short_label),
      coalesce((x->>'is_guest')::boolean,p.is_guest)
    FROM jsonb_array_elements(p_payload->'roster') AS x
    JOIN public.tracker_players p ON p.coach_id=v_owner
      AND p.id=(x->>'player_id')::uuid;
    INSERT INTO public.tracker_session_memberships
      (coach_id,session_id,player_id,team_id)
    SELECT v_owner,p_session_id,(x->>'player_id')::uuid, team_id::uuid
    FROM jsonb_array_elements(p_payload->'roster') AS x,
         LATERAL jsonb_array_elements_text(coalesce(x->'team_ids','[]'::jsonb)) AS team_id;
    INSERT INTO public.tracker_session_expected_teams
      (coach_id,session_id,team_id)
    SELECT v_owner,p_session_id,x::uuid
    FROM jsonb_array_elements_text(p_payload->'selected_team_ids') AS x;
    INSERT INTO public.tracker_session_expected_players
      (coach_id,session_id,player_id)
    SELECT v_owner,p_session_id,x::uuid
    FROM jsonb_array_elements_text(p_payload->'expected_player_ids') AS x;
    v_result := jsonb_build_object('session_id',p_session_id,
      'revision',0,'round_id',v_round.id,
      'needs_round_review',NOT v_round.is_current);

  ELSIF p_kind = 'set_present_v1' THEN
    IF p_session_id IS NULL OR jsonb_typeof(p_payload->'present') <> 'boolean' THEN
      RAISE EXCEPTION 'invalid attendance payload' USING ERRCODE = '22023';
    END IF;
    v_player := (p_payload->>'player_id')::uuid;
    v_present := (p_payload->>'present')::boolean;
    SELECT * INTO v_session FROM public.tracker_sessions
     WHERE coach_id=v_owner AND id=p_session_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'session not found' USING ERRCODE='42501'; END IF;
    IF v_session.state <> 'active' OR v_session.revision <> p_base_revision THEN
      RAISE EXCEPTION 'stale or completed session' USING ERRCODE='40001';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.tracker_session_roster
                   WHERE coach_id=v_owner AND session_id=p_session_id
                     AND player_id=v_player) THEN
      v_snapshot := p_payload->'snapshot';
      IF jsonb_typeof(v_snapshot) <> 'object'
         OR jsonb_typeof(v_snapshot->'team_ids') <> 'array'
         OR NOT EXISTS (SELECT 1 FROM public.tracker_players
                        WHERE coach_id=v_owner AND id=v_player) THEN
        RAISE EXCEPTION 'unexpected player needs owned snapshot'
          USING ERRCODE='42501';
      END IF;
      IF EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(v_snapshot->'team_ids') AS x
        WHERE NOT EXISTS (SELECT 1 FROM public.tracker_sub_teams t
          WHERE t.coach_id=v_owner AND t.id=x::uuid)
      ) THEN RAISE EXCEPTION 'foreign snapshot team' USING ERRCODE='42501'; END IF;
      INSERT INTO public.tracker_session_roster
        (coach_id,session_id,player_id,first_name,jersey_number,short_label,is_guest)
      SELECT v_owner,p_session_id,v_player,
        coalesce(nullif(v_snapshot->>'first_name',''),p.first_name),
        coalesce(v_snapshot->>'jersey_number',p.jersey_number),
        coalesce(v_snapshot->>'short_label',p.short_label),
        coalesce((v_snapshot->>'is_guest')::boolean,p.is_guest)
      FROM public.tracker_players p WHERE p.coach_id=v_owner AND p.id=v_player;
      INSERT INTO public.tracker_session_memberships
        (coach_id,session_id,player_id,team_id)
      SELECT v_owner,p_session_id,v_player,x::uuid
      FROM jsonb_array_elements_text(v_snapshot->'team_ids') AS x;
    END IF;
    UPDATE public.tracker_sessions SET revision=revision+1
     WHERE coach_id=v_owner AND id=p_session_id;
    INSERT INTO public.tracker_attendance
      (coach_id,session_id,player_id,present,revision,source_operation_id)
    VALUES (v_owner,p_session_id,v_player,v_present,v_session.revision+1,p_operation_id)
    ON CONFLICT (coach_id,session_id,player_id) DO UPDATE
      SET present=EXCLUDED.present,revision=EXCLUDED.revision,
          source_operation_id=EXCLUDED.source_operation_id;
    v_result := jsonb_build_object('session_id',p_session_id,
       'player_id',v_player,'present',v_present,'revision',v_session.revision+1);

  ELSIF p_kind = 'finish_v1' THEN
    IF p_session_id IS NULL THEN
      RAISE EXCEPTION 'finish requires session' USING ERRCODE='22023';
    END IF;
    SELECT * INTO v_session FROM public.tracker_sessions
     WHERE coach_id=v_owner AND id=p_session_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'session not found' USING ERRCODE='42501'; END IF;
    IF v_session.state <> 'active' OR v_session.revision <> p_base_revision THEN
      RAISE EXCEPTION 'stale or completed session' USING ERRCODE='40001';
    END IF;
    UPDATE public.tracker_sessions
      SET state='completed',revision=revision+1,completed_at=now()
      WHERE coach_id=v_owner AND id=p_session_id;
    v_result := jsonb_build_object('session_id',p_session_id,
       'state','completed','revision',v_session.revision+1);

  ELSIF p_kind = 'start_fresh_v1' THEN
    IF p_session_id IS NOT NULL THEN
      RAISE EXCEPTION 'reset cannot target a session' USING ERRCODE='22023';
    END IF;
    SELECT * INTO v_round FROM public.tracker_rounds
      WHERE coach_id=v_owner AND is_current FOR UPDATE;
    IF NOT FOUND OR v_round.id <> (p_payload->>'round_id')::uuid
       OR v_round.revision <> p_base_revision THEN
      RAISE EXCEPTION 'stale raffle round' USING ERRCODE='40001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.tracker_sessions
               WHERE coach_id=v_owner AND state='active') THEN
      RAISE EXCEPTION 'active session blocks raffle reset' USING ERRCODE='40001';
    END IF;
    UPDATE public.tracker_rounds
      SET is_current=false,revision=revision+1,closed_at=now()
      WHERE coach_id=v_owner AND id=v_round.id;
    INSERT INTO public.tracker_rounds (coach_id,generation)
      VALUES (v_owner,v_round.generation+1)
      RETURNING * INTO v_round;
    v_result := jsonb_build_object('round_id',v_round.id,
       'generation',v_round.generation,'round_revision',v_round.revision);
  ELSE
    RAISE EXCEPTION 'unsupported operation' USING ERRCODE='22023';
  END IF;

  UPDATE public.tracker_operations SET result=v_result
    WHERE coach_id=v_owner AND operation_id=p_operation_id;
  RETURN v_result;
END $fn$;

CREATE OR REPLACE FUNCTION public.tracker_apply_operation_v1(
  p_operation_id uuid, p_device_id uuid, p_device_sequence bigint,
  p_kind text, p_session_id uuid, p_base_revision bigint, p_payload jsonb
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $fn$
  SELECT tracker_private.apply_operation_v1(
    p_operation_id,p_device_id,p_device_sequence,p_kind,p_session_id,
    p_base_revision,p_payload)
$fn$;

REVOKE ALL ON FUNCTION tracker_private.protect_session_round_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION tracker_private.initialize_owner_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION tracker_private.apply_operation_v1(uuid,uuid,bigint,text,uuid,bigint,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION tracker_private.initialize_owner_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION tracker_private.apply_operation_v1(uuid,uuid,bigint,text,uuid,bigint,jsonb)
  TO authenticated;
REVOKE ALL ON FUNCTION public.tracker_initialize_owner_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tracker_apply_operation_v1(uuid,uuid,bigint,text,uuid,bigint,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tracker_initialize_owner_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.tracker_apply_operation_v1(uuid,uuid,bigint,text,uuid,bigint,jsonb)
  TO authenticated;

-- New settings default to on; existing explicitly saved values stay intact.
ALTER TABLE public.team_settings ALTER COLUMN raffle_enabled SET DEFAULT true;

CREATE OR REPLACE VIEW public.tracker_ticket_entitlements
WITH (security_invoker = true) AS
SELECT s.coach_id, s.round_id, s.id AS session_id, a.player_id,
       s.session_date, s.archived_at
FROM public.tracker_sessions s
JOIN public.tracker_attendance a
  ON a.coach_id=s.coach_id AND a.session_id=s.id
WHERE s.kind='Optional Training' AND s.state='completed' AND a.present;
REVOKE ALL ON public.tracker_ticket_entitlements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tracker_ticket_entitlements TO authenticated;

-- ===========================================================================
-- Continuation (2026-09-23): coach-owned roster/sub-team writes and an
-- auditable completed-session correction. Still isolated-rehearsal SQL only.
-- Deliberately absent, because the owner has not decided them: player
-- retirement/removal, sub-team retirement, PIN storage/recovery, the round
-- for a newly entered backdated training, correcting a saved expected list,
-- and re-dating a completed session. Nothing here deletes history.
-- ===========================================================================

-- Revisions let a stale offline roster draft be rejected instead of winning.
ALTER TABLE public.tracker_players
  ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0);
ALTER TABLE public.tracker_sub_teams
  ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0);

ALTER TABLE public.tracker_operations DROP CONSTRAINT IF EXISTS tracker_operations_kind_check;
ALTER TABLE public.tracker_operations ADD CONSTRAINT tracker_operations_kind_check
  CHECK (kind IN ('start_v1', 'set_present_v1', 'finish_v1', 'start_fresh_v1',
                  'create_team_v1', 'rename_team_v1',
                  'create_player_v1', 'update_player_v1', 'correct_v1'));

-- One audit row per applied correction: who/what/before/after, never deleted.
CREATE TABLE IF NOT EXISTS public.tracker_session_corrections (
  coach_id uuid NOT NULL,
  session_id uuid NOT NULL,
  operation_id uuid NOT NULL,
  from_revision bigint NOT NULL CHECK (from_revision >= 0),
  to_revision bigint NOT NULL,
  changes jsonb NOT NULL CHECK (jsonb_typeof(changes) = 'array'),
  reason text CHECK (reason IS NULL OR length(reason) <= 500),
  corrected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (coach_id, session_id, to_revision),
  UNIQUE (coach_id, operation_id),
  CHECK (to_revision = from_revision + 1),
  FOREIGN KEY (coach_id, session_id)
    REFERENCES public.tracker_sessions (coach_id, id),
  FOREIGN KEY (coach_id, operation_id)
    REFERENCES public.tracker_operations (coach_id, operation_id)
);
ALTER TABLE public.tracker_session_corrections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tracker_session_corrections FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tracker_session_corrections TO authenticated;
DROP POLICY IF EXISTS tracker_owner_select ON public.tracker_session_corrections;
CREATE POLICY tracker_owner_select ON public.tracker_session_corrections
  FOR SELECT TO authenticated USING (coach_id = (select auth.uid()));

-- Defense in depth beneath the operations: even privileged SQL cannot change
-- a session's credit, kind or expected scope, nor reopen or re-date a
-- completed one. (The round is already protected above.)
CREATE OR REPLACE FUNCTION tracker_private.protect_session_history_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $fn$
BEGIN
  IF NEW.credit_hours IS DISTINCT FROM OLD.credit_hours
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.all_kaizen IS DISTINCT FROM OLD.all_kaizen THEN
    RAISE EXCEPTION 'session credit, kind and expected scope are immutable'
      USING ERRCODE = '23514';
  END IF;
  IF OLD.state = 'completed' AND (
       NEW.state IS DISTINCT FROM OLD.state
       OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
       OR NEW.session_date IS DISTINCT FROM OLD.session_date) THEN
    RAISE EXCEPTION 'a completed session cannot be reopened or re-dated'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS tracker_session_history_immutable ON public.tracker_sessions;
CREATE TRIGGER tracker_session_history_immutable
  BEFORE UPDATE ON public.tracker_sessions
  FOR EACH ROW EXECUTE FUNCTION tracker_private.protect_session_history_v1();

-- Shared ledger claim for the new entry points, identical in shape to the
-- one inside apply_operation_v1: a duplicate ID with the same request
-- returns its stored result; the same ID with a different request fails.
-- Returns NULL when the caller should apply the mutation.
CREATE OR REPLACE FUNCTION tracker_private.claim_operation_v1(
  p_owner uuid, p_operation_id uuid, p_device_id uuid, p_device_sequence bigint,
  p_kind text, p_session_id uuid, p_base_revision bigint, p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $fn$
DECLARE
  v_request jsonb;
  v_existing public.tracker_operations%ROWTYPE;
BEGIN
  IF p_owner IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_operation_id IS NULL OR p_device_id IS NULL OR p_device_sequence IS NULL
     OR p_device_sequence <= 0 OR p_base_revision IS NULL
     OR p_base_revision < 0 OR p_payload IS NULL
     OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid operation envelope' USING ERRCODE = '22023';
  END IF;
  v_request := jsonb_build_object('device_id',p_device_id,
    'device_sequence',p_device_sequence,'kind',p_kind,
    'session_id',p_session_id,'base_revision',p_base_revision,
    'payload',p_payload);
  INSERT INTO public.tracker_operations
    (coach_id, operation_id, device_id, device_sequence, session_id, kind,
     base_revision, request)
  VALUES (p_owner, p_operation_id, p_device_id, p_device_sequence,
          p_session_id, p_kind, p_base_revision, v_request)
  ON CONFLICT (coach_id, operation_id) DO NOTHING;
  SELECT * INTO v_existing FROM public.tracker_operations
   WHERE coach_id = p_owner AND operation_id = p_operation_id FOR UPDATE;
  IF v_existing.request IS DISTINCT FROM v_request THEN
    RAISE EXCEPTION 'operation id reused with different request'
      USING ERRCODE = '23505';
  END IF;
  RETURN v_existing.result;
END $fn$;

-- Roster and sub-team writes. Each payload is the full desired state, so a
-- Stage 4 "Save" is one operation. Identity is the client-generated UUID;
-- name, number, label and team never key history. Session snapshot tables
-- are never touched here, so edits cannot rewrite recorded history.
CREATE OR REPLACE FUNCTION tracker_private.apply_roster_operation_v1(
  p_operation_id uuid, p_device_id uuid, p_device_sequence bigint,
  p_kind text, p_base_revision bigint, p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_owner uuid;
  v_result jsonb;
  v_id uuid;
  v_name text;
  v_first text;
  v_number text;
  v_label text;
  v_guest boolean;
  v_team_ids uuid[];
  v_player public.tracker_players%ROWTYPE;
  v_team public.tracker_sub_teams%ROWTYPE;
BEGIN
  v_owner := auth.uid();
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN
     ('create_team_v1', 'rename_team_v1', 'create_player_v1', 'update_player_v1') THEN
    RAISE EXCEPTION 'unsupported roster operation' USING ERRCODE = '22023';
  END IF;
  v_result := tracker_private.claim_operation_v1(v_owner, p_operation_id,
    p_device_id, p_device_sequence, p_kind, NULL, p_base_revision, p_payload);
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;

  IF p_kind IN ('create_team_v1', 'rename_team_v1') THEN
    v_id := (p_payload->>'team_id')::uuid;
    v_name := btrim(coalesce(p_payload->>'name', ''));
    IF v_id IS NULL OR length(v_name) NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'invalid team payload' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM public.tracker_sub_teams
               WHERE coach_id = v_owner AND id <> v_id AND retired_at IS NULL
                 AND lower(btrim(name)) = lower(v_name)) THEN
      RAISE EXCEPTION 'an active sub-team already uses this name'
        USING ERRCODE = '23505';
    END IF;
    IF p_kind = 'create_team_v1' THEN
      IF p_base_revision <> 0 THEN
        RAISE EXCEPTION 'create requires base revision 0' USING ERRCODE = '22023';
      END IF;
      IF EXISTS (SELECT 1 FROM public.tracker_sub_teams WHERE id = v_id) THEN
        RAISE EXCEPTION 'sub-team id already exists' USING ERRCODE = '23505';
      END IF;
      INSERT INTO public.tracker_sub_teams (id, coach_id, name)
      VALUES (v_id, v_owner, v_name);
      v_result := jsonb_build_object('team_id', v_id, 'name', v_name, 'revision', 0);
    ELSE
      SELECT * INTO v_team FROM public.tracker_sub_teams
       WHERE coach_id = v_owner AND id = v_id FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'sub-team not found' USING ERRCODE = '42501';
      END IF;
      IF v_team.revision <> p_base_revision THEN
        RAISE EXCEPTION 'stale sub-team revision' USING ERRCODE = '40001';
      END IF;
      UPDATE public.tracker_sub_teams SET name = v_name, revision = revision + 1
       WHERE coach_id = v_owner AND id = v_id;
      v_result := jsonb_build_object('team_id', v_id, 'name', v_name,
        'revision', v_team.revision + 1);
    END IF;

  ELSE
    v_id := (p_payload->>'player_id')::uuid;
    v_first := btrim(coalesce(p_payload->>'first_name', ''));
    -- D02: trim surrounding space only; '0' and '00' stay distinct text.
    v_number := nullif(btrim(coalesce(p_payload->>'jersey_number', '')), '');
    v_label := btrim(coalesce(p_payload->>'short_label', ''));
    IF v_id IS NULL OR length(v_first) NOT BETWEEN 1 AND 80
       OR NOT (p_payload ? 'jersey_number')
       OR (v_number IS NOT NULL AND v_number !~ '^[0-9]{1,3}$')
       OR length(v_label) > 24
       OR jsonb_typeof(p_payload->'is_guest') IS DISTINCT FROM 'boolean'
       OR jsonb_typeof(p_payload->'team_ids') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'invalid player payload' USING ERRCODE = '22023';
    END IF;
    v_guest := (p_payload->>'is_guest')::boolean;
    SELECT coalesce(array_agg(DISTINCT x::uuid ORDER BY x::uuid), ARRAY[]::uuid[])
      INTO v_team_ids
      FROM jsonb_array_elements_text(p_payload->'team_ids') AS x;
    IF EXISTS (SELECT 1 FROM unnest(v_team_ids) AS t(id)
               WHERE NOT EXISTS (SELECT 1 FROM public.tracker_sub_teams s
                                 WHERE s.coach_id = v_owner AND s.id = t.id)) THEN
      RAISE EXCEPTION 'foreign or unknown sub-team' USING ERRCODE = '42501';
    END IF;
    -- A retired sub-team cannot gain members; an existing membership may stay.
    IF EXISTS (SELECT 1 FROM unnest(v_team_ids) AS t(id)
               JOIN public.tracker_sub_teams s ON s.coach_id = v_owner AND s.id = t.id
               WHERE s.retired_at IS NOT NULL
                 AND NOT EXISTS (SELECT 1 FROM public.tracker_memberships m
                                 WHERE m.coach_id = v_owner AND m.player_id = v_id
                                   AND m.team_id = t.id)) THEN
      RAISE EXCEPTION 'cannot add a member to a retired sub-team'
        USING ERRCODE = '22023';
    END IF;
    -- R03: identical active cards are rejected; a short label resolves it.
    IF EXISTS (SELECT 1 FROM public.tracker_players p
               WHERE p.coach_id = v_owner AND p.id <> v_id AND p.retired_at IS NULL
                 AND lower(btrim(p.first_name)) = lower(v_first)
                 AND coalesce(p.jersey_number, '') = coalesce(v_number, '')
                 AND lower(btrim(p.short_label)) = lower(v_label)) THEN
      RAISE EXCEPTION 'card collision: add or change a short label'
        USING ERRCODE = '23505';
    END IF;

    IF p_kind = 'create_player_v1' THEN
      IF p_base_revision <> 0 THEN
        RAISE EXCEPTION 'create requires base revision 0' USING ERRCODE = '22023';
      END IF;
      IF EXISTS (SELECT 1 FROM public.tracker_players WHERE id = v_id) THEN
        RAISE EXCEPTION 'player id already exists' USING ERRCODE = '23505';
      END IF;
      INSERT INTO public.tracker_players
        (id, coach_id, first_name, jersey_number, short_label, is_guest)
      VALUES (v_id, v_owner, v_first, v_number, v_label, v_guest);
      INSERT INTO public.tracker_memberships (coach_id, player_id, team_id)
      SELECT v_owner, v_id, t.id FROM unnest(v_team_ids) AS t(id);
      v_result := jsonb_build_object('player_id', v_id, 'revision', 0,
        'jersey_number', v_number, 'team_ids', to_jsonb(v_team_ids));
    ELSE
      SELECT * INTO v_player FROM public.tracker_players
       WHERE coach_id = v_owner AND id = v_id FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'player not found' USING ERRCODE = '42501';
      END IF;
      IF v_player.retired_at IS NOT NULL THEN
        RAISE EXCEPTION 'retired player: edit path awaits the retirement policy'
          USING ERRCODE = '22023';
      END IF;
      IF v_player.revision <> p_base_revision THEN
        RAISE EXCEPTION 'stale player revision' USING ERRCODE = '40001';
      END IF;
      UPDATE public.tracker_players
         SET first_name = v_first, jersey_number = v_number,
             short_label = v_label, is_guest = v_guest, revision = revision + 1
       WHERE coach_id = v_owner AND id = v_id;
      -- Current memberships only. Session membership/expected snapshots are
      -- separate tables and stay exactly as recorded.
      DELETE FROM public.tracker_memberships
       WHERE coach_id = v_owner AND player_id = v_id
         AND NOT (team_id = ANY (v_team_ids));
      INSERT INTO public.tracker_memberships (coach_id, player_id, team_id)
      SELECT v_owner, v_id, t.id FROM unnest(v_team_ids) AS t(id)
      ON CONFLICT DO NOTHING;
      v_result := jsonb_build_object('player_id', v_id,
        'revision', v_player.revision + 1,
        'jersey_number', v_number, 'team_ids', to_jsonb(v_team_ids));
    END IF;
  END IF;

  UPDATE public.tracker_operations SET result = v_result
   WHERE coach_id = v_owner AND operation_id = p_operation_id;
  RETURN v_result;
END $fn$;

-- Completed-session correction (P09 shape; which sessions the UI offers is a
-- Stage 4/6 presentation choice). Same session ID, new revision, audit row.
-- Never changes round, credit, kind, date, expected teams or expected players.
-- Present/absent is set per player; credit and tickets stay derived.
CREATE OR REPLACE FUNCTION tracker_private.correct_session_v1(
  p_operation_id uuid, p_device_id uuid, p_device_sequence bigint,
  p_session_id uuid, p_base_revision bigint, p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_owner uuid;
  v_result jsonb;
  v_session public.tracker_sessions%ROWTYPE;
  v_change jsonb;
  v_snapshot jsonb;
  v_player uuid;
  v_present boolean;
  v_before boolean;
  v_added boolean;
  v_new_revision bigint;
  v_changes jsonb := '[]'::jsonb;
BEGIN
  v_owner := auth.uid();
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  v_result := tracker_private.claim_operation_v1(v_owner, p_operation_id,
    p_device_id, p_device_sequence, 'correct_v1', p_session_id,
    p_base_revision, p_payload);
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;

  IF p_session_id IS NULL
     OR jsonb_typeof(p_payload->'changes') IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_payload->'changes') = 0
     OR coalesce(jsonb_typeof(p_payload->'reason'), 'null') NOT IN ('string', 'null')
     OR length(p_payload->>'reason') > 500 THEN
    RAISE EXCEPTION 'invalid correction payload' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) <> count(DISTINCT x->>'player_id')
        FROM jsonb_array_elements(p_payload->'changes') AS x) THEN
    RAISE EXCEPTION 'a correction lists each player once' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_session FROM public.tracker_sessions
   WHERE coach_id = v_owner AND id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'session not found' USING ERRCODE = '42501';
  END IF;
  IF v_session.state <> 'completed' THEN
    RAISE EXCEPTION 'only a completed session can be corrected'
      USING ERRCODE = '55000';
  END IF;
  IF v_session.revision <> p_base_revision THEN
    RAISE EXCEPTION 'stale session revision' USING ERRCODE = '40001';
  END IF;
  v_new_revision := v_session.revision + 1;

  FOR v_change IN SELECT x FROM jsonb_array_elements(p_payload->'changes') AS x LOOP
    IF jsonb_typeof(v_change->'present') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'invalid correction entry' USING ERRCODE = '22023';
    END IF;
    v_player := (v_change->>'player_id')::uuid;
    v_present := (v_change->>'present')::boolean;
    v_added := false;
    SELECT a.present INTO v_before FROM public.tracker_attendance a
     WHERE a.coach_id = v_owner AND a.session_id = p_session_id
       AND a.player_id = v_player;
    IF NOT EXISTS (SELECT 1 FROM public.tracker_session_roster
                   WHERE coach_id = v_owner AND session_id = p_session_id
                     AND player_id = v_player) THEN
      -- Same rule as an unexpected check-in: owned player, owned teams,
      -- snapshotted now; never added to the saved expected set.
      v_snapshot := v_change->'snapshot';
      IF jsonb_typeof(v_snapshot) IS DISTINCT FROM 'object'
         OR jsonb_typeof(v_snapshot->'team_ids') IS DISTINCT FROM 'array'
         OR NOT EXISTS (SELECT 1 FROM public.tracker_players
                        WHERE coach_id = v_owner AND id = v_player) THEN
        RAISE EXCEPTION 'unexpected player needs owned snapshot'
          USING ERRCODE = '42501';
      END IF;
      IF EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(v_snapshot->'team_ids') AS x
        WHERE NOT EXISTS (SELECT 1 FROM public.tracker_sub_teams t
                          WHERE t.coach_id = v_owner AND t.id = x::uuid)
      ) THEN
        RAISE EXCEPTION 'foreign snapshot team' USING ERRCODE = '42501';
      END IF;
      INSERT INTO public.tracker_session_roster
        (coach_id, session_id, player_id, first_name, jersey_number, short_label, is_guest)
      SELECT v_owner, p_session_id, v_player,
        coalesce(nullif(v_snapshot->>'first_name', ''), p.first_name),
        coalesce(v_snapshot->>'jersey_number', p.jersey_number),
        coalesce(v_snapshot->>'short_label', p.short_label),
        coalesce((v_snapshot->>'is_guest')::boolean, p.is_guest)
      FROM public.tracker_players p WHERE p.coach_id = v_owner AND p.id = v_player;
      INSERT INTO public.tracker_session_memberships
        (coach_id, session_id, player_id, team_id)
      SELECT v_owner, p_session_id, v_player, x::uuid
      FROM jsonb_array_elements_text(v_snapshot->'team_ids') AS x;
      v_added := true;
    END IF;
    INSERT INTO public.tracker_attendance
      (coach_id, session_id, player_id, present, revision, source_operation_id)
    VALUES (v_owner, p_session_id, v_player, v_present, v_new_revision, p_operation_id)
    ON CONFLICT (coach_id, session_id, player_id) DO UPDATE
      SET present = EXCLUDED.present, revision = EXCLUDED.revision,
          source_operation_id = EXCLUDED.source_operation_id;
    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'player_id', v_player, 'before', to_jsonb(v_before), 'after', v_present,
      'snapshot_added', v_added));
  END LOOP;

  UPDATE public.tracker_sessions SET revision = v_new_revision
   WHERE coach_id = v_owner AND id = p_session_id;
  INSERT INTO public.tracker_session_corrections
    (coach_id, session_id, operation_id, from_revision, to_revision, changes, reason)
  VALUES (v_owner, p_session_id, p_operation_id, v_session.revision,
          v_new_revision, v_changes, p_payload->>'reason');
  v_result := jsonb_build_object('session_id', p_session_id, 'state', 'completed',
    'revision', v_new_revision, 'round_id', v_session.round_id,
    'credit_hours', v_session.credit_hours, 'changes', v_changes);

  UPDATE public.tracker_operations SET result = v_result
   WHERE coach_id = v_owner AND operation_id = p_operation_id;
  RETURN v_result;
END $fn$;

CREATE OR REPLACE FUNCTION public.tracker_apply_roster_operation_v1(
  p_operation_id uuid, p_device_id uuid, p_device_sequence bigint,
  p_kind text, p_base_revision bigint, p_payload jsonb
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $fn$
  SELECT tracker_private.apply_roster_operation_v1(
    p_operation_id, p_device_id, p_device_sequence, p_kind,
    p_base_revision, p_payload)
$fn$;

CREATE OR REPLACE FUNCTION public.tracker_correct_session_v1(
  p_operation_id uuid, p_device_id uuid, p_device_sequence bigint,
  p_session_id uuid, p_base_revision bigint, p_payload jsonb
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $fn$
  SELECT tracker_private.correct_session_v1(
    p_operation_id, p_device_id, p_device_sequence, p_session_id,
    p_base_revision, p_payload)
$fn$;

REVOKE ALL ON FUNCTION tracker_private.protect_session_history_v1()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION tracker_private.claim_operation_v1(uuid,uuid,uuid,bigint,text,uuid,bigint,jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION tracker_private.apply_roster_operation_v1(uuid,uuid,bigint,text,bigint,jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION tracker_private.correct_session_v1(uuid,uuid,bigint,uuid,bigint,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION tracker_private.apply_roster_operation_v1(uuid,uuid,bigint,text,bigint,jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION tracker_private.correct_session_v1(uuid,uuid,bigint,uuid,bigint,jsonb)
  TO authenticated;
REVOKE ALL ON FUNCTION public.tracker_apply_roster_operation_v1(uuid,uuid,bigint,text,bigint,jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tracker_correct_session_v1(uuid,uuid,bigint,uuid,bigint,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tracker_apply_roster_operation_v1(uuid,uuid,bigint,text,bigint,jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.tracker_correct_session_v1(uuid,uuid,bigint,uuid,bigint,jsonb)
  TO authenticated;
