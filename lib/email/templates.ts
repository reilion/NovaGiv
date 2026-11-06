import "server-only";

/**
 * The auth emails, as HTML + plain text. Hand-written tables and inline styles
 * because that is what mail clients render; the colors are the site's own
 * tokens (app/globals.css), so the email looks like the place it links to.
 */

const C = {
  page: "#0e0e10",
  card: "#1c1b1d",
  raised: "#2a2a2c",
  text: "#e5e1e4",
  muted: "#cbc3d7",
  faint: "#958ea0",
  primary: "#d0bcff",
  onPrimary: "#3c0091",
  neon: "#fbabff",
  border: "#2f2e31",
};

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface LayoutOptions {
  preheader: string;
  eyebrow: string;
  title: string;
  /** Already-escaped HTML paragraphs. */
  body: string;
  action?: { label: string; url: string };
  /** Shown under the button; already-escaped HTML. */
  afterAction?: string;
  footnote: string;
  siteUrl: string;
}

function layout(o: LayoutOptions): string {
  const button = o.action
    ? `
          <tr><td style="padding:8px 32px 8px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="border-radius:12px;background:${C.primary};">
                <a href="${escapeHtml(o.action.url)}" target="_blank"
                   style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;font-weight:700;color:${C.onPrimary};text-decoration:none;border-radius:12px;">
                  ${escapeHtml(o.action.label)}
                </a>
              </td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:16px 32px 0;font-family:${FONT};font-size:12px;line-height:18px;color:${C.faint};">
            ¿El botón no funciona? Copia este enlace en tu navegador:<br>
            <a href="${escapeHtml(o.action.url)}" style="color:${C.primary};word-break:break-all;">${escapeHtml(o.action.url)}</a>
          </td></tr>`
    : "";

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(o.title)}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
      <tr><td align="center" style="padding:0 0 24px;font-family:${FONT};font-size:24px;font-weight:700;color:${C.text};letter-spacing:-0.5px;">
        <a href="${escapeHtml(o.siteUrl)}" style="color:${C.text};text-decoration:none;">
          <span style="color:${C.primary};">&#9654;</span>&nbsp;Nova<span style="color:${C.primary};">Giv</span>
        </a>
      </td></tr>
      <tr><td style="background:${C.card};border:1px solid ${C.border};border-radius:16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding:32px 32px 0;">
            <span style="display:inline-block;padding:3px 8px;border-radius:4px;background:#3a1640;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${C.neon};">
              ${escapeHtml(o.eyebrow)}
            </span>
          </td></tr>
          <tr><td style="padding:16px 32px 8px;font-family:${FONT};font-size:24px;line-height:32px;font-weight:700;color:${C.text};">
            ${escapeHtml(o.title)}
          </td></tr>
          <tr><td style="padding:0 32px 16px;font-family:${FONT};font-size:15px;line-height:24px;color:${C.muted};">
            ${o.body}
          </td></tr>
          ${button}
          ${o.afterAction ? `<tr><td style="padding:24px 32px 0;font-family:${FONT};font-size:14px;line-height:22px;color:${C.muted};">${o.afterAction}</td></tr>` : ""}
          <tr><td style="padding:24px 32px 32px;">
            <div style="border-top:1px solid ${C.border};padding-top:16px;font-family:${FONT};font-size:12px;line-height:18px;color:${C.faint};">
              ${escapeHtml(o.footnote)}
            </div>
          </td></tr>
        </table>
      </td></tr>
      <tr><td align="center" style="padding:24px 0 0;font-family:${FONT};font-size:12px;line-height:18px;color:${C.faint};">
        NovaGiv · La sala de resubidos<br>
        <a href="${escapeHtml(o.siteUrl)}" style="color:${C.faint};">${escapeHtml(o.siteUrl.replace(/^https?:\/\//, ""))}</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 12px;">${text}</p>`;
}

function handle(username: string | null): string {
  return username ? `@${username}` : "";
}

const PERKS = [
  ["Historial entre dispositivos", "retoma «Seguir viendo» en el móvil o en el PC."],
  ["Listas de «Ver después»", "guarda directos largos para cuando tengas tiempo."],
  ["Me gusta", "apoya los mejores momentos de la comunidad."],
];

/** "Confirm signup" — doubles as the welcome email. */
export function confirmSignupEmail(opts: {
  username: string | null;
  url: string;
  siteUrl: string;
}): RenderedEmail {
  const who = handle(opts.username);
  const greeting = who ? `¡Te damos la bienvenida, ${who}!` : "¡Te damos la bienvenida a NovaGiv!";
  const perksHtml = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${PERKS.map(
    ([title, text]) =>
      `<tr><td valign="top" style="padding:0 10px 10px 0;color:${C.primary};font-size:15px;">&#10022;</td>` +
      `<td style="padding:0 0 10px;font-family:${FONT};font-size:14px;line-height:21px;color:${C.muted};"><strong style="color:${C.text};">${escapeHtml(title)}</strong>: ${escapeHtml(text)}</td></tr>`
  ).join("")}</table>`;

  return {
    subject: "Te damos la bienvenida a NovaGiv — confirma tu cuenta",
    html: layout({
      preheader: "Un clic más y tu cuenta de NovaGiv queda lista.",
      eyebrow: "Nueva cuenta",
      title: greeting,
      body:
        p("Gracias por unirte a la sala de resubidos. Solo falta confirmar que este correo es tuyo para activar tu cuenta.") +
        (who ? p(`Recuerda: para entrar usarás tu usuario <strong style="color:${C.text};">${escapeHtml(who)}</strong>, no el correo.`) : ""),
      action: { label: "Confirmar mi cuenta", url: opts.url },
      afterAction: `<p style="margin:0 0 12px;font-weight:600;color:${C.text};">Lo que te espera:</p>${perksHtml}`,
      footnote:
        "El enlace caduca en 1 hora. Si no creaste una cuenta en NovaGiv, ignora este correo: nadie podrá usarla sin confirmarla.",
      siteUrl: opts.siteUrl,
    }),
    text: [
      greeting,
      "",
      "Gracias por unirte a NovaGiv. Confirma tu cuenta abriendo este enlace:",
      opts.url,
      "",
      who ? `Para entrar usarás tu usuario ${who}, no el correo.` : "",
      "",
      "El enlace caduca en 1 hora. Si no creaste esta cuenta, ignora este correo.",
    ].join("\n"),
  };
}

/** "Reset password". */
export function recoveryEmail(opts: {
  username: string | null;
  url: string;
  siteUrl: string;
}): RenderedEmail {
  const who = handle(opts.username);
  return {
    subject: "Restablece tu contraseña de NovaGiv",
    html: layout({
      preheader: "Elige una contraseña nueva para tu cuenta de NovaGiv.",
      eyebrow: "Recuperar acceso",
      title: "Restablece tu contraseña",
      body:
        p(`Hola${who ? ` ${escapeHtml(who)}` : ""}, recibimos una solicitud para cambiar la contraseña de tu cuenta.`) +
        p("Pulsa el botón para elegir una nueva. Te dejará dentro de tu cuenta con la sesión iniciada."),
      action: { label: "Elegir nueva contraseña", url: opts.url },
      afterAction: who
        ? `Por si también lo olvidaste: tu usuario para entrar es <strong style="color:${C.text};">${escapeHtml(who)}</strong>.`
        : undefined,
      footnote:
        "El enlace caduca en 1 hora y solo sirve una vez. Si no pediste este cambio, ignora este correo: tu contraseña sigue siendo la misma.",
      siteUrl: opts.siteUrl,
    }),
    text: [
      "Restablece tu contraseña de NovaGiv",
      "",
      `Hola${who ? ` ${who}` : ""}, abre este enlace para elegir una contraseña nueva:`,
      opts.url,
      "",
      who ? `Tu usuario para entrar es ${who}.` : "",
      "",
      "El enlace caduca en 1 hora. Si no pediste este cambio, ignora este correo.",
    ].join("\n"),
  };
}

/** "Change email address" — one goes to the new address, and with secure email change one to the old. */
export function emailChangeEmail(opts: {
  username: string | null;
  url: string;
  siteUrl: string;
  newEmail: string;
  toCurrentAddress: boolean;
}): RenderedEmail {
  const who = handle(opts.username);
  const intro = opts.toCurrentAddress
    ? `Alguien pidió cambiar el correo de tu cuenta${who ? ` ${escapeHtml(who)}` : ""} a <strong style="color:${C.text};">${escapeHtml(opts.newEmail)}</strong>. Confírmalo desde aquí para aprobar el cambio.`
    : `Confirma que <strong style="color:${C.text};">${escapeHtml(opts.newEmail)}</strong> será el nuevo correo de tu cuenta${who ? ` ${escapeHtml(who)}` : ""}.`;

  return {
    subject: "Confirma el cambio de correo en NovaGiv",
    html: layout({
      preheader: "Confirma el nuevo correo de tu cuenta de NovaGiv.",
      eyebrow: "Tu cuenta",
      title: "Confirma el cambio de correo",
      body: p(intro),
      action: { label: "Confirmar cambio", url: opts.url },
      footnote:
        "El enlace caduca en 1 hora. Si no pediste este cambio, ignora este correo y cambia tu contraseña.",
      siteUrl: opts.siteUrl,
    }),
    text: [
      "Confirma el cambio de correo en NovaGiv",
      "",
      `Nuevo correo: ${opts.newEmail}`,
      opts.url,
      "",
      "Si no pediste este cambio, ignora este correo y cambia tu contraseña.",
    ].join("\n"),
  };
}

/** Magic links and invites — not used by the app today, but the hook must answer them. */
export function linkEmail(opts: {
  kind: "magiclink" | "invite";
  url: string;
  siteUrl: string;
}): RenderedEmail {
  const invite = opts.kind === "invite";
  const title = invite ? "Te invitaron a NovaGiv" : "Tu enlace para entrar";
  return {
    subject: invite ? "Te invitaron a NovaGiv" : "Tu enlace para entrar a NovaGiv",
    html: layout({
      preheader: title,
      eyebrow: invite ? "Invitación" : "Acceso",
      title,
      body: p(invite ? "Acepta la invitación para crear tu cuenta." : "Pulsa el botón para entrar a tu cuenta."),
      action: { label: invite ? "Aceptar invitación" : "Entrar", url: opts.url },
      footnote: "El enlace caduca en 1 hora. Si no lo esperabas, ignora este correo.",
      siteUrl: opts.siteUrl,
    }),
    text: [title, "", opts.url].join("\n"),
  };
}

/** A one-time code, for reauthentication. */
export function codeEmail(opts: { code: string; siteUrl: string }): RenderedEmail {
  return {
    subject: `${opts.code} es tu código de verificación de NovaGiv`,
    html: layout({
      preheader: `Tu código: ${opts.code}`,
      eyebrow: "Verificación",
      title: "Tu código de verificación",
      body:
        p("Usa este código para confirmar que eres tú:") +
        `<p style="margin:8px 0 12px;padding:16px;border-radius:12px;background:${C.raised};text-align:center;font-family:'JetBrains Mono',Consolas,monospace;font-size:28px;font-weight:700;letter-spacing:6px;color:${C.text};">${escapeHtml(opts.code)}</p>`,
      footnote: "El código caduca en 1 hora. Si no lo pediste, ignora este correo y cambia tu contraseña.",
      siteUrl: opts.siteUrl,
    }),
    text: `Tu código de verificación de NovaGiv: ${opts.code}`,
  };
}

const NOTICES: Record<string, { subject: string; text: string }> = {
  password_changed_notification: {
    subject: "Tu contraseña de NovaGiv cambió",
    text: "La contraseña de tu cuenta se acaba de cambiar.",
  },
  email_changed_notification: {
    subject: "El correo de tu cuenta de NovaGiv cambió",
    text: "El correo asociado a tu cuenta se acaba de cambiar.",
  },
};

/** Security notices (password/email changed…) and anything else Supabase adds later. */
export function noticeEmail(opts: { action: string; siteUrl: string }): RenderedEmail {
  const notice = NOTICES[opts.action] ?? {
    subject: "Actividad en tu cuenta de NovaGiv",
    text: "Hubo un cambio de seguridad en tu cuenta.",
  };
  return {
    subject: notice.subject,
    html: layout({
      preheader: notice.text,
      eyebrow: "Seguridad",
      title: notice.subject,
      body: p(escapeHtml(notice.text)) + p("Si fuiste tú, no tienes que hacer nada."),
      footnote: "Si no reconoces este cambio, restablece tu contraseña cuanto antes desde la página de inicio de sesión.",
      siteUrl: opts.siteUrl,
    }),
    text: `${notice.text}\nSi no reconoces este cambio, restablece tu contraseña cuanto antes.`,
  };
}
