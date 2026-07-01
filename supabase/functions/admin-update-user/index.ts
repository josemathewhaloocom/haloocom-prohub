import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) throw new Error("Unauthorized");

    const { data: roleCheck } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "project_manager")
      .maybeSingle();
    if (!roleCheck) throw new Error("Only Project Managers can update users");

    const { user_id, email, password, first_name, last_name } = await req.json();
    if (!user_id) throw new Error("user_id is required");

    const authUpdate: Record<string, unknown> = {};
    if (email) authUpdate.email = email;
    if (password) {
      if (password.length < 6) throw new Error("Password must be at least 6 characters");
      authUpdate.password = password;
    }
    if (first_name !== undefined || last_name !== undefined) {
      authUpdate.user_metadata = { first_name: first_name ?? "", last_name: last_name ?? "" };
    }

    if (Object.keys(authUpdate).length > 0) {
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(user_id, authUpdate);
      if (authErr) throw authErr;
    }

    const profileUpdate: Record<string, unknown> = {};
    if (email) profileUpdate.email = email;
    if (first_name !== undefined) profileUpdate.first_name = first_name;
    if (last_name !== undefined) profileUpdate.last_name = last_name;
    if (Object.keys(profileUpdate).length > 0) {
      const { error: profErr } = await supabaseAdmin
        .from("profiles")
        .update(profileUpdate)
        .eq("id", user_id);
      if (profErr) throw profErr;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
