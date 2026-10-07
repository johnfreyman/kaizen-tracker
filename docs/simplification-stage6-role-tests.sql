-- Isolated Stage 6 rehearsal. All mutations roll back. Coach B and the ticket
-- fixture are synthetic records from the Stage 3 test project.
BEGIN;
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
SET LOCAL ROLE authenticated;
DO $test$
DECLARE
  v_device uuid := gen_random_uuid();
  v_enable uuid := gen_random_uuid();
  v_draw_op uuid := gen_random_uuid();
  v_void_op uuid := gen_random_uuid();
  v_fresh_op uuid := gen_random_uuid();
  v_draw uuid := gen_random_uuid();
  v_before jsonb;
  v_snapshot jsonb;
  v_result jsonb;
  v_repeat jsonb;
  v_round uuid;
  v_revision bigint;
BEGIN
  v_before := public.tracker_raffle_snapshot_v1(0);
  v_round := (v_before->>'round_id')::uuid;
  v_revision := (v_before->>'round_revision')::bigint;
  IF (v_before->>'pool_count')::integer < 1 THEN
    RAISE EXCEPTION 'synthetic Coach B must have an earned current-round ticket';
  END IF;

  v_result := public.tracker_apply_raffle_operation_v1(v_enable,v_device,1,
    'set_raffle_v1',v_revision,jsonb_build_object('round_id',v_round,'mode','keep'));
  v_repeat := public.tracker_apply_raffle_operation_v1(v_enable,v_device,1,
    'set_raffle_v1',v_revision,jsonb_build_object('round_id',v_round,'mode','keep'));
  IF v_result IS DISTINCT FROM v_repeat OR (v_result->>'raffle_enabled')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Keep replay or enable result failed';
  END IF;
  v_snapshot := public.tracker_raffle_snapshot_v1(0);
  IF (v_snapshot->>'pool_count')::integer <> (v_before->>'pool_count')::integer THEN
    RAISE EXCEPTION 'Keep changed earned tickets';
  END IF;

  v_result := public.tracker_apply_raffle_operation_v1(v_draw_op,v_device,2,
    'draw_v1',(v_snapshot->>'round_revision')::bigint,
    jsonb_build_object('round_id',v_round,'draw_id',v_draw,'prize','Synthetic test',
      'exclude_last_n',0,'pool_hash',v_snapshot->>'pool_hash'));
  v_repeat := public.tracker_apply_raffle_operation_v1(v_draw_op,v_device,2,
    'draw_v1',(v_snapshot->>'round_revision')::bigint,
    jsonb_build_object('round_id',v_round,'draw_id',v_draw,'prize','Synthetic test',
      'exclude_last_n',0,'pool_hash',v_snapshot->>'pool_hash'));
  IF v_result IS DISTINCT FROM v_repeat OR v_result->>'draw_id' IS DISTINCT FROM v_draw::text THEN
    RAISE EXCEPTION 'draw replay created a different result';
  END IF;
  v_snapshot := public.tracker_raffle_snapshot_v1(0);
  IF (v_snapshot->>'pool_count')::integer <> (v_before->>'pool_count')::integer
      OR (SELECT count(*) FROM public.tracker_draws WHERE id=v_draw) <> 1 THEN
    RAISE EXCEPTION 'draw consumed tickets or duplicated history';
  END IF;

  v_result := public.tracker_apply_raffle_operation_v1(v_void_op,v_device,3,
    'void_draw_v1',(v_snapshot->>'round_revision')::bigint,
    jsonb_build_object('round_id',v_round,'draw_id',v_draw));
  IF v_result->>'voided_at' IS NULL THEN RAISE EXCEPTION 'draw undo was not audited'; END IF;
  v_snapshot := public.tracker_raffle_snapshot_v1(0);
  IF (v_snapshot->>'pool_count')::integer <> (v_before->>'pool_count')::integer
      OR (SELECT voided_at FROM public.tracker_draws WHERE id=v_draw) IS NULL THEN
    RAISE EXCEPTION 'undo changed tickets or lost its void marker';
  END IF;

  v_result := public.tracker_apply_raffle_operation_v1(v_fresh_op,v_device,4,
    'set_raffle_v1',(v_snapshot->>'round_revision')::bigint,
    jsonb_build_object('round_id',v_round,'mode','fresh'));
  v_repeat := public.tracker_apply_raffle_operation_v1(v_fresh_op,v_device,4,
    'set_raffle_v1',(v_snapshot->>'round_revision')::bigint,
    jsonb_build_object('round_id',v_round,'mode','fresh'));
  IF v_result IS DISTINCT FROM v_repeat OR v_result->>'round_id' = v_round::text THEN
    RAISE EXCEPTION 'Start fresh replay opened a second round';
  END IF;
  v_snapshot := public.tracker_raffle_snapshot_v1(0);
  IF (v_snapshot->>'pool_count')::integer <> 0
      OR jsonb_array_length(v_snapshot->'draws') <> jsonb_array_length(v_before->'draws') + 1
      OR (SELECT count(*) FROM public.tracker_ticket_entitlements WHERE coach_id=auth.uid() AND round_id=v_round)
         <> (v_before->>'pool_count')::integer THEN
    RAISE EXCEPTION 'Start fresh changed history or retained old tickets';
  END IF;

  PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
  IF EXISTS (SELECT 1 FROM public.tracker_draws WHERE id=v_draw) THEN
    RAISE EXCEPTION 'Coach A can read Coach B draw';
  END IF;
END
$test$;
ROLLBACK;
