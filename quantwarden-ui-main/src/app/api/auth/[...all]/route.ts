import { auth } from "@/lib/auth";
import { ensureGuestAuthSchema, isGuestAuthEnabled } from "@/lib/guest-auth";
import { isEmailAuthEnabled } from "@/lib/mailer";

// Ensure the username columns (user.username / user.displayUsername) exist
// before Better Auth's username plugin touches them. Idempotent + cached, so
// this only does real work once per process.
async function handler(req: Request) {
  const path = new URL(req.url).pathname;

  // Public email/password endpoints are never part of QuantWarden's auth
  // contract. Username signup goes through the guarded guest endpoint, while
  // real email accounts must prove ownership through OTP / Magic Link first.
  const blockedPasswordPaths = [
    "/api/auth/sign-up/email",
    "/api/auth/sign-in/email",
  ];
  if (blockedPasswordPaths.some((blockedPath) => path.endsWith(blockedPath))) {
    return Response.json({ error: "Password-based email authentication is disabled." }, { status: 403 });
  }

  if (!isEmailAuthEnabled()) {
    const blockedEmailPaths = [
      "/api/auth/sign-in/magic-link",
      "/api/auth/magic-link/verify",
    ];

    if (blockedEmailPaths.some((blockedPath) => path.endsWith(blockedPath))) {
      return Response.json({ error: "Email authentication is disabled." }, { status: 403 });
    }
  }

  if (!isGuestAuthEnabled() && path.endsWith("/api/auth/sign-in/username")) {
    return Response.json({ error: "Username authentication is disabled." }, { status: 403 });
  }

  await ensureGuestAuthSchema();
  return auth.handler(req);
}

export const GET = handler;
export const POST = handler;
