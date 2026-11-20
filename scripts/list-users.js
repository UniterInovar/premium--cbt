const { PrismaClient } = require("@prisma/client");
const path = require("path");

const dbPath = path.resolve(__dirname, "../prisma/dev.db");
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${dbPath}` } },
});

async function main() {
  const users = await prisma.user.findMany();
  console.log("Users list:", users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
