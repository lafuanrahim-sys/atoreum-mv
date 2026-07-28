import nodemailer, { type Transporter } from "nodemailer";

/**
 * Real email delivery via SMTP (Nodemailer) — the only channel in this
 * codebase that sends an actual email (compare lib/notify.ts, which only
 * logs the new-order notification to console/a file since no mailer was
 * configured for that). Points at whatever mailbox SMTP_HOST/USER/PASS
 * describe — GoDaddy Workspace Email (smtpout.secureserver.net) by
 * default, but any SMTP relay works. Requires SMTP_USER and SMTP_PASS (see
 * .env.example); getTransporter() throws without them rather than silently
 * no-op'ing, since a verification email that never arrives just looks like
 * a broken signup to the user.
 */

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    throw new Error("SMTP_USER / SMTP_PASS are not set. Add them to .env.local (see .env.example).");
  }
  if (!transporter) {
    const host = process.env.SMTP_HOST || "smtpout.secureserver.net";
    const port = Number(process.env.SMTP_PORT) || 465;
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // 465 = implicit TLS; 587 (and others) use STARTTLS instead
      auth: { user, pass },
    });
  }
  return transporter;
}

function getFromAddress(): string {
  const user = process.env.SMTP_USER;
  return process.env.EMAIL_FROM || (user ? `Atoreum MV <${user}>` : "Atoreum MV");
}

function escapeHtml(value: string): string {
  const escapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (c) => escapes[c]);
}

export async function sendVerificationEmail(params: {
  to: string;
  name: string;
  verifyUrl: string;
}): Promise<{ ok: true } | { error: string }> {
  try {
    await getTransporter().sendMail({
      from: getFromAddress(),
      to: params.to,
      subject: "Verify your Atoreum MV account",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
          <p>Hi ${escapeHtml(params.name)},</p>
          <p>Thanks for creating an account with Atoreum MV. Confirm your email address to finish setting up your account and sign in:</p>
          <p style="margin: 24px 0;">
            <a href="${params.verifyUrl}" style="background:#8a6d3b;color:#fff;padding:12px 24px;text-decoration:none;border-radius:2px;display:inline-block;">
              Verify email
            </a>
          </p>
          <p style="font-size: 13px; color: #666;">Or paste this link into your browser:<br />${params.verifyUrl}</p>
          <p style="font-size: 13px; color: #666;">This link expires in 24 hours. If you didn't create this account, you can safely ignore this email.</p>
        </div>
      `,
    });
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send verification email." };
  }
}
