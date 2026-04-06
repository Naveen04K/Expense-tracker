const { PrismaClient } = require('@prisma/client');
const { SchemaType } = require('@google/generative-ai');
const prisma = new PrismaClient();

// ──────────────────────────────────────────────
// Tool definitions for Gemini API
// ──────────────────────────────────────────────
const toolDefinitions = [
  {
    name: 'create_expense',
    description: 'Create one or more new expense records in the database. Use this whenever the user mentions spending money, buying something, or paying for something.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        expenses: {
          type: SchemaType.ARRAY,
          description: 'Array of expenses to create (can be just one)',
          items: {
            type: SchemaType.OBJECT,
            properties: {
              amount:        { type: SchemaType.NUMBER,  description: 'Amount spent in rupees' },
              category:      { type: SchemaType.STRING,  description: 'One of: Food, Transport, Bills, Shopping, Healthcare, Entertainment, Other' },
              description:   { type: SchemaType.STRING,  description: 'Brief description of what was bought' },
              merchant:      { type: SchemaType.STRING,  description: 'Store, app, or merchant name if mentioned' },
              date:          { type: SchemaType.STRING,  description: 'ISO date string (YYYY-MM-DD). Use today if not specified.' },
              paymentMethod: { type: SchemaType.STRING,  description: 'cash, card, upi, or netbanking' }
            },
            required: ['amount', 'category']
          }
        }
      },
      required: ['expenses']
    }
  },
  {
    name: 'get_expenses',
    description: 'Query and retrieve expenses from the database. Use for read requests, questions about spending, and before updating/deleting.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        category:      { type: SchemaType.STRING,  description: 'Filter by category name (partial match ok)' },
        startDate:     { type: SchemaType.STRING,  description: 'Start date ISO string' },
        endDate:       { type: SchemaType.STRING,  description: 'End date ISO string' },
        limit:         { type: SchemaType.NUMBER,  description: 'Max number of results. Default 10.' },
        search:        { type: SchemaType.STRING,  description: 'Search in description or merchant name' },
        sortBy:        { type: SchemaType.STRING,  description: 'date or amount' },
        sortOrder:     { type: SchemaType.STRING,  description: 'asc or desc' }
      }
    }
  },
  {
    name: 'update_expense',
    description: 'Update an existing expense by its ID. First use get_expenses to find the correct ID.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        id:            { type: SchemaType.STRING,  description: 'The expense ID from get_expenses' },
        amount:        { type: SchemaType.NUMBER },
        category:      { type: SchemaType.STRING },
        description:   { type: SchemaType.STRING },
        merchant:      { type: SchemaType.STRING },
        date:          { type: SchemaType.STRING,  description: 'ISO date string' },
        paymentMethod: { type: SchemaType.STRING }
      },
      required: ['id']
    }
  },
  {
    name: 'delete_expense',
    description: 'Delete one or more expenses by their IDs. For bulk delete, pass multiple IDs.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        ids:     { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: 'Array of expense IDs to delete' },
        confirm: { type: SchemaType.BOOLEAN, description: 'Must be true to proceed with deletion' }
      },
      required: ['ids', 'confirm']
    }
  },
  {
    name: 'get_analytics',
    description: 'Get spending analytics, summaries, budget status, and comparisons.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        type: {
          type: SchemaType.STRING,
          enum: ['monthly_summary', 'category_breakdown', 'top_expenses', 'monthly_comparison', 'budget_status', 'trend'],
          description: 'Type of analytics to retrieve'
        },
        month:  { type: SchemaType.NUMBER, description: '1-12, defaults to current month' },
        year:   { type: SchemaType.NUMBER, description: 'defaults to current year' }
      },
      required: ['type']
    }
  },
  {
    name: 'set_budget',
    description: 'Set or update a monthly budget for a category.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        category: { type: SchemaType.STRING, description: 'Budget category name' },
        amount:   { type: SchemaType.NUMBER, description: 'Monthly budget limit in rupees' }
      },
      required: ['category', 'amount']
    }
  }
];

