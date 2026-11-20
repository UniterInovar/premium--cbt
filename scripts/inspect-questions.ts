import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: "file:./dev.db" } },
});

async function inspect() {
  const questions = await prisma.question.findMany({
    include: { subject: true, examType: true },
  });

  console.log(`\nTotal questions: ${questions.length}\n`);

  // Count options distribution
  const optionCounts: Record<number, number> = {};
  const renderIssues: any[] = [];
  const samplesByOptionCount: Record<number, any[]> = {};

  for (const q of questions) {
    let opts: string[] = [];
    try {
      opts = typeof q.options === "string" ? JSON.parse(q.options) : (q.options || []);
    } catch {
      renderIssues.push({ id: q.id, reason: "Invalid JSON options", text: q.text?.substring(0, 80) });
      continue;
    }

    const count = opts.length;
    optionCounts[count] = (optionCounts[count] || 0) + 1;

    if (!samplesByOptionCount[count]) samplesByOptionCount[count] = [];
    if (samplesByOptionCount[count].length < 2) {
      samplesByOptionCount[count].push({
        id: q.id,
        text: q.text?.substring(0, 120),
        options: opts,
        correctAnswer: q.correctAnswer,
        type: q.type,
        subject: q.subject?.name,
        examType: q.examType?.name,
      });
    }

    // Check for rendering issues
    const hasRawHtml = q.text && (q.text.includes("&lt;") || q.text.includes("&amp;") || q.text.includes("&#"));
    const hasBrokenTags = q.text && (/<[^>]*$/.test(q.text) || /^[^<]*>/.test(q.text));
    const hasDoubleParagraph = q.text && q.text.includes("<p><p>");
    const hasEmptyText = !q.text || q.text.trim() === "" || q.text.trim() === "<p></p>";
    const optionsWithIssues = opts.some(o => 
      o.includes("&lt;") || o.includes("&amp;") || !o.trim() || o.trim() === "<p></p>"
    );

    if (hasRawHtml || hasBrokenTags || hasDoubleParagraph || hasEmptyText || optionsWithIssues) {
      if (renderIssues.length < 15) {
        renderIssues.push({
          id: q.id,
          reason: [
            hasRawHtml && "escaped HTML entities",
            hasBrokenTags && "broken HTML tags",
            hasDoubleParagraph && "double <p> tags",
            hasEmptyText && "empty text",
            optionsWithIssues && "option rendering issues",
          ].filter(Boolean).join(", "),
          text: q.text?.substring(0, 120),
          options: opts.map(o => o.substring(0, 80)),
        });
      }
    }
  }

  console.log("=== Option Count Distribution ===");
  for (const [count, num] of Object.entries(optionCounts).sort((a, b) => Number(b[1]) - Number(a[1]))) {
    console.log(`  ${count} options: ${num} questions`);
  }

  console.log("\n=== Samples by Option Count ===");
  for (const [count, samples] of Object.entries(samplesByOptionCount)) {
    console.log(`\n--- ${count} options ---`);
    for (const s of samples) {
      console.log(JSON.stringify(s, null, 2));
    }
  }

  console.log(`\n=== Rendering Issues (${renderIssues.length} found) ===`);
  for (const issue of renderIssues.slice(0, 10)) {
    console.log(JSON.stringify(issue, null, 2));
  }

  await prisma.$disconnect();
}

inspect().catch(console.error);
