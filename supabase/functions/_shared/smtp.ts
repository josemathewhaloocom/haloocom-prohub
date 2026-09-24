export async function sendViaSMTP(smtp: any, to: string, subject: string, html: string) {
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
  await sendCommand("EHLO localhost");

  if (port !== 465 && smtp.use_ssl !== true) {
    const starttls = await sendCommand("STARTTLS");
    if (starttls.startsWith("220")) {
      conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: host });
      await sendCommand("EHLO localhost");
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

  const mailFrom = await sendCommand(`MAIL FROM:<${fromEmail}>`);
  if (!mailFrom.startsWith("250")) {
    conn.close();
    throw new Error("MAIL FROM rejected: " + mailFrom);
  }

  const rcpt = await sendCommand(`RCPT TO:<${to}>`);
  if (!rcpt.startsWith("250")) {
    conn.close();
    throw new Error("RCPT TO rejected: " + rcpt);
  }

  await sendCommand("DATA");
  const message = [
    `From: "${fromName}" <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "",
    html,
    ".",
  ].join("\r\n");
  await sendCommand(message);
  await sendCommand("QUIT");
  conn.close();
  return { success: true };
}

export async function getSmtp(supabaseAdmin: any) {
  const { data } = await supabaseAdmin.from("smtp_settings").select("*").limit(1).maybeSingle();
  return data;
}
