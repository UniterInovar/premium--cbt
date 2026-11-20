import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL || "file:./dev.db",
});

async function main() {
  console.log("Seeding database...");

  // Create Exam Types
  const jamb = await prisma.examType.upsert({
    where: { name: "JAMB" },
    update: {},
    create: { name: "JAMB" },
  });

  const waec = await prisma.examType.upsert({
    where: { name: "WAEC" },
    update: {},
    create: { name: "WAEC" },
  });

  // Create Subjects
  const maths = await prisma.subject.upsert({
    where: { name_examTypeId: { name: "Mathematics", examTypeId: jamb.id } },
    update: {},
    create: { name: "Mathematics", examTypeId: jamb.id },
  });

  const english = await prisma.subject.upsert({
    where: { name_examTypeId: { name: "English Language", examTypeId: jamb.id } },
    update: {},
    create: { name: "English Language", examTypeId: jamb.id },
  });

  const physics = await prisma.subject.upsert({
    where: { name_examTypeId: { name: "Physics", examTypeId: waec.id } },
    update: {},
    create: { name: "Physics", examTypeId: waec.id },
  });

  // Create some sample questions
  const questions = [
      {
        text: "Solve for x: 2x + 5 = 15",
        type: "Objective",
        year: 2023,
        options: JSON.stringify(["2", "5", "10", "15"]),
        correctAnswer: "1", // Index 1 is "5"
        explanation: "2x = 10, so x = 5",
        examTypeId: jamb.id,
        subjectId: maths.id,
      },
      {
        text: "What is the synonym of 'Abundant'?",
        type: "Objective",
        year: 2023,
        options: JSON.stringify(["Scarce", "Plentiful", "Minimal", "Rare"]),
        correctAnswer: "1",
        explanation: "'Plentiful' is a synonym of 'Abundant'.",
        examTypeId: jamb.id,
        subjectId: english.id,
      },
      {
        text: "The unit of force is:",
        type: "Objective",
        year: 2022,
        options: JSON.stringify(["Joule", "Watt", "Newton", "Pascal"]),
        correctAnswer: "2",
        explanation: "Force is measured in Newtons (N).",
        examTypeId: waec.id,
        subjectId: physics.id,
      }
  ];

  for (const q of questions) {
    await prisma.question.create({ data: q });
  }

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
