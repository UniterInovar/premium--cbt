const { PrismaClient } = require("@prisma/client");
const path = require("path");

const dbPath = path.resolve(__dirname, "../prisma/dev.db");
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${dbPath}` } },
});

async function run() {
  const questions = await prisma.question.findMany({
    include: { subject: true, examType: true },
  });

  const issues = [];
  for (const q of questions) {
    let opts = [];
    try {
      opts = typeof q.options === "string" ? JSON.parse(q.options) : (q.options || []);
    } catch (e) {
      issues.push({ id: q.id, type: "JSON_ERROR", text: q.text });
      continue;
    }

    // Check for LaTeX formatting issues
    if (q.text && (q.text.includes("\\(") || q.text.includes("$$") || q.text.includes("$") || q.text.includes("\\["))) {
      issues.push({ id: q.id, type: "LATEX", text: q.text, options: opts });
    }

    // Check for raw html entities that look escaped like &amp;lt;
    if (q.text && (q.text.includes("&amp;amp;") || q.text.includes("&amp;lt;") || q.text.includes("&amp;gt;") || q.text.includes("&amp;nbsp;"))) {
      issues.push({ id: q.id, type: "DOUBLE_ESCAPED", text: q.text });
    }

    // Check for empty/missing options or options with double letters
    if (!opts || opts.length === 0) {
      issues.push({ id: q.id, type: "NO_OPTIONS", text: q.text });
    }
  }

  console.log(`Found ${issues.length} potential rendering issues.`);
  console.log("Types of issues found:", [...new Set(issues.map(i => i.type))]);
  
  // Show 3 of each type
  const types = [...new Set(issues.map(i => i.type))];
  for (const t of types) {
    console.log(`\n--- Samples of ${t} ---`);
    const samples = issues.filter(i => i.type === t).slice(0, 3);
    for (const s of samples) {
      console.log(`ID: ${s.id}`);
      console.log(`Text: ${s.text}`);
      if (s.options) console.log(`Options: ${JSON.stringify(s.options)}`);
    }
  }

  await prisma.$disconnect();
}

run();
