import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { sendActivationEmail } from "@/lib/mail";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Valid email and password are required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (normalizedEmail.length > 255 || !EMAIL_REGEX.test(normalizedEmail)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    if (password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: "Password must be between 8 and 128 characters" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      // If user exists and is not verified, allow resending activation link
      if (!existingUser.emailVerified) {
        const token = crypto.randomBytes(32).toString("hex");
        const expires = new Date(Date.now() + 24 * 3600 * 1000); // 24 hours

        await prisma.verificationToken.deleteMany({
          where: { identifier: normalizedEmail },
        });

        await prisma.verificationToken.create({
          data: {
            identifier: normalizedEmail,
            token,
            expires,
          },
        });

        try {
          await sendActivationEmail(normalizedEmail, token);
        } catch (mailErr) {
          console.error("Failed to resend activation email:", mailErr);
        }

        return NextResponse.json(
          {
            message: "Account already registered but not activated. A new activation email has been sent!",
            requiresActivation: true,
          },
          { status: 200 }
        );
      }

      return NextResponse.json({ error: "An account with this email already exists. Please sign in." }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: normalizedEmail.split("@")[0],
        password: hashedPassword,
        role: "USER", // Self-registered accounts start as USER
        emailVerified: null, // Unverified until activated via email
      },
    });

    // Create 24h verification token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 3600 * 1000);

    await prisma.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token,
        expires,
      },
    });

    try {
      await sendActivationEmail(normalizedEmail, token);
    } catch (mailErr) {
      console.error("Failed to send activation email:", mailErr);
    }

    return NextResponse.json(
      {
        message: "Account created! Please check your email inbox to activate your account before signing in.",
        requiresActivation: true,
        userId: user.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}
