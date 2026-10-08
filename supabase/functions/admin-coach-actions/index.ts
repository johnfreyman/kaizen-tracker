import { createClient } from "npm:@supabase/supabase-js@2.105.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Action = "list-coaches" | "coach-data" | "resend-verification" | "force-logout" | "suspend-account" | "restore-account" | "view-as-coach" | "invite-coach";
const coachAppUrl = 'https://teamtracker.leftbraincreative.xyz/';

// Only canonical coach data belongs in details/exports. Never include PIN
// verifiers, authentication records, service keys or operation request bodies.
const coachDataTables = [
  ["players", "tracker_players", "id,first_name,jersey_number,short_label,is_guest,retired_at,revision", ["id"]],
  ["teams", "tracker_sub_teams", "id,name,retired_at,revision", ["id"]],
  ["memberships", "tracker_memberships", "player_id,team_id", ["player_id", "team_id"]],
  ["sessions", "tracker_sessions", "id,session_date,kind,credit_hours,state,round_id,all_kaizen,created_at,completed_at,archived_at", ["id"]],
  ["sessionRoster", "tracker_session_roster", "session_id,player_id,first_name,jersey_number,short_label,is_guest", ["session_id", "player_id"]],
  ["attendance", "tracker_attendance", "session_id,player_id,present,revision", ["session_id", "player_id"]],
  ["expectedPlayers", "tracker_session_expected_players", "session_id,player_id", ["session_id", "player_id"]],
  ["expectedTeams", "tracker_session_expected_teams", "session_id,team_id", ["session_id", "team_id"]],
  ["sessionMemberships", "tracker_session_memberships", "session_id,player_id,team_id", ["session_id", "player_id", "team_id"]],
  ["rounds", "tracker_rounds", "id,generation,is_current,opened_at,closed_at", ["id"]],
  ["draws", "tracker_draws", "id,round_id,player_id,display_name,prize,pool_count,drawn_at,voided_at", ["id"]],
  ["corrections", "tracker_session_corrections", "session_id,from_revision,to_revision,changes,reason,corrected_at", ["session_id", "to_revision"]],
] as const;

interface RequestBody {
  action: Action;
  coachId?: string;
  email?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { action, coachId, email }: RequestBody = await req.json();
    if (!action) {
      return json({ error: "Missing required field: action" }, 400);
    }
    if (action !== "invite-coach" && action !== "list-coaches" && !coachId) {
      return json({ error: "Missing required field: coachId" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller is authenticated
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser();
    if (userError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Verify the caller is a super admin using their own JWT (matches the RLS policy)
    const { data: adminRow, error: adminError } = await callerClient
      .from("super_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (adminError || !adminRow) {
      return json({ error: "Forbidden" }, 403);
    }

    // Only verified super admins may use this privileged client.
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let targetEmail: string | undefined;
    let bannedUntil: string | null = null;
    if (action !== 'invite-coach' && action !== 'list-coaches') {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(coachId!)) return json({ error: 'Invalid coachId' }, 400);
      const { data: target, error: targetError } = await adminClient.auth.admin.getUserById(coachId!);
      if (targetError || !target.user) return json({ error: 'Coach not found' }, 404);
      targetEmail = target.user.email;
      bannedUntil = target.user.banned_until ?? null;
      // Account controls cannot lock out the retained administrator.
      if (action === 'force-logout' || action === 'suspend-account' || action === 'restore-account') {
        const { data: targetAdmin, error: targetAdminError } = await adminClient.from('super_admins').select('user_id').eq('user_id', coachId!).maybeSingle();
        if (targetAdminError) throw targetAdminError;
        if (targetAdmin) return json({ error: 'Superuser accounts are protected' }, 403);
      }
    }

    switch (action) {
      case "list-coaches": {
        const { data, error } = await adminClient
          .from("admin_coach_summary_view")
          .select("*");
        if (error) throw error;
        return json({ coaches: data ?? [] }, 200);
      }
      case "coach-data": {
        const entries = await Promise.all(coachDataTables.map(async ([name, table, columns, order]) => {
          const rows: unknown[] = [];
          for (let from = 0; ; from += 500) {
            let query = adminClient.from(table).select(columns).eq("coach_id", coachId!);
            for (const column of order) query = query.order(column);
            const { data, error } = await query.range(from, from + 499);
            if (error) throw error;
            rows.push(...(data ?? []));
            if (!data || data.length < 500) break;
          }
          return [name, rows] as const;
        }));
        return json({ coachId, account: { bannedUntil }, ...Object.fromEntries(entries) }, 200);
      }
      case "resend-verification": {
        if (!targetEmail) return json({ error: "Coach has no email" }, 400);
        const { error } = await callerClient.auth.resend({
          type: "signup",
          email: targetEmail,
          options: { emailRedirectTo: coachAppUrl },
        });
        if (error) throw error;
        break;
      }
      case "force-logout": {
        const { error } = await callerClient.rpc('admin_revoke_coach_sessions_v1', { p_coach_id: coachId });
        if (error) throw error;
        return json({ success: true, message: 'Saved sign-in sessions revoked. An existing access token can remain valid until it expires.' }, 200);
      }
      case "suspend-account": {
        // 876000h ≈ 100 years — effectively permanent until manually lifted
        const { error } = await adminClient.auth.admin.updateUserById(coachId!, {
          ban_duration: "876000h",
        });
        if (error) throw error;
        break;
      }
      case "restore-account": {
        const { error } = await adminClient.auth.admin.updateUserById(coachId!, { ban_duration: 'none' });
        if (error) throw error;
        break;
      }
      case "view-as-coach": {
        if (!targetEmail) return json({ error: "Coach has no email" }, 400);
        // generateLink does NOT send any email — it returns the link for us to use directly
        const { data: linkData, error } = await adminClient.auth.admin.generateLink({
          type: "magiclink",
          email: targetEmail,
        });
        if (error) throw error;
        return json({ success: true, link: linkData.properties.action_link }, 200);
      }
      case "invite-coach": {
        if (!email) return json({ error: "Missing email for invite-coach" }, 400);
        const { error } = await adminClient.auth.admin.inviteUserByEmail(email, { redirectTo: coachAppUrl });
        if (error) throw error;
        break;
      }
      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }

    return json({ success: true }, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
