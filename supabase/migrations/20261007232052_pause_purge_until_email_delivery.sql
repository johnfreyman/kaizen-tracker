-- Audit A2: the purge job records reminder milestones as "sent", but nothing
-- delivers email. Until real delivery exists and is verified, stop the daily
-- job so no account advances toward deletion on unsent reminders.
--
-- This only pauses the schedule. The job, the function, existing purge state
-- and the admin's explicit "purge now" / "extend deadline" actions remain.
-- To resume after email delivery is in place, use a new reviewed migration:
--   SELECT cron.alter_job(job_id := <id>, active := true);
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE v_job bigint;
BEGIN
  SELECT jobid INTO v_job FROM cron.job WHERE jobname = 'process-purge-lifecycle';
  IF v_job IS NULL THEN
    RAISE EXCEPTION 'process-purge-lifecycle job not found';
  END IF;
  PERFORM cron.alter_job(job_id := v_job, active := false);
  IF (SELECT active FROM cron.job WHERE jobid = v_job) THEN
    RAISE EXCEPTION 'purge job is still active';
  END IF;
END $$;

INSERT INTO public.activity_log (event_type, metadata)
VALUES ('purge_schedule_paused',
        jsonb_build_object('reason', 'reminder emails not delivered (audit A2)',
                           'migration', '20261007233000'));
