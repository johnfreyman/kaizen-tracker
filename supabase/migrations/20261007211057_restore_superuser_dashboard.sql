-- Canonical details are read only by the protected server-side admin handler.
-- Browser ownership policies and privileged-summary grants stay unchanged.
SET LOCAL ROLE postgres;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

GRANT SELECT ON public.tracker_players, public.tracker_sub_teams,
  public.tracker_memberships, public.tracker_sessions,
  public.tracker_session_roster, public.tracker_attendance,
  public.tracker_session_expected_players, public.tracker_session_expected_teams,
  public.tracker_session_memberships, public.tracker_rounds,
  public.tracker_draws, public.tracker_session_corrections TO service_role;
GRANT SELECT (user_id) ON public.super_admins TO service_role;

-- The Auth signOut API requires a JWT, not a user ID. This narrow helper
-- revokes a selected coach's refresh sessions after checking the actual
-- caller's administrator membership. Access tokens last until expiry.
CREATE FUNCTION tracker_private.revoke_coach_sessions_v1(p_coach_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_count integer; v_admin uuid := auth.uid();
BEGIN
  IF v_admin IS NULL OR NOT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id=v_admin) THEN
    RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501';
  END IF;
  IF p_coach_id IS NULL THEN RAISE EXCEPTION 'Coach is required' USING ERRCODE='22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.super_admins WHERE user_id=p_coach_id) THEN
    RAISE EXCEPTION 'Superuser accounts are protected' USING ERRCODE='42501';
  END IF;
  PERFORM 1 FROM auth.users WHERE id=p_coach_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Coach not found' USING ERRCODE='P0002'; END IF;
  DELETE FROM auth.sessions WHERE user_id=p_coach_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  INSERT INTO public.activity_log(event_type,coach_id,metadata)
    VALUES ('admin_sessions_revoked',p_coach_id,jsonb_build_object('admin_id',v_admin,'sessions_revoked',v_count));
  RETURN v_count;
END $function$;
REVOKE ALL ON FUNCTION tracker_private.revoke_coach_sessions_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION tracker_private.revoke_coach_sessions_v1(uuid) TO authenticated;

CREATE FUNCTION public.admin_revoke_coach_sessions_v1(p_coach_id uuid)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $function$
  SELECT tracker_private.revoke_coach_sessions_v1(p_coach_id)
$function$;
REVOKE ALL ON FUNCTION public.admin_revoke_coach_sessions_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_revoke_coach_sessions_v1(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
