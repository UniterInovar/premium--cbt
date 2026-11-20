const { PrismaClient } = require("@prisma/client");
const path = require("path");

const dbPath = path.resolve(__dirname, "../prisma/dev.db");
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${dbPath}` } },
});

function sanitizeOption(opt) {
  if (!opt) return "";
  let clean = opt.trim();
  const prefixRegex = /^\s*(?:<[^>]+>\s*)*(?:Option\s+[A-E]\s*[:\.\)]?|[A-E]\s*[\.\):\s\-])\s*(?:<[^>]+>\s*)*/i;
  let last = "";
  while (clean !== last) {
    last = clean;
    clean = clean.replace(prefixRegex, (match) => {
      const tags = match.match(/<[^>]+>/g);
      return tags ? tags.join("") : "";
    });
  }
  return clean.trim();
}

async function run() {
  console.log("Starting option prefix sanitization across dev.db...");
  const questions = await prisma.question.findMany();
  let updatedCount = 0;

  for (const q of questions) {
    if (!q.options) continue;
    try {
      const opts = typeof q.options === "string" ? JSON.parse(q.options) : q.options;
      if (!Array.isArray(opts)) continue;

      const cleaned = opts.map(sanitizeOption);

      if (JSON.stringify(opts) !== JSON.stringify(cleaned)) {
        await prisma.question.update({
          where: { id: q.id },
          data: { options: JSON.stringify(cleaned) },
        });
        updatedCount++;
        console.log(`[Cleaned Q-ID ${q.id}]: ${JSON.stringify(opts)} -> ${JSON.stringify(cleaned)}`);
      }
    } catch (e) {
      console.error(`Error processing Q-ID ${q.id}:`, e.message);
    }
  }

  console.log(`Done! Sanitized option prefixes for ${updatedCount} questions in the database.`);
  await prisma.$disconnect();
}

run();
