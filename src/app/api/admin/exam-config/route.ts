import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user?.role !== "ADMIN" && session.user?.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const examTypes = await prisma.examType.findMany({
      include: {
        subjects: {
          include: {
            _count: {
              select: { questions: true }
            }
          }
        },
        _count: {
          select: { questions: true }
        }
      }
    });

    return NextResponse.json(examTypes);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch exam configuration" }, { status: 500 });
  }
}
