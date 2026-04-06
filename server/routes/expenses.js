const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const prisma = new PrismaClient();

router.use(auth);

// GET all expenses with filtering
router.get('/', async (req, res) => {
  try {
    const { category, startDate, endDate, limit, search, sortBy, sortOrder, paymentMethod } = req.query;
    const where = { userId: req.user.id };

    if (category) where.category = { contains: category, mode: 'insensitive' };
    if (paymentMethod) where.paymentMethod = paymentMethod;
    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { merchant: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    const orderBy = {};
    orderBy[sortBy || 'date'] = sortOrder || 'desc';

    const expenses = await prisma.expense.findMany({
      where,
      orderBy,
      take: limit ? parseInt(limit) : 100
    });
    res.json(expenses);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// GET single expense
router.get('/:id', async (req, res) => {
  const expense = await prisma.expense.findFirst({
    where: { id: req.params.id, userId: req.user.id }
  });
  if (!expense) return res.status(404).json({ error: 'Not found' });
  res.json(expense);
});

// CREATE expense
router.post('/', async (req, res) => {
  try {
    const { amount, category, description, merchant, date, paymentMethod } = req.body;
    if (!amount || !category)
      return res.status(400).json({ error: 'Amount and category required' });

    const expense = await prisma.expense.create({
      data: {
        amount: parseFloat(amount),
        category: category.trim(),
        description: description?.trim(),
        merchant: merchant?.trim(),
        paymentMethod: paymentMethod || 'card',
        date: date ? new Date(date) : new Date(),
        userId: req.user.id
      }
    });
    res.status(201).json(expense);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// UPDATE expense
router.put('/:id', async (req, res) => {
  try {
    // Verify ownership
    const existing = await prisma.expense.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const { amount, category, description, merchant, date, paymentMethod } = req.body;
    const data = {};
    if (amount !== undefined) data.amount = parseFloat(amount);
    if (category !== undefined) data.category = category.trim();
    if (description !== undefined) data.description = description?.trim();
    if (merchant !== undefined) data.merchant = merchant?.trim();
    if (date !== undefined) data.date = new Date(date);
    if (paymentMethod !== undefined) data.paymentMethod = paymentMethod;

    const updated = await prisma.expense.update({
      where: { id: req.params.id },
      data
    });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// DELETE expense
router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.expense.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.expense.delete({ where: { id: req.params.id } });
    res.json({ success: true, deleted: req.params.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// DELETE multiple (by filter — for chatbot bulk delete)
router.delete('/', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids))
      return res.status(400).json({ error: 'ids array required' });
    const result = await prisma.expense.deleteMany({
      where: { id: { in: ids }, userId: req.user.id }
    });
    res.json({ success: true, count: result.count });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete expenses' });
  }
});

// ANALYTICS — monthly summary
router.get('/analytics/summary', async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [thisMonth, lastMonth, budgets] = await Promise.all([
      prisma.expense.findMany({
        where: { userId: req.user.id, date: { gte: startOfMonth } }
      }),
      prisma.expense.findMany({
        where: { userId: req.user.id, date: { gte: startOfLastMonth, lte: endOfLastMonth } }
      }),
      prisma.budget.findMany({
        where: { userId: req.user.id, month: now.getMonth() + 1, year: now.getFullYear() }
      })
    ]);

    const totalThis = thisMonth.reduce((s, e) => s + e.amount, 0);
    const totalLast = lastMonth.reduce((s, e) => s + e.amount, 0);

    const byCategory = thisMonth.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {});

    const lastByCategory = lastMonth.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {});

    const budgetMap = budgets.reduce((acc, b) => {
      acc[b.category] = b.amount;
      return acc;
    }, {});

    res.json({
      totalThis: Math.round(totalThis),
      totalLast: Math.round(totalLast),
      change: totalLast > 0 ? (((totalThis - totalLast) / totalLast) * 100).toFixed(1) : 0,
      count: thisMonth.length,
      byCategory,
      lastByCategory,
      budgetMap,
      month: now.toLocaleString('default', { month: 'long' }),
      year: now.getFullYear()
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Analytics failed' });
  }
});

// ANALYTICS — trend (last 6 months)
router.get('/analytics/trend', async (req, res) => {
  try {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const expenses = await prisma.expense.findMany({
        where: { userId: req.user.id, date: { gte: start, lte: end } }
      });
      const total = expenses.reduce((s, e) => s + e.amount, 0);
      months.push({
        month: d.toLocaleString('default', { month: 'short' }),
        total: Math.round(total),
        count: expenses.length
      });
    }
    res.json(months);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Trend analytics failed' });
  }
});

module.exports = router;
