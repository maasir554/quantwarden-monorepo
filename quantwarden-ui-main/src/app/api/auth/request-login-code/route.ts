import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isEmailAuthEnabled } from "@/lib/mailer";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  try {
    if (!isEmailAuthEnabled()) {
      return NextResponse.json({ error: "Email sign-in is disabled." }, { status: 403 });
    }

    const body = await req.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const callbackURL = typeof body.callbackURL === "string" && body.callbackURL.length > 0
      ? body.callbackURL
      : "/app";

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: "insensitive",
        },
      },
      select: { email: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found. Please sign up first." },
        { status: 404 }
      );
    }

    await auth.api.signInMagicLink({
      body: {
        email: user.email,
        callbackURL,
      },
      headers: await headers(),
    });

    return NextResponse.json({ status: true });
  } catch (error) {
    console.error("Request login code error:", error);

    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
