import { STORE_DETAILS } from "@/lib/storeDetails";
import { buildInvoice, formatMoney, invoiceNumber } from "@/lib/invoice";
import type { Order } from "@/lib/types";
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
      // Nodemailer has NO default timeouts, so an unreachable host or an
      // address whose domain does not resolve leaves the send hanging
      // indefinitely. On the automatic path that meant a serverless function
      // held open for nothing; on the admin's "Email receipt" button it meant
      // a spinner that never resolved and no way to tell whether the customer
      // got their receipt. Every failure now becomes a reported error within
      // ~20s at worst.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
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

export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<{ ok: true } | { error: string }> {
  try {
    await getTransporter().sendMail({
      from: getFromAddress(),
      to: params.to,
      subject: "Reset your Atoreum MV password",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
          <p>Hi ${escapeHtml(params.name)},</p>
          <p>We received a request to reset the password on your Atoreum MV account. Choose a new password here:</p>
          <p style="margin: 24px 0;">
            <a href="${params.resetUrl}" style="background:#8a6d3b;color:#fff;padding:12px 24px;text-decoration:none;border-radius:2px;display:inline-block;">
              Reset password
            </a>
          </p>
          <p style="font-size: 13px; color: #666;">Or paste this link into your browser:<br />${params.resetUrl}</p>
          <p style="font-size: 13px; color: #666;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email. Your password won't change.</p>
        </div>
      `,
    });
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send password reset email." };
  }
}

/**
 * The customer's receipt, sent when an order is confirmed.
 *
 * Built from buildInvoice(), the same function the dashboard's tax invoice
 * page renders from, so the customer's copy and the copy filed for GST are
 * arithmetically the same document -- two independent calculations of the
 * same money is exactly how a receipt ends up disagreeing with a return.
 *
 * Table-based layout with inline styles because that is what mail clients
 * render reliably; Outlook in particular ignores most of a stylesheet.
 */
/**
 * The receipt's HTML, separated from the sending of it so the figures can be
 * asserted on directly. An email whose GST disagrees with the filed invoice is
 * exactly the kind of defect that is invisible until a customer or an auditor
 * finds it, and it cannot be checked at all if the only way to produce the
 * markup is to send a message.
 */
export function renderOrderReceiptHtml(params: { name: string; order: Order; orderUrl?: string }): string {
  const invoice = buildInvoice(params.order);
  const money = (v: number) => escapeHtml(formatMoney(v, invoice.currency));

  const rows = invoice.lines
    .map(
      (l) => `
        <tr>
          <td style="padding:8px 24px 8px 0;border-bottom:1px solid #eee;">${escapeHtml(l.name)}
            <span style="color:#888;">× ${l.quantity}</span>
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;width:1%;">
            ${money(l.lineGross)}
          </td>
        </tr>`
    )
    .join("");

  const savingsRow =
    invoice.productSavings > 0
      ? `<tr><td style="padding:12px 24px 4px 0;color:#666;">Before discount</td>
         <td style="padding:12px 0 4px;text-align:right;color:#666;">${money(invoice.grossBeforeProductDiscounts)}</td></tr>
         <tr><td style="padding:4px 24px 4px 0;color:#666;">Product discount</td>
         <td style="padding:4px 0;text-align:right;color:#666;">-${money(invoice.productSavings)}</td></tr>`
      : "";

  const discountRow =
    invoice.discount > 0
      ? `<tr><td style="padding:4px 24px 4px 0;color:#666;">Sangu redeemed</td>
         <td style="padding:4px 0;text-align:right;color:#666;">-${money(invoice.discount)}</td></tr>`
      : "";

  const voucherRow =
    invoice.voucherApplied > 0
      ? `<tr><td style="padding:4px 24px 4px 0;color:#666;">Gift voucher</td>
         <td style="padding:4px 0;text-align:right;color:#666;">-${money(invoice.voucherApplied)}</td></tr>`
      : "";

  return `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
          <p>Hi ${escapeHtml(params.name)},</p>
          <p>Your order <strong>${escapeHtml(params.order.orderNumber)}</strong> is confirmed. Here's your receipt.</p>

          <table style="width:100%;border-collapse:collapse;margin:24px 0;font-size:14px;">
            <thead>
              <tr>
                <th style="text-align:left;padding:0 24px 8px 0;border-bottom:2px solid #1a1a1a;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#666;">Item</th>
                <th style="text-align:right;padding-bottom:8px;border-bottom:2px solid #1a1a1a;white-space:nowrap;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#666;">Amount</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              ${savingsRow}
              <tr><td style="padding:12px 24px 4px 0;color:#666;">Subtotal (incl. GST)</td>
                  <td style="padding:12px 0 4px;text-align:right;color:#666;">${money(invoice.grossSubtotal)}</td></tr>
              ${discountRow}
          ${voucherRow}
              <tr><td style="padding:4px 24px 4px 0;color:#666;">Taxable value</td>
                  <td style="padding:4px 0;text-align:right;color:#666;">${money(invoice.netTotal)}</td></tr>
              <tr><td style="padding:4px 24px 4px 0;color:#666;">GST @ ${invoice.gstRatePercent}%</td>
                  <td style="padding:4px 0;text-align:right;color:#666;">${money(invoice.gstTotal)}</td></tr>
              <tr><td style="padding:10px 24px 0 0;border-top:1px solid #1a1a1a;font-weight:bold;">Total paid</td>
                  <td style="padding:10px 0 0;border-top:1px solid #1a1a1a;text-align:right;font-weight:bold;">${money(invoice.grossTotal)}</td></tr>
            </tfoot>
          </table>

          <p style="font-size:13px;color:#666;">
            Delivering to:<br />${escapeHtml(params.order.customer.address)}
          </p>
          ${
            params.orderUrl
              ? `<p style="margin:20px 0;"><a href="${params.orderUrl}" style="background:#8a6d3b;color:#fff;padding:12px 24px;text-decoration:none;border-radius:2px;display:inline-block;">View your order</a></p>`
              : ""
          }
          <p style="font-size:12px;color:#888;">
            Prices are GST-inclusive; the GST shown is the tax contained within the total.
            Invoice reference ${escapeHtml(invoiceNumber(params.order))}.
          </p>
          <!-- The supplier's registered name and TIN are mandatory particulars
               on a Maldivian tax invoice. This email is the copy the customer
               keeps, so it carries them too -- otherwise the only compliant
               document is the one that never leaves the dashboard. -->
          <p style="font-size:12px;color:#888;border-top:1px solid #eee;padding-top:12px;margin-top:16px;">
            ${escapeHtml(STORE_DETAILS.taxpayerName)} (trading as ${escapeHtml(STORE_DETAILS.tradingName)})<br />
            ${STORE_DETAILS.addressLines.map((l) => escapeHtml(l)).join("<br />")}<br />
            ${STORE_DETAILS.tin ? `TIN ${escapeHtml(STORE_DETAILS.tin)}<br />` : ""}
            ${escapeHtml(STORE_DETAILS.email)}
          </p>
        </div>
      `;
}

export async function sendOrderReceiptEmail(params: {
  to: string;
  name: string;
  order: Order;
  orderUrl?: string;
}): Promise<{ ok: true } | { error: string }> {
  try {
    await getTransporter().sendMail({
      from: getFromAddress(),
      to: params.to,
      subject: `Your Atoreum MV receipt · ${params.order.orderNumber}`,
      html: renderOrderReceiptHtml(params),
    });
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send receipt email." };
  }
}
