const { PrismaClient } = require("@prisma/client");
const path = require("path");

const dbPath = path.resolve(__dirname, "../prisma/dev.db");
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${dbPath}` } },
});

async function main() {
  const subjects = await prisma.subject.findMany();
  console.log("Subjects list:", subjects.map(s => s.name));
}

main().catch(console.error).finally(() => prisma.$disconnect());
