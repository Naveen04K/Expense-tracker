const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const prisma = new PrismaClient();

router.use(auth);

// GET budgets for current month
router.get('/', async (req, res) => {
  const now = new Date();
  const { month = now.getMonth() + 1, year = now.getFullYear() } = req.query;
  const budgets = await prisma.budget.findMany({
    where: { userId: req.user.id, month: parseInt(month), year: parseInt(year) }
  });
  res.json(budgets);
});

// SET budget (upsert)
router.post('/', async (req, res) => {
  try {
    const { category, amount, month, year } = req.body;
    const now = new Date();
    const budget = await prisma.budget.upsert({
      where: {
        userId_category_month_year: {
          userId: req.user.id,
          category,
          month: month || now.getMonth() + 1,
          year: year || now.getFullYear()
        }
      },
      update: { amount: parseFloat(amount) },
      create: {
        category, amount: parseFloat(amount),
        month: month || now.getMonth() + 1,
        year: year || now.getFullYear(),
        userId: req.user.id
      }
    });
    res.json(budget);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to set budget' });
  }
});

// DELETE budget
router.delete('/:id', async (req, res) => {
  await prisma.budget.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
  res.json({ success: true });
});

module.exports = router;
