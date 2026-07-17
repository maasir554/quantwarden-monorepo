import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  ensureGuestAuthSchema,
  guestEmail,
  isGuestAuthEnabled,
  validatePassword,
  validateUsername,
} from "@/lib/guest-auth";

/**
 * Username (email-free) signup.
 *
 * Creates a username + password account. The user never sees or chooses an
 * email — we synthesize a deterministic one (`username@<GUEST_EMAIL_DOMAIN>`)
 * so the rest of the system (invites, membership, inbox) works unchanged.
 */
export async function POST(req: NextRequest) {
  try {
    if (!isGuestAuthEnabled()) {
      return NextResponse.json({ error: "Username accounts are disabled on this deployment." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const inviteId = typeof body.inviteId === "string" ? body.inviteId : "";

    if (!name) {
      return NextResponse.json({ error: "Full name is required." }, { status: 400 });
    }

    const usernameCheck = validateUsername(body.username);
    if (!usernameCheck.ok) {
      return NextResponse.json({ error: usernameCheck.error }, { status: 400 });
    }
    const passwordCheck = validatePassword(body.password);
    if (!passwordCheck.ok) {
      return NextResponse.json({ error: passwordCheck.error }, { status: 400 });
    }

    await ensureGuestAuthSchema();

    const username = usernameCheck.value;
    const email = guestEmail(username);

    // Sign up server-side so we control the synthetic email. asResponse lets us
    // forward Better Auth's session cookies to the browser.
    let authResponse: Response;
    try {
      authResponse = await auth.api.signUpEmail({
        body: {
          email,
          password: passwordCheck.value,
          name,
          username,
          displayUsername: name,
        },
        asResponse: true,
      });
    } catch (err: any) {
      const message: string = err?.body?.message || err?.message || "Could not create account.";
      const taken = /exist|taken|unique/i.test(message);
      return NextResponse.json(
        { error: taken ? "That username is already taken." : message },
        { status: taken ? 409 : 400 }
      );
    }

    if (!authResponse.ok) {
      let message = "Could not create account.";
      try {
        const data = await authResponse.clone().json();
        message = data?.message || message;
      } catch {
        /* ignore */
      }
      const taken = /exist|taken|unique/i.test(message);
      return NextResponse.json({ error: taken ? "That username is already taken." : message }, {
        status: taken ? 409 : 400,
      });
    }

    const redirectTo = inviteId ? `/app/invites/${inviteId}` : "/app";
    const nextResponse = NextResponse.json({ redirectTo });

    const setCookies = authResponse.headers.getSetCookie?.() || [];
    for (const cookie of setCookies) {
      nextResponse.headers.append("set-cookie", cookie);
    }

    return nextResponse;
  } catch (error) {
    console.error("Username signup error:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
