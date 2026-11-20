const { PrismaClient } = require("@prisma/client");
const path = require("path");

const dbPath = path.resolve(__dirname, "../prisma/dev.db");
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${dbPath}` } },
});

// Common conjoined words, OCR errors, or chemical spelling errors from scraping
const patterns = [
  { regex: /carbondioxide/gi, correction: "carbon dioxide" },
  { regex: /hydrogenperoxide/gi, correction: "hydrogen peroxide" },
  { regex: /sodiumchloride/gi, correction: "sodium chloride" },
  { regex: /sodiumhydroxide/gi, correction: "sodium hydroxide" },
  { regex: /Brl\\?\(_2\)/gi, correction: "Br\\(_2\\)" }, // e.g. Brl\(_2\) -> Br\(_2\)
  { regex: /Brl\b/gi, correction: "Br" },
  { regex: /neutralise/gi, correction: "neutralize" }, // standardizing or checking
  { regex: /\bhydrochloricacid\b/gi, correction: "hydrochloric acid" },
  { regex: /\bsulphuricacid\b/gi, correction: "sulphuric acid" },
  { regex: /waterglass/gi, correction: "water glass" },
  { regex: /potassiumpermanganate/gi, correction: "potassium permanganate" },
  { regex: /electrovalent/gi, correction: "electrovalent" }, // check spelling
];

async function run() {
  const questions = await prisma.question.findMany();
  console.log(`Checking ${questions.length} questions and their options...`);

  const matches = [];

  for (const q of questions) {
    let questionHasIssue = false;
    const matchedPatterns = [];

    // Check question text
    for (const p of patterns) {
      if (q.text && p.regex.test(q.text)) {
        matchedPatterns.push({ field: "text", pattern: p.regex.toString(), correction: p.correction });
        questionHasIssue = true;
      }
    }

    // Check options
    if (q.options) {
      let opts = [];
      try {
        opts = JSON.parse(q.options);
      } catch (e) {}

      for (let i = 0; i < opts.length; i++) {
        for (const p of patterns) {
          if (opts[i] && p.regex.test(opts[i])) {
            matchedPatterns.push({ field: `options[${i}]`, pattern: p.regex.toString(), correction: p.correction });
            questionHasIssue = true;
          }
        }
      }
    }

    // Check explanation
    for (const p of patterns) {
      if (q.explanation && p.regex.test(q.explanation)) {
        matchedPatterns.push({ field: "explanation", pattern: p.regex.toString(), correction: p.correction });
        questionHasIssue = true;
      }
    }

    if (questionHasIssue) {
      matches.push({
        id: q.id,
        textSnippet: q.text ? q.text.substring(0, 100) : "",
        matches: matchedPatterns,
      });
    }
  }

  console.log(`Found ${matches.length} questions with potential spelling/OCR errors.`);
  console.log("\nSamples of findings:");
  for (const m of matches.slice(0, 15)) {
    console.log(JSON.stringify(m, null, 2));
  }

  await prisma.$disconnect();
}

run();
