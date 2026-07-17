import { NextResponse } from "next/server";
import { isEmailAuthEnabled } from "@/lib/mailer";
import { guestEmailDomain, isGuestAuthEnabled } from "@/lib/guest-auth";

/**
 * Public endpoint telling the login/signup UI which auth methods this
 * deployment offers. Single server-side source of truth so the client never
 * has to guess how the deployment was configured. usernameDomain lets the UI
 * recognize a username invitation backed by a synthetic email.
 */
export async function GET() {
  return NextResponse.json({
    email: isEmailAuthEnabled(),
    username: isGuestAuthEnabled(),
    usernameDomain: guestEmailDomain(),
  });
}
