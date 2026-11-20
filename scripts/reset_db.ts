import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function reset() {
  console.log("⚠️ Deleting all database records...");

  // Delete all data in reverse relational order to avoid foreign key constraint errors
  await prisma.examHistory.deleteMany();
  await prisma.question.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.examType.deleteMany();
  await prisma.user.deleteMany();

  console.log("✅ Database cleared.");

  console.log("👤 Creating master admin user...");
  const adminEmail = process.env.ADMIN_SEED_EMAIL;
  const adminPassword = process.env.ADMIN_SEED_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error(
      "❌ ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD must be set in .env before running reset_db."
    );
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  
  await prisma.user.create({
    data: {
      name: "Admin",
      email: adminEmail,
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  console.log(`✅ Master admin user created (${adminEmail}).`);
  console.log("🎉 Reset complete! You can now start scraping real data.");
}

reset()
  .catch((e) => {
    console.error("❌ Error resetting database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
