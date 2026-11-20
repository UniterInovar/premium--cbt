const { PrismaClient } = require("@prisma/client");
const path = require("path");
const fs = require("fs");

const dbPath = path.resolve(__dirname, "../prisma/dev.db");
const backupPath = path.resolve(__dirname, "../prisma/dev.db.bak");

// 1. Create a backup of the database
console.log("Backing up database...");
try {
  fs.copyFileSync(dbPath, backupPath);
  console.log(`Backup created at: ${backupPath}`);
} catch (err) {
  console.error("Backup failed!", err);
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: { db: { url: `file:${dbPath}` } },
});

async function main() {
  console.log("Fetching questions...");
  const questions = await prisma.question.findMany();

  let countConverted = 0;
  console.log(`Total questions in database: ${questions.length}`);

  // We'll update the questions in batches using a transaction or individually.
  // Since we are updating individual questions, let's do it in a loop.
  for (const q of questions) {
    if (!q.options) continue;

    let opts = [];
    try {
      opts = JSON.parse(q.options);
    } catch (e) {
      continue;
    }

    if (opts.length === 5) {
      const correctIdx = parseInt(q.correctAnswer);
      if (isNaN(correctIdx)) {
        console.warn(`Question ${q.id} has non-numeric correctAnswer: ${q.correctAnswer}`);
        continue;
      }

      let newOpts = [];
      let newCorrectAnswer = q.correctAnswer;

      if (correctIdx === 4) {
        // E (index 4) is the correct answer. Keep it, remove A (index 0).
        newOpts = opts.slice(1); // indices 1, 2, 3, 4
        newCorrectAnswer = "3"; // E is now at index 3
      } else {
        // Correct answer is A, B, C, or D (indices 0, 1, 2, or 3). Remove E (index 4).
        newOpts = opts.slice(0, 4); // indices 0, 1, 2, 3
        newCorrectAnswer = correctIdx.toString();
      }

      // Update the question
      await prisma.question.update({
        where: { id: q.id },
        data: {
          options: JSON.stringify(newOpts),
          correctAnswer: newCorrectAnswer,
        },
      });

      countConverted++;
      if (countConverted % 200 === 0) {
        console.log(`Converted ${countConverted} questions...`);
      }
    }
  }

  console.log(`\nSuccessfully converted ${countConverted} questions from 5 options to 4 options!`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
