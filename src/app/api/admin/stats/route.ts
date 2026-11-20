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
    const [mcqQuestions, theoryQuestions, users, exams] = await Promise.all([
      prisma.question.count(),
      prisma.theoryQuestion.count(),
      prisma.user.count(),
      prisma.examHistory.count(),
    ]);

    return NextResponse.json({
      questions: mcqQuestions + theoryQuestions,
      mcqQuestions,
      theoryQuestions,
      users,
      exams,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
