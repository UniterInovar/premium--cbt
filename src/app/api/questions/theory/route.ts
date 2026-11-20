import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized. Please sign in to access theory questions." }, { status: 401 });
  }

  // Administrators and Super Admins cannot take tests
  if (session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "Admins and Super Admins cannot access examination sessions." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const examType = (searchParams.get("examType") || searchParams.get("exam") || "WAEC").trim().slice(0, 50);
  const subjectParam = (searchParams.get("subject") || searchParams.get("subjects") || "").trim().slice(0, 500);
  const yearParam = searchParams.get("year");

  let year: number | undefined = undefined;
  if (yearParam) {
    const parsed = parseInt(yearParam, 10);
    if (!isNaN(parsed) && parsed >= 1970 && parsed <= 2100) {
      year = parsed;
    }
  }

  const subjectList = subjectParam
    ? subjectParam
        .split(",")
        .map((s) => s.trim().slice(0, 100))
        .filter(Boolean)
    : [];

  const examUpper = examType.toUpperCase();

  try {
    const rawTheory = await prisma.theoryQuestion.findMany({
      where: {
        ...(examType && { examType: { name: examType } }),
        ...(subjectList.length > 0 && {
          subject: { name: { in: subjectList } },
        }),
        ...(year && { year }),
      },
      include: { subject: true, examType: true, topic: true },
      orderBy: { createdAt: "desc" },
    });

    // Group by subject
    const bySubject: Record<string, typeof rawTheory> = {};
    for (const q of rawTheory) {
      const subName = q.subject?.name || "General";
      if (!bySubject[subName]) bySubject[subName] = [];
      bySubject[subName].push(q);
    }

    // Process each subject into authentic WAEC / NECO section layout
    const formattedSubjects: any[] = [];

    for (const [subName, items] of Object.entries(bySubject)) {
      const pool = [...items];
      let sections: any[] = [];

      if (examUpper === "NECO") {
        // NECO Standard Layout:
        // Section I: Compulsory short answer (Answer ALL)
        // Section II: Extended essay (Answer any 4 out of 6)
        const sec1Items = pool.slice(0, 5).map((q, idx) => ({
          ...q,
          questionNumber: idx + 1,
          sectionName: "Section I",
          marks: 10,
        }));

        const sec2Items = pool.slice(5, 11).map((q, idx) => ({
          ...q,
          questionNumber: sec1Items.length + idx + 1,
          sectionName: "Section II",
          marks: 15,
        }));

        sections = [
          {
            id: "sec_1",
            name: "SECTION I (Short Answer & Core Concepts)",
            instructions: "Answer ALL questions in this section. Each question carries 10 marks.",
            isCompulsory: true,
            requiredChoiceCount: sec1Items.length,
            totalAvailable: sec1Items.length,
            questions: sec1Items,
          },
          {
            id: "sec_2",
            name: "SECTION II (Extended Essay & Calculations)",
            instructions: "Answer any FOUR (4) questions from this section. Each question carries 15 marks.",
            isCompulsory: false,
            requiredChoiceCount: 4,
            totalAvailable: sec2Items.length,
            questions: sec2Items,
          },
        ];
      } else {
        // WAEC / Standard Layout:
        // Section A: Compulsory (Answer ALL)
        // Section B: Elective (Answer any 3 out of 5)
        const secAItems = pool.slice(0, 5).map((q, idx) => ({
          ...q,
          questionNumber: idx + 1,
          sectionName: "Section A",
          marks: 8,
        }));

        const secBItems = pool.slice(5, 10).map((q, idx) => ({
          ...q,
          questionNumber: secAItems.length + idx + 1,
          sectionName: "Section B",
          marks: 20,
        }));

        sections = [
          {
            id: "sec_a",
            name: "SECTION A [COMPULSORY]",
            instructions: "Answer ALL questions in this section. Show clear reasoning where required.",
            isCompulsory: true,
            requiredChoiceCount: secAItems.length,
            totalAvailable: secAItems.length,
            questions: secAItems,
          },
          {
            id: "sec_b",
            name: "SECTION B [ELECTIVE]",
            instructions: "Answer any THREE (3) questions from this section.",
            isCompulsory: false,
            requiredChoiceCount: 3,
            totalAvailable: secBItems.length,
            questions: secBItems,
          },
        ];
      }

      formattedSubjects.push({
        subject: subName,
        sections,
        totalQuestions: items.length,
      });
    }

    return NextResponse.json({
      examType: examUpper,
      subjects: formattedSubjects,
    });
  } catch (error: any) {
    console.error("Theory Questions Fetch Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch theory questions", details: error.message },
      { status: 500 }
    );
  }
}