// ──────────────────────────────────────────────
// Tool executor — runs on server with userId context
// ──────────────────────────────────────────────
async function executeTool(toolName, input, userId) {
  const now = new Date();

  if (toolName === 'create_expense') {
    const created = [];
    for (const e of input.expenses) {
      const expense = await prisma.expense.create({
        data: {
          amount: parseFloat(e.amount),
          category: e.category,
          description: e.description || null,
          merchant: e.merchant || null,
          paymentMethod: e.paymentMethod || 'card',
          date: e.date ? new Date(e.date) : new Date(),
          userId
        }
      });
      created.push(expense);
    }
    return { created, count: created.length };
  }

  if (toolName === 'get_expenses') {
    const where = { userId };
    if (input.category) where.category = { contains: input.category, mode: 'insensitive' };
    if (input.search) {
      where.OR = [
        { description: { contains: input.search, mode: 'insensitive' } },
        { merchant: { contains: input.search, mode: 'insensitive' } }
      ];
    }
    if (input.startDate || input.endDate) {
      where.date = {};
      if (input.startDate) where.date.gte = new Date(input.startDate);
      if (input.endDate) where.date.lte = new Date(input.endDate);
    }
    const orderBy = {};
    orderBy[input.sortBy || 'date'] = input.sortOrder || 'desc';
    const expenses = await prisma.expense.findMany({
      where, orderBy, take: input.limit || 10
    });
    return { expenses, count: expenses.length };
  }

  if (toolName === 'update_expense') {
    const { id, ...data } = input;
    if (data.amount) data.amount = parseFloat(data.amount);
    if (data.date) data.date = new Date(data.date);
    const expense = await prisma.expense.updateMany({
      where: { id, userId },
      data
    });
    const updated = await prisma.expense.findUnique({ where: { id } });
    return { updated, success: true };
  }

  if (toolName === 'delete_expense') {
    if (!input.confirm) return { error: 'Deletion not confirmed', success: false };
    const result = await prisma.expense.deleteMany({
      where: { id: { in: input.ids }, userId }
    });
    return { deleted: result.count, success: true };
  }

  if (toolName === 'get_analytics') {
    const month = input.month || now.getMonth() + 1;
    const year = input.year || now.getFullYear();
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);
    const startOfLastMonth = new Date(year, month - 2, 1);
    const endOfLastMonth = new Date(year, month - 1, 0, 23, 59, 59);

    if (input.type === 'monthly_summary' || input.type === 'category_breakdown' || input.type === 'budget_status') {
      const [expenses, budgets] = await Promise.all([
        prisma.expense.findMany({ where: { userId, date: { gte: startOfMonth, lte: endOfMonth } } }),
        prisma.budget.findMany({ where: { userId, month, year } })
      ]);
      const total = expenses.reduce((s, e) => s + e.amount, 0);
      const byCategory = expenses.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.amount;
        return acc;
      }, {});
      const budgetMap = budgets.reduce((acc, b) => { acc[b.category] = b.amount; return acc; }, {});
      const budgetStatus = Object.keys(budgetMap).map(cat => ({
        category: cat, spent: Math.round(byCategory[cat] || 0), budget: budgetMap[cat],
        remaining: Math.round(budgetMap[cat] - (byCategory[cat] || 0)),
        percentage: Math.round(((byCategory[cat] || 0) / budgetMap[cat]) * 100)
      }));
      return { total: Math.round(total), byCategory, budgetStatus, count: expenses.length };
    }

    if (input.type === 'top_expenses') {
      const expenses = await prisma.expense.findMany({
        where: { userId, date: { gte: startOfMonth, lte: endOfMonth } },
        orderBy: { amount: 'desc' }, take: 5
      });
      return { expenses };
    }

    if (input.type === 'monthly_comparison') {
      const [thisMonth, lastMonth] = await Promise.all([
        prisma.expense.findMany({ where: { userId, date: { gte: startOfMonth, lte: endOfMonth } } }),
        prisma.expense.findMany({ where: { userId, date: { gte: startOfLastMonth, lte: endOfLastMonth } } })
      ]);
      const totalThis = thisMonth.reduce((s, e) => s + e.amount, 0);
      const totalLast = lastMonth.reduce((s, e) => s + e.amount, 0);
      const catThis = thisMonth.reduce((acc, e) => { acc[e.category] = (acc[e.category]||0)+e.amount; return acc; }, {});
      const catLast = lastMonth.reduce((acc, e) => { acc[e.category] = (acc[e.category]||0)+e.amount; return acc; }, {});
      return {
        thisMonth: Math.round(totalThis), lastMonth: Math.round(totalLast),
        change: totalLast > 0 ? (((totalThis - totalLast) / totalLast) * 100).toFixed(1) : 0,
        byCategory: { thisMonth: catThis, lastMonth: catLast }
      };
    }

    if (input.type === 'trend') {
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
        const expenses = await prisma.expense.findMany({ where: { userId, date: { gte: start, lte: end } } });
        const total = expenses.reduce((s, e) => s + e.amount, 0);
        months.push({ month: d.toLocaleString('default', { month: 'short' }), total: Math.round(total) });
      }
      return { trend: months };
    }
  }

  if (toolName === 'set_budget') {
    const budget = await prisma.budget.upsert({
      where: {
        userId_category_month_year: {
          userId, category: input.category,
          month: now.getMonth() + 1, year: now.getFullYear()
        }
      },
      update: { amount: parseFloat(input.amount) },
      create: {
        category: input.category, amount: parseFloat(input.amount),
        month: now.getMonth() + 1, year: now.getFullYear(), userId
      }
    });
    return { budget, success: true };
  }

  return { error: 'Unknown tool' };
}

module.exports = { toolDefinitions, executeTool };
