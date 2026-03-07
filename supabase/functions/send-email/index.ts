import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sendViaSMTP(smtp: any, to: string, subject: string, html: string) {
  const username = smtp.username || "";
  const password = smtp.password || "";
  const fromEmail = smtp.from_email || username || "noreply@example.com";
  const fromName = smtp.from_name || "Project Hub";
  const host = smtp.host;
  const port = smtp.port || 587;

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let conn: Deno.Conn;

  if (port === 465 || smtp.use_ssl === true) {
    conn = await Deno.connectTls({ hostname: host, port });
  } else {
    conn = await Deno.connect({ hostname: host, port });
  }

  async function readResponse(): Promise<string> {
    const buf = new Uint8Array(4096);
    const n = await conn.read(buf);
    if (n === null) throw new Error("Connection closed");
    return decoder.decode(buf.subarray(0, n));
  }

  async function sendCommand(cmd: string): Promise<string> {
    await conn.write(encoder.encode(cmd + "\r\n"));
    return await readResponse();
  }

  await readResponse();
  await sendCommand(`EHLO localhost`);

  if (port !== 465 && smtp.use_ssl !== true) {
    const starttlsResp = await sendCommand("STARTTLS");
    if (starttlsResp.startsWith("220")) {
      conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: host });
      await sendCommand(`EHLO localhost`);
    }
  }

  if (username && password) {
    await sendCommand("AUTH LOGIN");
    await sendCommand(btoa(username));
    const authResp = await sendCommand(btoa(password));
    if (!authResp.startsWith("235")) {
      conn.close();
      throw new Error("SMTP Authentication failed: " + authResp);
    }
  }

  const mailFromResp = await sendCommand(`MAIL FROM:<${fromEmail}>`);
  if (!mailFromResp.startsWith("250")) {
    conn.close();
    throw new Error("MAIL FROM rejected: " + mailFromResp);
  }

  const rcptResp = await sendCommand(`RCPT TO:<${to}>`);
  if (!rcptResp.startsWith("250")) {
    conn.close();
    throw new Error("RCPT TO rejected: " + rcptResp);
  }

  await sendCommand("DATA");
  const message = [
    `From: "${fromName}" <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    html,
    `.`,
  ].join("\r\n");

  await sendCommand(message);
  await sendCommand("QUIT");
  conn.close();

  console.log("Email sent successfully to:", to);
  return { success: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized - no auth header");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) throw new Error("Unauthorized");

    // Allow any authenticated user with a role to send emails
    const { data: roleCheck } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .limit(1);
    if (!roleCheck || roleCheck.length === 0) throw new Error("Only users with roles can send emails");

    const body = await req.json();
    const { to, subject, html, target_role } = body;

    // Get SMTP settings
    const { data: smtp, error: smtpError } = await supabaseAdmin
      .from("smtp_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    console.log("SMTP settings found:", smtp ? "yes" : "no", "Error:", smtpError?.message);

    if (!smtp || !smtp.host) {
      throw new Error("SMTP settings not configured. Please configure in Settings → SMTP.");
    }

    // If target_role is provided, look up recipients by role (bypasses RLS via service role)
    if (target_role) {
      if (!subject || !html) throw new Error("subject and html are required");
      
      console.log("Looking up users with role:", target_role);
      const { data: roleUsers, error: roleError } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", target_role);
      
      if (roleError) {
        console.error("Error looking up role users:", roleError.message);
        throw new Error("Failed to find users with role: " + target_role);
      }
      
      if (!roleUsers || roleUsers.length === 0) {
        console.log("No users found with role:", target_role);
        return new Response(
          JSON.stringify({ success: true, message: "No users with that role" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      const userIds = roleUsers.map(r => r.user_id);
      const { data: profiles, error: profError } = await supabaseAdmin
        .from("profiles")
        .select("email, first_name")
        .in("id", userIds);

      if (profError || !profiles?.length) {
        console.log("No profiles found for role users");
        return new Response(
          JSON.stringify({ success: true, message: "No profiles found for role" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      console.log(`Sending email to ${profiles.length} users with role ${target_role}`);
      for (const p of profiles) {
        const personalizedHtml = html.replace(/\{\{name\}\}/g, p.first_name || "");
        try {
          await sendViaSMTP(smtp, p.email, subject, personalizedHtml);
        } catch (err) {
          console.error(`Failed to send to ${p.email}:`, err.message);
        }
      }

      return new Response(
        JSON.stringify({ success: true, sent_to: profiles.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Direct send mode - to, subject, html required
    if (!to || !subject || !html) throw new Error("to, subject, and html are required");

    console.log("Sending email to:", to, "Subject:", subject);
    await sendViaSMTP(smtp, to, subject, html);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Send email error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
