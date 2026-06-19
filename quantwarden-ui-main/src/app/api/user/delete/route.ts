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

    const body = await req.json();
    const providedEmail = typeof body?.email === "string" ? body.email.trim() : "";
    const sessionEmail = (session.user.email || "").trim();

    if (!providedEmail) {
      return NextResponse.json({ error: "Confirmation email is required." }, { status: 400 });
    }

    if (providedEmail.toLowerCase() !== sessionEmail.toLowerCase()) {
      return NextResponse.json({ error: "Email confirmation does not match your account email." }, { status: 400 });
    }

    await prisma.user.delete({
      where: { id: session.user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE user profile error:", error);
    return NextResponse.json({ error: "Failed to delete profile." }, { status: 500 });
  }
}
