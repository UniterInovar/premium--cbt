const { PrismaClient } = require("@prisma/client");
const path = require("path");

const dbPath = path.resolve(__dirname, "../prisma/dev.db");
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${dbPath}` } },
});

async function run() {
  const questions = await prisma.question.findMany();
  
  let totalObjective = 0;
  let fiveOptionsCount = 0;
  const correctAnswersSet = new Set();
  const nonNumericAnswers = [];

  for (const q of questions) {
    if (q.type === "Theory" || !q.options) continue;
    
    let opts = [];
    try {
      opts = JSON.parse(q.options);
    } catch (e) {
      continue;
    }
    
    totalObjective++;
    if (opts.length === 5) {
      fiveOptionsCount++;
      correctAnswersSet.add(q.correctAnswer);
      const idx = parseInt(q.correctAnswer);
      if (isNaN(idx)) {
        nonNumericAnswers.push({ id: q.id, correctAnswer: q.correctAnswer });
      }
    }
  }

  console.log(`Total objective questions: ${totalObjective}`);
  console.log(`Objective questions with 5 options: ${fiveOptionsCount}`);
  console.log(`Unique correct answers values in 5-option questions:`, [...correctAnswersSet]);
  if (nonNumericAnswers.length > 0) {
    console.log(`Non-numeric correct answers found in 5-option questions:`, nonNumericAnswers.slice(0, 5));
  } else {
    console.log(`All 5-option questions have numeric correct answers!`);
  }

  await prisma.$disconnect();
}

run();
