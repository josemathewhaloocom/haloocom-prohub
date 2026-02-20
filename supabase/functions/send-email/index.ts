import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) throw new Error("Unauthorized");

    const { data: roleCheck } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleCheck) throw new Error("Only admins can send emails");

    const { to, subject, html } = await req.json();
    if (!to || !subject || !html) throw new Error("to, subject, and html are required");

    // Fetch SMTP settings
    const { data: smtp } = await supabaseAdmin
      .from("smtp_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (!smtp || !smtp.host) throw new Error("SMTP settings not configured. Please configure in Settings.");

    const client = new SmtpClient();

    const connectConfig: any = {
      hostname: smtp.host,
      port: smtp.port || 587,
      username: smtp.username || "",
      password: smtp.password || "",
    };

    if (smtp.use_tls) {
      await client.connectTLS(connectConfig);
    } else {
      await client.connect(connectConfig);
    }

    await client.send({
      from: smtp.from_email || smtp.username || "noreply@example.com",
      to,
      subject,
      content: "",
      html,
    });

    await client.close();

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
