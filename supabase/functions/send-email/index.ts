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

  // Port 465 = direct SSL/TLS, Port 587 = plain then STARTTLS
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

  // Read greeting
  await readResponse();

  // EHLO
  await sendCommand(`EHLO localhost`);

  // STARTTLS for port 587
  if (port !== 465 && smtp.use_ssl !== true) {
    const starttlsResp = await sendCommand("STARTTLS");
    if (starttlsResp.startsWith("220")) {
      // Upgrade to TLS
      conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: host });
      // Re-EHLO after TLS upgrade
      await sendCommand(`EHLO localhost`);
    }
  }

  // AUTH LOGIN
  if (username && password) {
    await sendCommand("AUTH LOGIN");
    await sendCommand(btoa(username));
    const authResp = await sendCommand(btoa(password));
    if (!authResp.startsWith("235")) {
      conn.close();
      throw new Error("SMTP Authentication failed: " + authResp);
    }
  }

  // MAIL FROM
  const mailFromResp = await sendCommand(`MAIL FROM:<${fromEmail}>`);
  if (!mailFromResp.startsWith("250")) {
    conn.close();
    throw new Error("MAIL FROM rejected: " + mailFromResp);
  }

  // RCPT TO
  const rcptResp = await sendCommand(`RCPT TO:<${to}>`);
  if (!rcptResp.startsWith("250")) {
    conn.close();
    throw new Error("RCPT TO rejected: " + rcptResp);
  }

  // DATA
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

  const dataResp = await sendCommand(message);
  
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

    // Check admin or allow internal calls
    const { data: roleCheck } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .in("role", ["admin", "engineer"])
      .maybeSingle();
    if (!roleCheck) throw new Error("Only authenticated users with roles can send emails");

    const { to, subject, html } = await req.json();
    if (!to || !subject || !html) throw new Error("to, subject, and html are required");

    console.log("Sending email to:", to, "Subject:", subject);

    // Fetch SMTP settings
    const { data: smtp, error: smtpError } = await supabaseAdmin
      .from("smtp_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    console.log("SMTP settings found:", smtp ? "yes" : "no", "Error:", smtpError?.message);

    if (!smtp || !smtp.host) {
      throw new Error("SMTP settings not configured. Please configure in Settings → SMTP.");
    }

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
