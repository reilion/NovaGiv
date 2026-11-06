// Points Supabase Auth's emails at the app: turns on the "Send Email" hook (so
// Supabase sends nothing itself and every auth email goes out through
// app/api/auth/email-hook + Resend), and fixes the Site URL and redirect list
// the links depend on.
//
//   node --env-file=.env.local scripts/configure-auth-email.mjs          # apply
//   node --env-file=.env.local scripts/configure-auth-email.mjs --off    # back to Supabase's own emails
//
// Needs SUPABASE_ACCESS_TOKEN (personal access token), NEXT_PUBLIC_SUPABASE_URL,
// SITE_URL and SEND_EMAIL_HOOK_SECRET. The same secret has to be set in the
// deployment (Vercel) before the hook is turned on, or every email fails.

const token = process.env.SUPABASE_ACCESS_TOKEN;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const siteUrl = process.env.SITE_URL?.replace(/\/+$/, "");
const secret = process.env.SEND_EMAIL_HOOK_SECRET;
const off = process.argv.includes("--off");

const missing = Object.entries({
  SUPABASE_ACCESS_TOKEN: token,
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  SITE_URL: siteUrl,
  ...(off ? {} : { SEND_EMAIL_HOOK_SECRET: secret }),
})
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missing.length) {
  console.error(`Faltan variables: ${missing.join(", ")}`);
  process.exit(1);
}

const ref = new URL(supabaseUrl).hostname.split(".")[0];

const config = off
  ? { hook_send_email_enabled: false }
  : {
      site_url: siteUrl,
      uri_allow_list: [`${siteUrl}/**`, "http://localhost:3000/**"].join(","),
      hook_send_email_enabled: true,
      hook_send_email_uri: `${siteUrl}/api/auth/email-hook`,
      hook_send_email_secrets: secret,
      // Only binds custom senders; ours is Resend, whose own limits apply.
      rate_limit_email_sent: 30,
    };

const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(config),
});

if (!response.ok) {
  console.error(`Supabase respondió ${response.status}: ${await response.text()}`);
  process.exit(1);
}

const result = await response.json();
console.log(
  JSON.stringify(
    {
      site_url: result.site_url,
      uri_allow_list: result.uri_allow_list,
      hook_send_email_enabled: result.hook_send_email_enabled,
      hook_send_email_uri: result.hook_send_email_uri,
    },
    null,
    2
  )
);
