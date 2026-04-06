import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import ExpenseForm from '../components/ExpenseForm';

const CATEGORIES = ['All', 'Food', 'Transport', 'Bills', 'Shopping', 'Healthcare', 'Entertainment', 'Other'];

const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;

const getCategoryClass = (cat) => {
  const map = { Food: 'food', Transport: 'transport', Bills: 'bills', Shopping: 'shopping', Healthcare: 'healthcare', Entertainment: 'entertainment' };
  return `badge badge-${map[cat] || 'other'}`;
};

export default function History() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    category: '', search: '', startDate: '', endDate: '', sortBy: 'date', sortOrder: 'desc'
  });
  const [editExpense, setEditExpense] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.category && filters.category !== 'All') params.category = filters.category;
      if (filters.search) params.search = filters.search;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      params.sortBy = filters.sortBy;
      params.sortOrder = filters.sortOrder;
      params.limit = 100;

      const { data } = await api.get('/expenses', { params });
      setExpenses(data);
      setTotal(data.reduce((s, e) => s + e.amount, 0));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  const deleteExpense = async (id) => {
    if (!confirm('Delete this expense?')) return;
    await api.delete(`/expenses/${id}`);
    loadExpenses();
  };

  const exportCSV = () => {
    const header = ['Date', 'Category', 'Merchant', 'Description', 'Amount', 'Payment Method'];
    const rows = expenses.map(e => [
      new Date(e.date).toLocaleDateString('en-IN'),
      e.category, e.merchant || '', e.description || '',
      e.amount, e.paymentMethod || ''
    ]);
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `expenses_${Date.now()}.csv`; a.click();
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16
      }}>
        <Link to="/" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 13 }}>← Dashboard</Link>
        <span style={{ color: 'var(--border)' }}>|</span>
        <h1 style={{ fontSize: 16, fontWeight: 600 }}>All Expenses</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            onClick={exportCSV}
            style={{
              padding: '7px 14px', border: '1px solid var(--border)', borderRadius: 7,
              background: 'var(--surface)', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer'
            }}
          >
            Export CSV
          </button>
          <button
            onClick={() => { setEditExpense(null); setShowForm(true); }}
            style={{
              padding: '7px 14px', background: 'var(--accent)', color: '#fff',
              borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer'
            }}
          >
            + Add
          </button>
        </div>
      </div>

      <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
        {/* Filters */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 16,
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10
        }}>
          <input
            placeholder="Search merchant, description..."
            value={filters.search}
            onChange={e => setFilters({ ...filters, search: e.target.value })}
            style={{ fontSize: 13 }}
          />
          <select
            value={filters.category}
            onChange={e => setFilters({ ...filters, category: e.target.value })}
            style={{ fontSize: 13 }}
          >
            {CATEGORIES.map(c => <option key={c} value={c === 'All' ? '' : c}>{c}</option>)}
          </select>
          <input
            type="date" value={filters.startDate}
            onChange={e => setFilters({ ...filters, startDate: e.target.value })}
            style={{ fontSize: 13 }}
          />
          <input
            type="date" value={filters.endDate}
            onChange={e => setFilters({ ...filters, endDate: e.target.value })}
            style={{ fontSize: 13 }}
          />
          <select
            value={`${filters.sortBy}-${filters.sortOrder}`}
            onChange={e => {
              const [sortBy, sortOrder] = e.target.value.split('-');
              setFilters({ ...filters, sortBy, sortOrder });
            }}
            style={{ fontSize: 13 }}
          >
            <option value="date-desc">Date: Newest first</option>
            <option value="date-asc">Date: Oldest first</option>
            <option value="amount-desc">Amount: High to Low</option>
            <option value="amount-asc">Amount: Low to High</option>
          </select>
          <button
            onClick={() => setFilters({ category: '', search: '', startDate: '', endDate: '', sortBy: 'date', sortOrder: 'desc' })}
            style={{
              border: '1px solid var(--border)', borderRadius: 7,
              background: 'var(--bg)', fontSize: 12, color: 'var(--text-muted)',
              padding: '8px 12px', cursor: 'pointer'
            }}
          >
            Reset
          </button>
        </div>

        {/* Summary */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {loading ? 'Loading...' : `${expenses.length} expenses`}
          </span>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Total: {fmt(total)}</span>
        </div>

        {/* Table */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: 'var(--shadow)'
        }}>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '90px 100px 1fr 120px 90px 100px 90px',
            padding: '10px 16px', borderBottom: '1px solid var(--border)',
            fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.04em'
          }}>
            <span>Date</span>
            <span>Category</span>
            <span>Description</span>
            <span>Merchant</span>
            <span>Payment</span>
            <span style={{ textAlign: 'right' }}>Amount</span>
            <span style={{ textAlign: 'right' }}>Actions</span>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto' }} />
            </div>
          ) : expenses.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
              No expenses found for these filters
            </div>
          ) : (
            expenses.map((exp, i) => (
              <div
                key={exp.id}
                className="animate-fade"
                style={{
                  display: 'grid', gridTemplateColumns: '90px 100px 1fr 120px 90px 100px 90px',
                  padding: '11px 16px', alignItems: 'center',
                  borderBottom: i < expenses.length - 1 ? '1px solid var(--border)' : 'none',
                  fontSize: 13, transition: 'background 0.1s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  {new Date(exp.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
                <span><span className={getCategoryClass(exp.category)}>{exp.category}</span></span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                  {exp.description || '—'}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                  {exp.merchant || '—'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{exp.paymentMethod || '—'}</span>
                <span style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(exp.amount)}</span>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => { setEditExpense(exp); setShowForm(true); }}
                    style={{
                      padding: '3px 8px', background: 'var(--bg)', border: '1px solid var(--border)',
                      borderRadius: 5, fontSize: 11, cursor: 'pointer', color: 'var(--text-muted)'
                    }}
                  >Edit</button>
                  <button
                    onClick={() => deleteExpense(exp.id)}
                    style={{
                      padding: '3px 8px', background: 'var(--red-bg)', border: '1px solid #fecaca',
                      borderRadius: 5, fontSize: 11, cursor: 'pointer', color: 'var(--red)'
                    }}
                  >Del</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showForm && (
        <ExpenseForm
          expense={editExpense}
          onSave={loadExpenses}
          onClose={() => { setShowForm(false); setEditExpense(null); }}
        />
      )}
    </div>
  );
}
