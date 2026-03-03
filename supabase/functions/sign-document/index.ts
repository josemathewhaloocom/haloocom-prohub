import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
        .select("id, signed_at, signing_token_expires_at, project_id")
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

      // Auto-update project status to client_signed when client signs via public portal
      if (doc.project_id) {
        const { data: project } = await supabaseAdmin
          .from("projects")
          .select("status, name")
          .eq("id", doc.project_id)
          .maybeSingle();

        if (project && project.status === "client_signing_pending") {
          await supabaseAdmin
            .from("projects")
            .update({ status: "client_signed" })
            .eq("id", doc.project_id);
        }

        // Send email to all admins about client signature
        try {
          const { data: adminRoles } = await supabaseAdmin
            .from("user_roles")
            .select("user_id")
            .eq("role", "admin");

          if (adminRoles?.length) {
            const { data: adminProfiles } = await supabaseAdmin
              .from("profiles")
              .select("email, first_name")
              .in("id", adminRoles.map((r: any) => r.user_id));

            const { data: smtp } = await supabaseAdmin
              .from("smtp_settings")
              .select("*")
              .limit(1)
              .maybeSingle();

            if (smtp?.host && adminProfiles?.length) {
              // We can't call our own edge function from here, so send directly
              // For now, log it - the in-app signing path handles admin emails
              console.log(`Client ${signer_name} signed document on project ${project?.name}. Admin emails: ${adminProfiles.map((a: any) => a.email).join(", ")}`);
            }
          }
        } catch (emailErr) {
          console.error("Admin notification from public sign failed:", emailErr);
        }
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
