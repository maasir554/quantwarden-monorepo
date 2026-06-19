import { NextResponse } from "next/server";
import { isEmailConfigured } from "@/lib/mailer";
import { guestEmailDomain, isGuestAuthEnabled } from "@/lib/guest-auth";

/**
 * Public endpoint telling the login/signup UI which auth methods this
 * deployment offers. Single server-side source of truth so the client never
 * has to guess whether SMTP is configured. guestDomain lets the UI recognize a
 * guest invitation (its synthetic email ends with @<guestDomain>).
 */
export async function GET() {
  return NextResponse.json({
    email: isEmailConfigured(),
    guest: isGuestAuthEnabled(),
    guestDomain: guestEmailDomain(),
  });
}
