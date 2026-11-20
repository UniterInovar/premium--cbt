import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { cleanHtml } from "@/lib/sanitizer";

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  console.log("Session in GET /api/admin/questions/[id]:", session);
  if (!session || (session.user?.role !== "ADMIN" && session.user?.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized", session }, { status: 401 });
  }

  try {
    const { id } = await params;
    let question: any = await prisma.question.findUnique({
      where: { id },
      include: { subject: true, examType: true },
    });

    if (!question) {
      const theoryQ = await prisma.theoryQuestion.findUnique({
        where: { id },
        include: { subject: true, examType: true },
      });
      if (theoryQ) {
        question = {
          ...theoryQ,
          type: "Theory",
          options: "[]",
          correctAnswer: "",
          explanation: theoryQ.sampleAnswer || "",
        };
      }
    }

    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    return NextResponse.json(question);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch question" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user?.role !== "ADMIN" && session.user?.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { text, type, year, options, correctAnswer, explanation, examType, subject } = await request.json();

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid question ID" }, { status: 400 });
    }

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

    // Check if updating Question or TheoryQuestion
    const existingMCQ = await prisma.question.findUnique({ where: { id } });
    if (existingMCQ) {
      const updated = await prisma.question.update({
        where: { id },
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
      return NextResponse.json(updated);
    }

    const existingTheory = await prisma.theoryQuestion.findUnique({ where: { id } });
    if (existingTheory) {
      const updated = await prisma.theoryQuestion.update({
        where: { id },
        data: {
          text: sanitizedText,
          year: parsedYear,
          sampleAnswer: sanitizedExplanation,
          examTypeId: et.id,
          subjectId: sub.id,
        },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update question" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user?.role !== "ADMIN" && session.user?.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid question ID" }, { status: 400 });
    }

    const existingMCQ = await prisma.question.findUnique({ where: { id } });
    if (existingMCQ) {
      await prisma.question.delete({ where: { id } });
      return NextResponse.json({ message: "Question deleted successfully" });
    }

    const existingTheory = await prisma.theoryQuestion.findUnique({ where: { id } });
    if (existingTheory) {
      await prisma.theoryQuestion.delete({ where: { id } });
      return NextResponse.json({ message: "Theory question deleted successfully" });
    }

    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete question" }, { status: 500 });
  }
}
