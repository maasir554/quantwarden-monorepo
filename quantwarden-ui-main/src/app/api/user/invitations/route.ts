import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

type RawInviteRow = {
  id: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  organizationId: string;
  organizationName: string | null;
  organizationSlug: string | null;
  inviterName: string | null;
  inviterEmail: string | null;
  roleName: string | null;
};

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email;
    if (!email) {
      return NextResponse.json({ error: "No email mapped to your session." }, { status: 400 });
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "invitation"
       SET status = 'expired'
       WHERE lower(email) = lower($1)
         AND status = 'pending'
         AND "expiresAt" < NOW()`,
      email
    );

    const rows = await prisma.$queryRawUnsafe<RawInviteRow[]>(
      `SELECT
          i.id,
          i.email,
          i.role,
          i.status,
          i."expiresAt" as "expiresAt",
          i."createdAt" as "createdAt",
          i."organizationId" as "organizationId",
          o.name as "organizationName",
          o.slug as "organizationSlug",
          u.name as "inviterName",
          u.email as "inviterEmail",
          r.name as "roleName"
        FROM "invitation" i
        LEFT JOIN "organization" o ON o.id = i."organizationId"
        LEFT JOIN "user" u ON u.id = i."inviterId"
        LEFT JOIN "role" r ON r.id = i.role
        WHERE lower(i.email) = lower($1)
        ORDER BY i."createdAt" DESC`,
      email
    );

    const normalized = rows.map((row) => ({
      id: row.id,
      email: row.email,
      status: row.status,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      roleName: row.roleName || row.role || "Member",
      organization: {
        id: row.organizationId,
        name: row.organizationName || "Unknown Organization",
        slug: row.organizationSlug || "",
      },
      inviter: {
        name: row.inviterName || "A team member",
        email: row.inviterEmail || "",
      },
    }));

    const active = normalized.filter((invite) => invite.status === "pending");
    const history = normalized.filter((invite) => invite.status !== "pending");

    return NextResponse.json({ active, history });
  } catch (error) {
    console.error("GET user invitations error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
