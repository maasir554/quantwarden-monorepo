import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isEmailAuthEnabled } from "@/lib/mailer";

export async function POST(req: NextRequest) {
  try {
    if (!isEmailAuthEnabled()) {
      return NextResponse.json({ error: "Email sign-up is disabled. Ask for a username invitation." }, { status: 403 });
    }

    const body = await req.json();
    const inviteId = typeof body.inviteId === "string" ? body.inviteId : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!inviteId || !name) {
      return NextResponse.json(
        { error: "Invite ID and full name are required." },
        { status: 400 }
      );
    }

    const inviteRows = await prisma.$queryRawUnsafe<{
      id: string;
      email: string;
      status: string;
      expiresAt: Date;
    }[]>(
      `SELECT id, email, status, "expiresAt" FROM "invitation" WHERE id = $1 LIMIT 1`,
      inviteId
    );

    const invite = inviteRows[0];

    if (!invite) {
      return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }

    if (invite.status !== "pending") {
      return NextResponse.json({ error: `Invitation already ${invite.status}.` }, { status: 400 });
    }

    if (new Date(invite.expiresAt) <= new Date()) {
      await prisma.$executeRawUnsafe(
        `UPDATE "invitation" SET status = 'expired' WHERE id = $1`,
        inviteId
      );

      return NextResponse.json({ error: "Invitation has expired." }, { status: 400 });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        email: {
          equals: invite.email,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "This email already has an account. Please sign in to continue." },
        { status: 409 }
      );
    }

    // An invitation URL alone does not prove control of its email address.
    // Send the same OTP / Magic Link used by ordinary email registration; the
    // user is created only after Better Auth verifies that token.
    const invitationCallback = `/app/invites/${inviteId}`;
    await auth.api.signInMagicLink({
      body: {
        email: invite.email.toLowerCase(),
        name,
        callbackURL: invitationCallback,
        newUserCallbackURL: `/auth/set-password?callbackUrl=${encodeURIComponent(invitationCallback)}`,
      },
      headers: await headers(),
    });

    return NextResponse.json({ status: true });
  } catch (error) {
    console.error("Complete invite signup error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
