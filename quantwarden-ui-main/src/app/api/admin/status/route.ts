import { NextResponse } from "next/server";
import { ensureSuperAdminMemberships, getSuperAdminAuth } from "@/lib/super-admin";

export async function GET() {
  try {
    const admin = await getSuperAdminAuth();
    if (!admin.ok) {
      return NextResponse.json({ superAdmin: false }, { status: admin.status });
    }

    await ensureSuperAdminMemberships(admin.session.user.id);
    return NextResponse.json({ superAdmin: true });
  } catch (error) {
    console.error("Super-admin status error:", error);
    return NextResponse.json({ superAdmin: false }, { status: 500 });
  }
}
