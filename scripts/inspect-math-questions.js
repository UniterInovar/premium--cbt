const { PrismaClient } = require("@prisma/client");
const path = require("path");

const dbPath = path.resolve(__dirname, "../prisma/dev.db");
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${dbPath}` } },
});

async function run() {
  const mathQuestions = await prisma.question.findMany({
    where: {
      OR: [
        { text: { contains: "\\sqrt" } },
        { text: { contains: "\\frac" } },
        { text: { contains: "^{" } },
        { text: { contains: "√" } },
        { text: { contains: "\\(" } },
      ]
    },
    take: 15
  });

  console.log(`Found ${mathQuestions.length} math/LaTeX questions`);
  for (const q of mathQuestions) {
    console.log("-----------------------------------------");
    console.log(`ID: ${q.id}`);
    console.log(`Text: ${q.text}`);
    console.log(`Options: ${q.options}`);
  }

  await prisma.$disconnect();
}

run().catch(console.error);
