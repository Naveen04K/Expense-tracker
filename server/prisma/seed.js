const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // Create demo user
  const hashed = await bcrypt.hash('demo1234', 10);
  const user = await prisma.user.upsert({
    where: { email: 'demo@nebula.com' },
    update: {},
    create: { email: 'demo@nebula.com', password: hashed, name: 'Demo User' }
  });

  console.log('Created demo user:', user.email);

  // Seed expenses for the last 2 months
  const now = new Date();
  const categories = [
    { cat: 'Food', merchants: ['Zomato', 'Swiggy', 'Hotel Saravana', 'Dominos'], amounts: [150, 280, 450, 320] },
    { cat: 'Transport', merchants: ['Ola', 'Uber', 'BMTC', 'Rapido'], amounts: [85, 120, 35, 60] },
    { cat: 'Shopping', merchants: ['Amazon', 'Flipkart', 'DMart', 'Myntra'], amounts: [1200, 850, 560, 2100] },
    { cat: 'Bills', merchants: ['BESCOM', 'Airtel', 'Netflix', 'Jio'], amounts: [1800, 599, 649, 299] },
    { cat: 'Healthcare', merchants: ['Apollo Pharmacy', 'Practo', 'MedPlus'], amounts: [450, 200, 380] },
    { cat: 'Entertainment', merchants: ['PVR', 'BookMyShow', 'Spotify'], amounts: [350, 280, 119] },
  ];

  const expenses = [];
  for (let daysAgo = 0; daysAgo < 60; daysAgo++) {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    const numExpenses = Math.floor(Math.random() * 3);
    for (let i = 0; i < numExpenses; i++) {
      const catData = categories[Math.floor(Math.random() * categories.length)];
      const idx = Math.floor(Math.random() * catData.merchants.length);
      expenses.push({
        amount: catData.amounts[idx] + Math.floor(Math.random() * 50 - 25),
        category: catData.cat,
        merchant: catData.merchants[idx],
        description: `Purchase at ${catData.merchants[idx]}`,
        date: d,
        paymentMethod: ['card', 'upi', 'cash'][Math.floor(Math.random() * 3)],
        userId: user.id
      });
    }
  }

  await prisma.expense.createMany({ data: expenses });
  console.log(`Seeded ${expenses.length} expenses`);

  // Seed budgets
  const budgets = [
    { category: 'Food', amount: 5000 },
    { category: 'Transport', amount: 2000 },
    { category: 'Shopping', amount: 8000 },
    { category: 'Bills', amount: 4000 },
    { category: 'Healthcare', amount: 2000 },
    { category: 'Entertainment', amount: 1500 },
  ];

  for (const b of budgets) {
    await prisma.budget.upsert({
      where: { userId_category_month_year: { userId: user.id, category: b.category, month: now.getMonth() + 1, year: now.getFullYear() } },
      update: {},
      create: { ...b, month: now.getMonth() + 1, year: now.getFullYear(), userId: user.id }
    });
  }

  console.log('Seeded budgets');
  console.log('\n✅ Seed complete!');
  console.log('Demo login: demo@nebula.com / demo1234');
}

main().catch(console.error).finally(() => prisma.$disconnect());
