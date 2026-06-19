import { auth } from "@/lib/auth";
import { ensureGuestAuthSchema } from "@/lib/guest-auth";

// Ensure the guest-auth columns (user.username / user.displayUsername) exist
// before Better Auth's username plugin touches them. Idempotent + cached, so
// this only does real work once per process.
async function handler(req: Request) {
  await ensureGuestAuthSchema();
  return auth.handler(req);
}

export const GET = handler;
export const POST = handler;
