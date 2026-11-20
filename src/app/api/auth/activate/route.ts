import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Activation token is required" }, { status: 400 });
  }

  try {
    const verification = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!verification) {
      return NextResponse.json({ error: "Invalid or already used activation token" }, { status: 400 });
    }

    if (verification.expires < new Date()) {
      await prisma.verificationToken.delete({ where: { token } });
      return NextResponse.json({ error: "Activation token has expired. Please register again to receive a fresh link." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: verification.identifier },
    });

    if (!user) {
      return NextResponse.json({ error: "User account not found" }, { status: 404 });
    }

    // Mark email as verified
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    });

    // Delete token once verified
    await prisma.verificationToken.delete({
      where: { token },
    });

    return NextResponse.json({
      message: "Account activated successfully! You can now log in.",
      email: user.email,
    });
  } catch (error) {
    console.error("Account activation error:", error);
    return NextResponse.json({ error: "Failed to activate account" }, { status: 500 });
  }
}

