const { PrismaClient } = require("@prisma/client");
const path = require("path");

const dbPath = path.resolve(__dirname, "../prisma/dev.db");
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${dbPath}` } },
});

const corrections = [
  { regex: /carbondioxide/gi, replacement: "carbon dioxide" },
  { regex: /hydrogenperoxide/gi, replacement: "hydrogen peroxide" },
  { regex: /sodiumhydroxide/gi, replacement: "sodium hydroxide" },
  { regex: /hydrochloricacid/gi, replacement: "hydrochloric acid" },
  { regex: /sulphuricacid/gi, replacement: "sulphuric acid" },
  { regex: /sodiumchloride/gi, replacement: "sodium chloride" },
  { regex: /calciumcarbonate/gi, replacement: "calcium carbonate" },
  { regex: /coppersulphate/gi, replacement: "copper sulphate" },
  { regex: /ammoniumchloride/gi, replacement: "ammonium chloride" },
  { regex: /potassiumpermanganate/gi, replacement: "potassium permanganate" },
  { regex: /Brl\\?\(_2\)/gi, replacement: "Br\\(_2\\)" }, // Brl\(_2\) -> Br\(_2\)
  { regex: /Brl([_0-9\s])/g, replacement: "Br$1" },       // Brl2 -> Br2
  { regex: /\bBrl\b/g, replacement: "Br" },               // Brl -> Br
];

async function main() {
  console.log("Checking and correcting spelling/OCR errors...");
  const questions = await prisma.question.findMany();
  let updatedCount = 0;

  for (const q of questions) {
    let textUpdated = false;
    let optionsUpdated = false;
    let explanationUpdated = false;

    let newText = q.text || "";
    let newExplanation = q.explanation || "";
    let opts = [];
    try {
      opts = q.options ? JSON.parse(q.options) : [];
    } catch (e) {
      opts = [];
    }

    // Apply corrections to question text
    for (const c of corrections) {
      if (c.regex.test(newText)) {
        newText = newText.replace(c.regex, c.replacement);
        textUpdated = true;
      }
    }

    // Apply corrections to options
    const newOpts = [...opts];
    for (let i = 0; i < newOpts.length; i++) {
      if (newOpts[i]) {
        for (const c of corrections) {
          if (c.regex.test(newOpts[i])) {
            newOpts[i] = newOpts[i].replace(c.regex, c.replacement);
            optionsUpdated = true;
          }
        }
      }
    }

    // Apply corrections to explanation
    for (const c of corrections) {
      if (newExplanation && c.regex.test(newExplanation)) {
        newExplanation = newExplanation.replace(c.regex, c.replacement);
        explanationUpdated = true;
      }
    }

    if (textUpdated || optionsUpdated || explanationUpdated) {
      await prisma.question.update({
        where: { id: q.id },
        data: {
          text: newText,
          options: q.options ? JSON.stringify(newOpts) : null,
          explanation: newExplanation || null,
        },
      });
      updatedCount++;
      console.log(`Updated question ${q.id}:`);
      if (textUpdated) console.log(`  -> Text: ${newText.substring(0, 100)}...`);
      if (optionsUpdated) console.log(`  -> Options: ${JSON.stringify(newOpts)}`);
    }
  }

  console.log(`\nFinished spelling correction. Total questions updated: ${updatedCount}`);
  await prisma.$disconnect();
}

main().catch(console.error);
