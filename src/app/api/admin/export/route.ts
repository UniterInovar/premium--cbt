import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
} from "docx";

/** Strip HTML tags to plain text for Word export */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

export async function GET(request: Request) {
  // Admin-only
  const session = await getServerSession(authOptions);
  if (
    !session ||
    (session.user?.role !== "ADMIN" && session.user?.role !== "SUPER_ADMIN")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const examTypeFilter = searchParams.get("examType") || "";
  const subjectFilter = searchParams.get("subject") || "";
  const yearFilter = searchParams.get("year") || "";
  const qtype = searchParams.get("type") || "mcq"; // "mcq" | "theory" | "all"

  // ── Build filters ──────────────────────────────────────────────────
  const whereBase: any = {};
  if (examTypeFilter) whereBase.examType = { name: examTypeFilter };
  if (subjectFilter) whereBase.subject = { name: subjectFilter };
  if (yearFilter) {
    const y = parseInt(yearFilter, 10);
    if (!isNaN(y) && y >= 1970 && y <= 2100) whereBase.year = y;
  }

  // ── Fetch questions ────────────────────────────────────────────────
  const mcqQuestions =
    qtype !== "theory"
      ? await prisma.question.findMany({
          where: whereBase,
          include: { examType: true, subject: true, topic: true },
          orderBy: [{ examType: { name: "asc" } }, { subject: { name: "asc" } }, { year: "asc" }],
          take: 5000, // safety cap
        })
      : [];

  const theoryQuestions =
    qtype !== "mcq"
      ? await prisma.theoryQuestion.findMany({
          where: whereBase,
          include: { examType: true, subject: true, topic: true },
          orderBy: [{ examType: { name: "asc" } }, { subject: { name: "asc" } }, { year: "asc" }],
          take: 2000,
        })
      : [];

  // ── Build Word document ────────────────────────────────────────────
  const sections: any[] = [];

  // Cover / title paragraph
  sections.push(
    new Paragraph({
      text: "Premium CBT — Question Bank Export",
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated: ${new Date().toLocaleString("en-NG")}`,
          italics: true,
          color: "888888",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    })
  );

  // ── MCQ section ────────────────────────────────────────────────────
  if (mcqQuestions.length > 0) {
    sections.push(
      new Paragraph({
        text: `Objective / MCQ Questions  (${mcqQuestions.length} questions)`,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    let currentGroup = "";
    mcqQuestions.forEach((q, idx) => {
      const groupKey = `${q.examType.name} — ${q.subject.name}`;
      if (groupKey !== currentGroup) {
        currentGroup = groupKey;
        sections.push(
          new Paragraph({
            text: groupKey,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 },
          })
        );
      }

      const qText = stripHtml(q.text);
      let options: Record<string, string> = {};
      try {
        if (q.options) options = JSON.parse(q.options);
      } catch {}

      // Question number + text
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${idx + 1}. `, bold: true }),
            new TextRun({ text: qText }),
            new TextRun({ text: `  [${q.year}]`, color: "888888", italics: true }),
          ],
          spacing: { before: 160, after: 60 },
        })
      );

      // Options A–D
      const optionLabels = ["A", "B", "C", "D", "E"];
      const optionKeys = Object.keys(options);
      optionKeys.forEach((key, i) => {
        const label = optionLabels[i] || key;
        const isCorrect = q.correctAnswer === key;
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `  ${label}. ${stripHtml(options[key])}`,
                bold: isCorrect,
                color: isCorrect ? "16A34A" : undefined,
              }),
            ],
            spacing: { before: 20, after: 20 },
          })
        );
      });

      // Answer line
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Answer: ", bold: true }),
            new TextRun({
              text: q.correctAnswer || "—",
              color: "16A34A",
              bold: true,
            }),
          ],
          spacing: { before: 60, after: 40 },
        })
      );

      // Explanation (if any)
      if (q.explanation) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: "Explanation: ", bold: true, italics: true }),
              new TextRun({ text: stripHtml(q.explanation), italics: true, color: "555555" }),
            ],
            spacing: { before: 20, after: 100 },
          })
        );
      }
    });
  }

  // ── Theory section ─────────────────────────────────────────────────
  if (theoryQuestions.length > 0) {
    sections.push(
      new Paragraph({
        text: `Theory Questions  (${theoryQuestions.length} questions)`,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 600, after: 200 },
        pageBreakBefore: mcqQuestions.length > 0,
      })
    );

    let currentGroup = "";
    theoryQuestions.forEach((q, idx) => {
      const groupKey = `${q.examType.name} — ${q.subject.name}`;
      if (groupKey !== currentGroup) {
        currentGroup = groupKey;
        sections.push(
          new Paragraph({
            text: groupKey,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 },
          })
        );
      }

      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${idx + 1}. `, bold: true }),
            new TextRun({ text: stripHtml(q.text) }),
            new TextRun({
              text: `  [${q.year}${q.section ? ` · ${q.section}` : ""}]`,
              color: "888888",
              italics: true,
            }),
          ],
          spacing: { before: 160, after: 60 },
        })
      );

      if (q.sampleAnswer) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: "Sample Answer: ", bold: true, italics: true }),
              new TextRun({ text: stripHtml(q.sampleAnswer), italics: true, color: "555555" }),
            ],
            spacing: { before: 20, after: 100 },
          })
        );
      }
    });
  }

  if (sections.length <= 2) {
    return NextResponse.json({ error: "No questions found for the given filters." }, { status: 404 });
  }

  // ── Pack and stream ────────────────────────────────────────────────
  const doc = new Document({
    creator: "Premium CBT",
    title: "Question Bank Export",
    description: "Exported questions from the Premium CBT database",
    sections: [{ children: sections }],
  });

  const nodeBuffer = await Packer.toBuffer(doc);
  // Convert Node Buffer → Uint8Array so it's assignable to BodyInit (Web API)
  const buffer = new Uint8Array(nodeBuffer);

  const filename =
    `questions${examTypeFilter ? `-${examTypeFilter}` : ""}${subjectFilter ? `-${subjectFilter}` : ""}${yearFilter ? `-${yearFilter}` : ""}.docx`
      .replace(/\s+/g, "-")
      .toLowerCase();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": buffer.byteLength.toString(),
      // No-cache so browser always fetches fresh export
      "Cache-Control": "no-store",
    },
  });
}
