import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: inviteId } = await params;

    const inviteRows = await prisma.$queryRawUnsafe<{
      id: string;
      email: string;
      status: string;
      expiresAt: Date;
      role: string | null;
      organizationId: string;
      organizationName: string | null;
    }[]>(
      `SELECT
          i.id,
          i.email,
          i.status,
          i."expiresAt" as "expiresAt",
          i.role,
          i."organizationId" as "organizationId",
          o.name as "organizationName"
        FROM "invitation" i
        LEFT JOIN "organization" o ON o.id = i."organizationId"
        WHERE i.id = $1
        LIMIT 1`,
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

    const roleRows = invite.role
      ? await prisma.$queryRawUnsafe<{ name: string }[]>(
          `SELECT name FROM "role" WHERE id = $1 LIMIT 1`,
          invite.role
        )
      : [];

    const existingUser = await prisma.user.findFirst({
      where: {
        email: {
          equals: invite.email,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    return NextResponse.json({
      inviteId,
      email: invite.email,
      organizationName: invite.organizationName || "QuantWarden",
      roleName: roleRows[0]?.name || invite.role || "Member",
      hasAccount: Boolean(existingUser),
      callbackUrl: `/app/invites/${inviteId}`,
    });
  } catch (error) {
    console.error("Invite signup lookup error:", error);
    return NextResponse.json(
      { error: "Something went wrong loading the invitation." },
      { status: 500 }
    );
  }
}
