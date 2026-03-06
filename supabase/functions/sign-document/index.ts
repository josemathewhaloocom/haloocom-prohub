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

    if (req.method === "GET") {
      const url = new URL(req.url);
      const token = url.searchParams.get("token");
      if (!token) throw new Error("Token is required");

      const { data: doc, error } = await supabaseAdmin
        .from("documents")
        .select("id, file_name, file_url, document_type, signed_at, signing_token_expires_at, project_id, projects(name)")
        .eq("signing_token", token)
        .maybeSingle();

      if (error || !doc) throw new Error("Document not found or link is invalid");
      if (doc.signed_at) throw new Error("This document has already been signed");
      if (doc.signing_token_expires_at && new Date(doc.signing_token_expires_at) < new Date()) {
        throw new Error("This signing link has expired");
      }

      const { data: signedUrl } = await supabaseAdmin.storage
        .from("documents")
        .createSignedUrl(doc.file_url, 3600);

      return new Response(
        JSON.stringify({
          id: doc.id,
          file_name: doc.file_name,
          document_type: doc.document_type,
          project_name: (doc as any).projects?.name ?? "Unknown Project",
          file_signed_url: signedUrl?.signedUrl ?? null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    if (req.method === "POST") {
      const { token, signature_url, signer_name } = await req.json();
      if (!token || !signature_url || !signer_name) {
        throw new Error("token, signature_url, and signer_name are required");
      }

      const { data: doc } = await supabaseAdmin
        .from("documents")
        .select("id, file_name, signed_at, signing_token_expires_at, project_id")
        .eq("signing_token", token)
        .maybeSingle();

      if (!doc) throw new Error("Document not found");
      if (doc.signed_at) throw new Error("Already signed");
      if (doc.signing_token_expires_at && new Date(doc.signing_token_expires_at) < new Date()) {
        throw new Error("Link expired");
      }

      const signer_ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("cf-connecting-ip") || "unknown";

      const { error: updateError } = await supabaseAdmin
        .from("documents")
        .update({
          signature_url,
          signed_at: new Date().toISOString(),
          signer_name,
          signer_ip,
        })
        .eq("id", doc.id);

      if (updateError) throw updateError;

      let projectName = "Unknown Project";

      // Auto-update project status to client_signed when client signs via public portal
      if (doc.project_id) {
        const { data: project } = await supabaseAdmin
          .from("projects")
          .select("status, name")
          .eq("id", doc.project_id)
          .maybeSingle();

        if (project) {
          projectName = project.name;
          if (project.status === "client_signing_pending") {
            await supabaseAdmin
              .from("projects")
              .update({ status: "client_signed" })
              .eq("id", doc.project_id);
          }
        }
      }

      // Send email notification to all Project Managers about client signature
      try {
        const { data: pmRoles } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("role", "project_manager");

        if (pmRoles?.length) {
          const { data: pmProfiles } = await supabaseAdmin
            .from("profiles")
            .select("email, first_name")
            .in("id", pmRoles.map((r: any) => r.user_id));

          const { data: smtp } = await supabaseAdmin
            .from("smtp_settings")
            .select("*")
            .limit(1)
            .maybeSingle();

          if (smtp?.host && pmProfiles?.length) {
            for (const pm of pmProfiles) {
              try {
                await sendViaSMTP(
                  smtp,
                  pm.email,
                  `Client signed document on project: ${projectName}`,
                  `<h2>Client Signature Received</h2>
                   <p>Hi ${pm.first_name},</p>
                   <p>Client <strong>${signer_name}</strong> has signed the document <strong>${doc.file_name}</strong> on project <strong>${projectName}</strong>.</p>
                   <p>Please review and approve the document.</p>`
                );
                console.log("PM notification sent to:", pm.email);
              } catch (emailErr) {
                console.error("Failed to send PM notification to:", pm.email, emailErr);
              }
            }
          } else {
            console.log("SMTP not configured or no PM profiles found");
          }
        }
      } catch (emailErr) {
        console.error("PM notification from public sign failed:", emailErr);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
