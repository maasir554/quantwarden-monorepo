/**
 * guest-auth.ts
 *
 * Helpers for email-free username + password accounts.
 *
 * Every username account is given a deterministic synthetic email so
 * the existing email-keyed machinery (Better Auth, invitations, the in-app
 * invitation inbox, org membership) works without modification.
 */

import { prisma } from "@/lib/prisma";

export const GUEST_USERNAME_MIN = 3;
export const GUEST_USERNAME_MAX = 32;
export const GUEST_PASSWORD_MIN = 8;

/** Username auth is on by default. GUEST_AUTH_ENABLED is a legacy alias. */
export function isGuestAuthEnabled(): boolean {
  const configured = process.env.USERNAME_AUTH_ENABLED ?? process.env.GUEST_AUTH_ENABLED;
  return String(configured || "").toLowerCase() !== "false";
}

export function guestEmailDomain(): string {
  return (process.env.USERNAME_EMAIL_DOMAIN || process.env.GUEST_EMAIL_DOMAIN || "guest.local")
    .trim()
    .toLowerCase();
}

/** Normalize a username to its canonical, storable form. */
export function normalizeUsername(raw: string): string {
  return String(raw || "").trim().toLowerCase();
}

/** A value is treated as a guest username (not an email) when it has no "@". */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

/** The synthetic email backing a guest username. */
export function guestEmail(username: string): string {
  return `${normalizeUsername(username)}@${guestEmailDomain()}`;
}

/** True if an email belongs to the guest synthetic-email namespace. */
export function isGuestEmail(email: string): boolean {
  return String(email || "").trim().toLowerCase().endsWith(`@${guestEmailDomain()}`);
}

export interface ValidationResult {
  ok: boolean;
  value: string;
  error: string;
}

export function validateUsername(raw: string): ValidationResult {
  const value = normalizeUsername(raw);
  if (value.length < GUEST_USERNAME_MIN || value.length > GUEST_USERNAME_MAX) {
    return { ok: false, value: "", error: `Username must be ${GUEST_USERNAME_MIN}-${GUEST_USERNAME_MAX} characters.` };
  }
  if (!/^[a-z0-9_.-]+$/.test(value)) {
    return { ok: false, value: "", error: "Username may only contain letters, numbers, and . _ - characters." };
  }
  return { ok: true, value, error: "" };
}

export function validatePassword(raw: string): ValidationResult {
  const value = String(raw || "");
  if (value.length < GUEST_PASSWORD_MIN) {
    return { ok: false, value: "", error: `Password must be at least ${GUEST_PASSWORD_MIN} characters.` };
  }
  return { ok: true, value, error: "" };
}

let guestSchemaReady: Promise<void> | null = null;

/**
 * Idempotently ensure the guest-auth columns exist on the user table.
 *
 * The Better Auth `username` plugin reads/writes user.username and
 * user.displayUsername. This deployment provisions schema via runtime
 * `IF NOT EXISTS` helpers (see scan-schedule-server.ts) rather than
 * `prisma migrate deploy`, so we follow the same pattern here. Runs once per
 * process; safe to call on every auth request.
 */
export function ensureGuestAuthSchema(): Promise<void> {
  if (!guestSchemaReady) {
    guestSchemaReady = (async () => {
      await prisma.$executeRawUnsafe(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "username" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "displayUsername" TEXT`);
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "user_username_key" ON "user" ("username")`
      );
    })().catch((err) => {
      // Reset so a transient failure can be retried on the next call.
      guestSchemaReady = null;
      throw err;
    });
  }
  return guestSchemaReady;
}
