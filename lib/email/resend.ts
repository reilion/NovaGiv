import "server-only";

/**
 * Sends one email through Resend's HTTP API. A plain fetch rather than the SDK:
 * this is the only call the app makes, and it is one POST.
 *
 * RESEND_FROM has to be an address on a domain verified in Resend. Until there
 * is one, Resend only accepts its shared sandbox sender, and only delivers to
 * the address that owns the Resend account — enough to try the flow, not to
 * run it for real users.
 */
const DEFAULT_FROM = "NovaGiv <onboarding@resend.dev>";

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(email: OutgoingEmail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY no está configurada.");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || DEFAULT_FROM,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend respondió ${response.status}: ${detail}`);
  }
}
