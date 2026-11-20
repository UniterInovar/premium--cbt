const { PrismaClient } = require("@prisma/client");
const path = require("path");

const dbPath = path.resolve(__dirname, "../prisma/dev.db");
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${dbPath}` } },
});

async function run() {
  console.log("=== Inspecting Database Questions ===");

  // 1. Inspect questions with fractions or powers/superscripts
  const allQuestions = await prisma.question.findMany({
    include: { subject: true, examType: true }
  });

  console.log(`Total questions in DB: ${allQuestions.length}`);

  console.log("\n--- Sample Fraction / Power questions ---");
  let mathCount = 0;
  for (const q of allQuestions) {
    const text = q.text || "";
    const optsStr = q.options || "";
    if (
      text.includes("/") || text.includes("^") || text.includes("sup") || text.includes("sub") ||
      text.includes("\\frac") || text.includes("fraction") || text.includes("square") || text.includes("cube") ||
      optsStr.includes("/") || optsStr.includes("^") || optsStr.includes("sup")
    ) {
      if (mathCount < 10) {
        console.log(`ID: ${q.id} | Subject: ${q.subject?.name} | Type: ${q.type}`);
        console.log(`  Text: ${text.substring(0, 150)}`);
        console.log(`  Options: ${optsStr}`);
      }
      mathCount++;
    }
  }
  console.log(`Total questions with possible fractions/powers/math: ${mathCount}`);

  console.log("\n--- Inspecting Objective Questions that might be Theory ---");
  let theoryInObjCount = 0;
  for (const q of allQuestions) {
    let opts = [];
    try {
      opts = typeof q.options === "string" ? JSON.parse(q.options) : (q.options || []);
    } catch (e) {}

    // Conditions where an Objective question is actually a Theory question:
    // 1. type === 'Objective' but opts is empty or opts length === 0
    // 2. type === 'Objective' but options look like instructions ("Section A", "Calculate...", "Write...", no distinct option choices)
    // 3. text starts with "Question 1", "Attempt all questions", "Section B", etc. or has no real A, B, C, D choices
    const isObj = q.type === "Objective";
    const noOpts = !Array.isArray(opts) || opts.length === 0 || opts.every(o => !o || o.trim() === "");
    const looksLikeTheory = noOpts || opts.length < 2;

    if (isObj && looksLikeTheory) {
      if (theoryInObjCount < 10) {
        console.log(`[Theory in OBJ] ID: ${q.id} | Subject: ${q.subject?.name} | Type: ${q.type} | Opts Count: ${opts.length}`);
        console.log(`  Text: ${q.text.substring(0, 150)}`);
        console.log(`  Options: ${JSON.stringify(opts)}`);
      }
      theoryInObjCount++;
    }
  }
  console.log(`Total Theory questions categorized as Objective (empty/no options): ${theoryInObjCount}`);

  await prisma.$disconnect();
}

run().catch(console.error);
