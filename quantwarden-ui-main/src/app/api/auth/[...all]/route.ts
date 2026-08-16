import { auth } from "@/lib/auth";
import { ensureGuestAuthSchema, isGuestAuthEnabled } from "@/lib/guest-auth";
import { isEmailAuthEnabled } from "@/lib/mailer";
import { writeAuditLog } from "@/lib/audit-log";

// Ensure the username columns (user.username / user.displayUsername) exist
// before Better Auth's username plugin touches them. Idempotent + cached, so
// this only does real work once per process.
async function handler(req: Request) {
  const path = new URL(req.url).pathname;
  const isSignIn = path.includes("/api/auth/sign-in/");
  let attemptedIdentity: string | null = null;
  if (isSignIn && req.method === "POST") {
    const body = await req.clone().json().catch(() => ({}));
    attemptedIdentity = typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : typeof body.username === "string"
        ? body.username.trim().toLowerCase()
        : null;
  }

  // Email accounts must always be created through OTP / Magic Link. Once
  // verified, they may attach a password and use the normal email sign-in.
  if (path.endsWith("/api/auth/sign-up/email")) {
    return Response.json({ error: "Email accounts require verification before creation." }, { status: 403 });
  }

  if (!isEmailAuthEnabled()) {
    const blockedEmailPaths = [
      "/api/auth/sign-in/magic-link",
      "/api/auth/magic-link/verify",
      "/api/auth/sign-in/email",
    ];

    if (blockedEmailPaths.some((blockedPath) => path.endsWith(blockedPath))) {
      return Response.json({ error: "Email authentication is disabled." }, { status: 403 });
    }
  }

  if (!isGuestAuthEnabled() && path.endsWith("/api/auth/sign-in/username")) {
    return Response.json({ error: "Username authentication is disabled." }, { status: 403 });
  }

  await ensureGuestAuthSchema();
  const response = await auth.handler(req);
  if (isSignIn && response.status >= 400) {
    await writeAuditLog({
      category: "authentication",
      action: "session.sign_in_failed",
      status: "failure",
      message: `Failed sign-in attempt${attemptedIdentity ? ` for ${attemptedIdentity}` : ""}.`,
      actorEmail: attemptedIdentity,
      request: req,
      metadata: { responseStatus: response.status },
    });
  }
  return response;
}

export const GET = handler;
export const POST = handler;
