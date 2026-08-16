import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isGuestEmail, validatePassword } from "@/lib/guest-auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log";

async function getVerifiedEmailSession() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (!session.user.emailVerified || isGuestEmail(session.user.email)) {
    return {
      error: NextResponse.json(
        { error: "A verified email account is required." },
        { status: 403 }
      ),
    };
  }

  return { session, requestHeaders };
}

async function userHasPassword(userId: string) {
  const credential = await prisma.account.findFirst({
    where: {
      userId,
      providerId: "credential",
      password: { not: null },
    },
    select: { id: true },
  });

  return Boolean(credential);
}

export async function GET() {
  try {
    const authResult = await getVerifiedEmailSession();
    if (authResult.error) return authResult.error;

    return NextResponse.json({
      hasPassword: await userHasPassword(authResult.session.user.id),
    });
  } catch (error) {
    console.error("GET password status error:", error);
    return NextResponse.json({ error: "Could not load password status." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await getVerifiedEmailSession();
    if (authResult.error) return authResult.error;

    const body = await req.json().catch(() => ({}));
    const passwordCheck = validatePassword(body.newPassword);
    if (!passwordCheck.ok) {
      return NextResponse.json({ error: passwordCheck.error }, { status: 400 });
    }

    if (body.newPassword !== body.confirmPassword) {
      return NextResponse.json({ error: "The new passwords do not match." }, { status: 400 });
    }

    const hasPassword = await userHasPassword(authResult.session.user.id);

    if (hasPassword) {
      const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
      if (!currentPassword) {
        return NextResponse.json({ error: "Current password is required." }, { status: 400 });
      }

      await auth.api.changePassword({
        body: {
          currentPassword,
          newPassword: passwordCheck.value,
          revokeOtherSessions: false,
        },
        headers: authResult.requestHeaders,
      });
    } else {
      await auth.api.setPassword({
        body: { newPassword: passwordCheck.value },
        headers: authResult.requestHeaders,
      });
    }

    await writeAuditLog({
      category: "authentication",
      action: hasPassword ? "account.password_changed" : "account.password_added",
      message: hasPassword ? "Account password changed." : "Password authentication enabled for account.",
      actorUserId: authResult.session.user.id,
      actorEmail: authResult.session.user.email,
      targetType: "user",
      targetId: authResult.session.user.id,
      request: req,
    });

    return NextResponse.json({ success: true, hasPassword: true });
  } catch (error) {
    console.error("POST password error:", error);
    const message = error instanceof Error ? error.message : "";
    if (/password|session/i.test(message)) {
      return NextResponse.json(
        { error: message || "Could not update password." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Could not update password." }, { status: 500 });
  }
}
