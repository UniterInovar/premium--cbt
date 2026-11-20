import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { cleanHtml } from "@/lib/sanitizer";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user?.role !== "ADMIN" && session.user?.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const examType = searchParams.get("examType") || "";
  const subject = searchParams.get("subject") || "";
  const year = searchParams.get("year") || "";
  const topic = searchParams.get("topic") || "";
  const sortBy = searchParams.get("sortBy") || "newest";
  const questionType = searchParams.get("questionType") || "";
  
  const pageParam = parseInt(searchParams.get("page") || "1", 10);
  const limitParam = parseInt(searchParams.get("limit") || "50", 10);
  const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
  const limit = isNaN(limitParam) ? 50 : Math.min(100, Math.max(1, limitParam));
  const skip = (page - 1) * limit;

  let orderBy: any = { createdAt: "desc" };
  if (sortBy === "oldest") orderBy = { createdAt: "asc" };
  else if (sortBy === "yearDesc") orderBy = { year: "desc" };
  else if (sortBy === "yearAsc") orderBy = { year: "asc" };

  // Map questionType param to DB type value
  const typeMap: Record<string, string> = {
    objective: "Objective",
    theory: "Theory",
    practical: "Practical",
  };
  const dbType = questionType ? (typeMap[questionType] || null) : null;

  const parsedYear = year ? parseInt(year, 10) : undefined;

  const whereClause: any = {
    ...(dbType && { type: dbType }),
    ...(examType && { examType: { name: { contains: examType } } }),
    ...(subject && { subject: { name: { contains: subject } } }),
    ...(parsedYear && !isNaN(parsedYear) && { year: parsedYear }),
    ...(topic && { topic: { name: { contains: topic } } }),
  };


  try {
    if (questionType === "theory") {
      const theoryWhereClause: any = {
        ...(examType && { examType: { name: { contains: examType } } }),
        ...(subject && { subject: { name: { contains: subject } } }),
        ...(year && { year: parseInt(year) }),
        ...(topic && { topic: { name: { contains: topic } } }),
      };

      const [rawTheory, total] = await Promise.all([
        prisma.theoryQuestion.findMany({
          where: theoryWhereClause,
          include: { subject: true, examType: true, topic: true },
          orderBy,
          skip,
          take: limit,
        }),
        prisma.theoryQuestion.count({
          where: theoryWhereClause,
        }),
      ]);

      const questions = rawTheory.map((t) => ({
        id: t.id,
        text: t.text,
        type: "Theory",
        year: t.year,
        options: "[]",
        correctAnswer: null,
        explanation: t.sampleAnswer || "No model answer provided.",
        examType: t.examType,
        subject: t.subject,
        topic: t.topic,
        isTheoryModel: true,
      }));

      return NextResponse.json({ questions, total, page, totalPages: Math.ceil(total / limit) });
    }

    const [questions, total] = await Promise.all([
      prisma.question.findMany({
        where: whereClause,
        include: { subject: true, examType: true, topic: true },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.question.count({
        where: whereClause,
      }),
    ]);

    return NextResponse.json({ questions, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user?.role !== "ADMIN" && session.user?.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { text, type, year, options, correctAnswer, explanation, examType, subject } = await request.json();

    if (!text || !examType || !subject || typeof text !== "string" || typeof examType !== "string" || typeof subject !== "string") {
      return NextResponse.json({ error: "Text, exam type, and subject are required" }, { status: 400 });
    }

    const parsedYear = parseInt(year, 10);
    if (isNaN(parsedYear) || parsedYear < 1970 || parsedYear > 2100) {
      return NextResponse.json({ error: "Invalid exam year (must be between 1970 and 2100)" }, { status: 400 });
    }

    const sanitizedText = cleanHtml(text);
    const sanitizedExplanation = explanation && typeof explanation === "string" ? cleanHtml(explanation) : null;
    const sanitizedOptions = Array.isArray(options) ? options.map((opt: any) => typeof opt === "string" ? cleanHtml(opt) : String(opt)) : [];

    // Find or create Exam Type
    const et = await prisma.examType.upsert({
      where: { name: examType.trim().slice(0, 50) },
      update: {},
      create: { name: examType.trim().slice(0, 50) },
    });

    // Find or create Subject
    const sub = await prisma.subject.upsert({
      where: { name_examTypeId: { name: subject.trim().slice(0, 100), examTypeId: et.id } },
      update: {},
      create: { name: subject.trim().slice(0, 100), examTypeId: et.id },
    });

    const question = await prisma.question.create({
      data: {
        text: sanitizedText,
        type: typeof type === "string" ? type.slice(0, 20) : "Objective",
        year: parsedYear,
        options: JSON.stringify(sanitizedOptions),
        correctAnswer: typeof correctAnswer === "string" ? correctAnswer.slice(0, 20) : null,
        explanation: sanitizedExplanation,
        examTypeId: et.id,
        subjectId: sub.id,
      },
    });

    return NextResponse.json(question, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create question" }, { status: 500 });
  }
}
