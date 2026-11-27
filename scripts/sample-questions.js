const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Chemistry WAEC sample
  const chem = await p.question.findMany({
    take: 3,
    where: { subject: { name: 'Chemistry' }, examType: { name: 'WAEC' } },
    select: { text: true, options: true, explanation: true }
  });
  console.log('=== CHEMISTRY WAEC ===');
  chem.forEach((q, i) => {
    console.log(`Q${i}: ${JSON.stringify(q.text).substring(0, 400)}`);
    console.log(`OPT: ${JSON.stringify(q.options).substring(0, 300)}`);
    console.log('---');
  });

  // Biology JAMB sample
  const bio = await p.question.findMany({
    take: 3,
    where: { subject: { name: 'Biology' }, examType: { name: 'JAMB' } },
    select: { text: true, options: true }
  });
  console.log('\n=== BIOLOGY JAMB ===');
  bio.forEach((q, i) => {
    console.log(`Q${i}: ${JSON.stringify(q.text).substring(0, 400)}`);
    console.log('---');
  });

  // Math WAEC sample (likely has LaTeX)
  const math = await p.question.findMany({
    take: 3,
    where: { subject: { name: 'Mathematics' }, examType: { name: 'WAEC' } },
    select: { text: true, options: true }
  });
  console.log('\n=== MATH WAEC ===');
  math.forEach((q, i) => {
    console.log(`Q${i}: ${JSON.stringify(q.text).substring(0, 400)}`);
    console.log('---');
  });
}

main().then(() => p.$disconnect()).catch(e => { console.error(e); p.$disconnect(); });
