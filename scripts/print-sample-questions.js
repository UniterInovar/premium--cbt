const { PrismaClient } = require("@prisma/client");
const path = require("path");

const dbPath = path.resolve(__dirname, "../prisma/dev.db");
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${dbPath}` } },
});

async function run() {
  const questions = await prisma.question.findMany({
    take: 5,
  });
  console.log(JSON.stringify(questions, null, 2));
  await prisma.$disconnect();
}

run();
