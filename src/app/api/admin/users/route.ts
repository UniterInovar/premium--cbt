import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user?.role !== "ADMIN" && session.user?.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: {
          select: { examHistories: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user?.role !== "ADMIN" && session.user?.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, role } = await request.json();

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Valid user ID is required" }, { status: 400 });
    }

    if (role !== "USER" && role !== "ADMIN") {
      return NextResponse.json({ error: "Invalid role. Only USER or ADMIN can be assigned." }, { status: 400 });
    }

    // Prevent revoking self
    if (id === session.user.id) {
      return NextResponse.json({ error: "You cannot change your own role" }, { status: 400 });
    }

    // Prevent setting or touching SUPER_ADMIN role via this endpoint
    if (role === "SUPER_ADMIN") {
      return NextResponse.json({ error: "SUPER_ADMIN role cannot be assigned here." }, { status: 403 });
    }

    // Prevent modifying a SUPER_ADMIN account
    const targetUser = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (targetUser?.role === "SUPER_ADMIN") {
      return NextResponse.json({ error: "Super Admin role cannot be changed." }, { status: 403 });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, role: true }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user?.role !== "ADMIN" && session.user?.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    let userId = searchParams.get("id");

    if (!userId) {
      const body = await request.json().catch(() => ({}));
      userId = body.id;
    }

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "Valid User ID is required" }, { status: 400 });
    }

    // No one can delete their own account
    if (userId === session.user.id) {
      return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Extra email-match guard for self-deletion
    if (targetUser.email === session.user.email) {
      return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
    }

    // Only SUPER_ADMIN can delete ADMIN or SUPER_ADMIN accounts
    if (
      (targetUser.role === "ADMIN" || targetUser.role === "SUPER_ADMIN") &&
      session.user?.role !== "SUPER_ADMIN"
    ) {
      return NextResponse.json(
        { error: "Only a Super Admin can delete an Admin account." },
        { status: 403 }
      );
    }

    // SUPER_ADMIN accounts can never be deleted (protect the top-level account)
    if (targetUser.role === "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Super Admin accounts cannot be deleted." },
        { status: 403 }
      );
    }

    // Clean up auxiliary tokens
    if (targetUser.email) {
      await prisma.passwordResetToken.deleteMany({
        where: { email: targetUser.email },
      });
      await prisma.verificationToken.deleteMany({
        where: { identifier: targetUser.email },
      });
    }

    // Delete user (Prisma schema cascades Account, Session, and ExamHistory)
    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({ message: "User account deleted successfully", email: targetUser.email });
  } catch (error: any) {
    console.error("Delete user error:", error);
    return NextResponse.json({ error: "Failed to delete user: " + error.message }, { status: 500 });
  }
}

