import { auth } from "@/lib/auth";
import { ensureGuestAuthSchema } from "@/lib/guest-auth";
import { isEmailAuthEnabled } from "@/lib/mailer";

// Ensure the username columns (user.username / user.displayUsername) exist
// before Better Auth's username plugin touches them. Idempotent + cached, so
// this only does real work once per process.
async function handler(req: Request) {
  if (!isEmailAuthEnabled()) {
    const path = new URL(req.url).pathname;
    const blockedEmailPaths = [
      "/api/auth/sign-up/email",
      "/api/auth/sign-in/email",
      "/api/auth/sign-in/magic-link",
      "/api/auth/magic-link/verify",
    ];

    if (blockedEmailPaths.some((blockedPath) => path.endsWith(blockedPath))) {
      return Response.json({ error: "Email authentication is disabled." }, { status: 403 });
    }
  }

  await ensureGuestAuthSchema();
  return auth.handler(req);
}

export const GET = handler;
export const POST = handler;
