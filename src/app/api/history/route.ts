import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user?.role === "ADMIN" || session.user?.role === "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Admins and Super Admins are not permitted to record exam history." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { examType, subjects, score, total, timeTaken } = body;

  const parsedScore = parseInt(score, 10);
  const parsedTotal = parseInt(total, 10);
  const parsedTime = parseInt(timeTaken, 10);

  if (
    typeof examType !== "string" ||
    typeof subjects !== "string" ||
    isNaN(parsedScore) ||
    isNaN(parsedTotal) ||
    isNaN(parsedTime) ||
    parsedScore < 0 ||
    parsedTotal < 1 ||
    parsedScore > parsedTotal ||
    parsedTime < 0
  ) {
    return NextResponse.json({ error: "Invalid exam metrics or payload format" }, { status: 400 });
  }

  try {
    const history = await prisma.examHistory.create({
      data: {
        userId: session.user.id,
        examType: examType.slice(0, 50),
        subjects: subjects.slice(0, 500),
        score: parsedScore,
        total: parsedTotal,
        timeTaken: parsedTime,
      },
    });
    return NextResponse.json(history, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to save history" }, { status: 500 });
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const history = await prisma.examHistory.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json(history);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}
