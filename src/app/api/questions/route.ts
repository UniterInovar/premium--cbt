import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized. Please sign in to access exam questions." }, { status: 401 });
  }

  // Administrators and Super Admins cannot take tests
  if (session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "Admins and Super Admins cannot access examination sessions." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const examType = (searchParams.get("examType") || "").trim().slice(0, 50);
  const subjectParam = (searchParams.get("subject") || "").trim().slice(0, 500);

  const rawYear = searchParams.get("year");
  let year: number | undefined = undefined;
  if (rawYear) {
    const parsed = parseInt(rawYear, 10);
    if (!isNaN(parsed) && parsed >= 1970 && parsed <= 2100) {
      year = parsed;
    }
  }

  // "objective" (default) | "theory" | "practical" — what type of questions to serve
  const rawQType = (searchParams.get("questionType") || "objective").toLowerCase().trim();
  const allowedQTypes = ["objective", "theory", "practical"];
  const questionType = allowedQTypes.includes(rawQType) ? rawQType : "objective";

  // Support comma-separated list of subjects
  const subjectList = subjectParam
    ? subjectParam
      .split(",")
      .map((s) => s.trim().slice(0, 100))
      .filter(Boolean)
    : [];

  // Map the questionType param to the DB type field value
  const typeMap: Record<string, string> = {
    objective: "Objective",
    theory: "Theory",
    practical: "Practical",
  };
  const dbType = typeMap[questionType] || "Objective";

  try {
    const questions = await prisma.question.findMany({
      where: {
        type: dbType,
        ...(examType && { examType: { name: examType } }),
        ...(subjectList.length > 0 && {
          subject: { name: { in: subjectList } },
        }),
        ...(year && { year }),
      },
      include: { topic: true, subject: true, examType: true },
    });

    if (questions.length === 0) {
      console.log(`No ${dbType} questions found for Exam: ${examType}, Subjects: ${subjectList.join(", ")}, Year: ${year}`);
    }

    // Group questions by subject name
    const grouped: Record<string, typeof questions> = {};
    for (const q of questions) {
      const subName = q.subject?.name || "Unknown";
      if (!grouped[subName]) {
        grouped[subName] = [];
      }
      grouped[subName].push(q);
    }

    // For each subject, shuffle and take the specified limit (100 for English, 50 for others)
    let finalQuestions: typeof questions = [];
    for (const subName of Object.keys(grouped)) {
      const isEnglish = subName.toLowerCase() === "english language" || subName.toLowerCase() === "english";
      const limit = isEnglish ? 100 : 50;

      const shuffledSub = [...grouped[subName]].sort(() => 0.5 - Math.random());
      const selected = shuffledSub.slice(0, limit);
      finalQuestions.push(...selected);
    }

    // Shuffle the combined list so subjects are interleaved
    const result = [...finalQuestions].sort(() => 0.5 - Math.random());

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Prisma Fetch Error:", error.message || error);
    return NextResponse.json(
      { error: "Failed to fetch questions", details: error.message },
      { status: 500 }
    );
  }
}

