import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isEmailAuthEnabled } from "@/lib/mailer";

export async function POST(req: NextRequest) {
  try {
    if (!isEmailAuthEnabled()) {
      return NextResponse.json({ error: "Email sign-in is disabled." }, { status: 403 });
    }

    const { email, code } = await req.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and code are required." },
        { status: 400 }
      );
    }

    // Look up the OTP
    const loginCode = await prisma.loginCode.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        code,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!loginCode) {
      return NextResponse.json(
        { error: "Invalid or expired code. Please request a new one." },
        { status: 401 }
      );
    }

    // Mark the code as used
    await prisma.loginCode.update({
      where: { id: loginCode.id },
      data: { used: true },
    });

    // Return the magic link verify URL so the client can navigate to it
    // This completes the auth flow through Better Auth's magic link verification
    return NextResponse.json({ verifyUrl: loginCode.url });
  } catch (error) {
    console.error("OTP verification error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
