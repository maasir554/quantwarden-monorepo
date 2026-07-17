import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgMemberAccess } from "@/lib/org-scan-permissions";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { validatePassword } from "@/lib/guest-auth";

/**
 * Org-admin password reset for username + password members.
 *
 * There is no recovery email, so recovery is handled by an org admin with
 * team-management permission. They set a new password and share it out-of-band.
 * Reuses the same RBAC gate as team invites (canManageTeam).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const organizationId = typeof body.organizationId === "string" ? body.organizationId : "";
    const userId = typeof body.userId === "string" ? body.userId : "";

    if (!organizationId || !userId) {
      return NextResponse.json({ error: "organizationId and userId are required." }, { status: 400 });
    }

    const passwordCheck = validatePassword(body.newPassword);
    if (!passwordCheck.ok) {
      return NextResponse.json({ error: passwordCheck.error }, { status: 400 });
    }

    // Caller must have team-management permission in this org.
    const access = await getOrgMemberAccess(organizationId, session.user.id);
    if (!access?.canManageTeam) {
      return NextResponse.json(
        { error: "Forbidden: You do not have team management permission." },
        { status: 403 }
      );
    }

    // Target must be a member of this org.
    const memberRows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "member" WHERE "organizationId" = $1 AND "userId" = $2 LIMIT 1`,
      organizationId,
      userId
    );
    if (memberRows.length === 0) {
      return NextResponse.json({ error: "That user is not a member of this organization." }, { status: 404 });
    }

    // Only guest (credential) accounts have a resettable password. Email users
    // sign in with magic links and have no password to reset.
    const targetRows = await prisma.$queryRawUnsafe<{ username: string | null }[]>(
      `SELECT username FROM "user" WHERE id = $1 LIMIT 1`,
      userId
    );
    const credentialRows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "account" WHERE "userId" = $1 AND "providerId" = 'credential' LIMIT 1`,
      userId
    );
    if (!targetRows[0]?.username || credentialRows.length === 0) {
      return NextResponse.json(
        { error: "This member does not use a username/password account, so there is nothing to reset." },
        { status: 400 }
      );
    }

    const ctx = await auth.$context;
    const hashed = await ctx.password.hash(passwordCheck.value);
    await ctx.internalAdapter.updatePassword(userId, hashed);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
