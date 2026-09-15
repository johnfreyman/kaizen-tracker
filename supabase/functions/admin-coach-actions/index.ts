import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Action = "list-coaches" | "resend-verification" | "force-logout" | "suspend-account" | "view-as-coach" | "invite-coach";

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

    switch (action) {
      case "list-coaches": {
        const { data, error } = await adminClient
          .from("admin_coach_summary_view")
          .select("*");
        if (error) throw error;
        return json({ coaches: data ?? [] }, 200);
      }
      case "resend-verification": {
        if (!email) return json({ error: "Missing email for resend-verification" }, 400);
        const { error } = await adminClient.auth.admin.generateLink({
          type: "signup",
          email,
        });
        if (error) throw error;
        break;
      }
      case "force-logout": {
        const { error } = await adminClient.auth.admin.signOut(coachId, "global");
        if (error) throw error;
        break;
      }
      case "suspend-account": {
        // 876000h ≈ 100 years — effectively permanent until manually lifted
        const { error } = await adminClient.auth.admin.updateUserById(coachId, {
          ban_duration: "876000h",
        });
        if (error) throw error;
        break;
      }
      case "view-as-coach": {
        if (!email) return json({ error: "Missing email for view-as-coach" }, 400);
        // generateLink does NOT send any email — it returns the link for us to use directly
        const { data: linkData, error } = await adminClient.auth.admin.generateLink({
          type: "magiclink",
          email,
        });
        if (error) throw error;
        return json({ success: true, link: linkData.properties.action_link }, 200);
      }
      case "invite-coach": {
        if (!email) return json({ error: "Missing email for invite-coach" }, 400);
        const { error } = await adminClient.auth.admin.inviteUserByEmail(email);
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
