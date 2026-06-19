import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId, confirmName } = await req.json();

    if (!organizationId || !confirmName) {
      return NextResponse.json(
        { error: "Organization ID and confirmation name are required." },
        { status: 400 }
      );
    }

    // Verify the org exists and the user is the owner
    const rows = await prisma.$queryRawUnsafe<
      { id: string; name: string; role: string }[]
    >(
      `SELECT o.id, o.name, m.role
       FROM "organization" o
       INNER JOIN "member" m ON m."organizationId" = o.id AND m."userId" = $1
       WHERE o.id = $2
       LIMIT 1`,
      session.user.id,
      organizationId
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Organization not found or you are not a member." },
        { status: 404 }
      );
    }

    const org = rows[0];

    if (org.role !== "owner") {
      return NextResponse.json(
        { error: "Only the organization owner can delete it." },
        { status: 403 }
      );
    }

    // Verify the confirmation name matches
    if (confirmName.trim() !== org.name) {
      return NextResponse.json(
        { error: "Organization name does not match. Deletion cancelled." },
        { status: 400 }
      );
    }

    // Delete the organization using Prisma's built-in cascade deletion.
    // Because the schema defines `onDelete: Cascade` for Role, Member, and Invitation,
    // this single cleanly-typed Prisma command deletes all associated data automatically.
    await prisma.organization.delete({
      where: { id: organizationId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete org error:", error);
    return NextResponse.json(
      { error: "Failed to delete organization. Please try again." },
      { status: 500 }
    );
  }
}
