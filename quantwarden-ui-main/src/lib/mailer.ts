/**
 * mailer.ts
 *
 * Single email transport for QuantWarden.
 *
 * Email is optional and off by default. It is available only when
 * EMAIL_AUTH_ENABLED=true and an SMTP relay is configured.
 *
 * There are no third-party email SaaS dependencies here — just SMTP.
 */

import nodemailer, { type Transporter } from "nodemailer";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

let cachedTransport: Transporter | null = null;

/**
 * Email is considered configured when an SMTP host is set. Everything else has
 * a sensible default, and many internal relays need no auth at all.
 */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_HOST.trim());
}

/** Email sign-in and email invitations are opt-in, even when SMTP is present. */
export function isEmailAuthEnabled(): boolean {
  return String(process.env.EMAIL_AUTH_ENABLED || "").toLowerCase() === "true"
    && isEmailConfigured();
}

export function getDefaultFromAddress(): string {
  return process.env.SMTP_FROM?.trim() || "QuantWarden <no-reply@quantwarden.local>";
}

function getTransport(): Transporter {
  if (cachedTransport) return cachedTransport;

  const host = process.env.SMTP_HOST!.trim();
  const port = Number(process.env.SMTP_PORT || 587);
  // SMTP_SECURE=true forces implicit TLS (port 465). Otherwise we use
  // STARTTLS opportunistically, which is the common case for ports 587/25.
  const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true";

  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;

  cachedTransport = nodemailer.createTransport({
    host,
    port,
    secure,
    // Many internal relays accept mail from allowlisted hosts without auth.
    auth: user ? { user, pass } : undefined,
  });

  return cachedTransport;
}

/**
 * Send an email through the configured SMTP relay.
 * Throws if email is not configured — callers that have a no-email fallback
 * should guard with isEmailConfigured() first.
 */
export async function sendEmail({ to, subject, html, from }: SendEmailInput): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error("SMTP is not configured (SMTP_HOST is unset). Email cannot be sent.");
  }

  await getTransport().sendMail({
    from: from?.trim() || getDefaultFromAddress(),
    to,
    subject,
    html,
  });
}
