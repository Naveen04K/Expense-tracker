import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import ChatPanel from '../components/ChatPanel';
import ExpenseForm from '../components/ExpenseForm';
import { CategoryPieChart, SpendingBarChart, TrendLineChart, BudgetProgressBars } from '../components/Charts';

const getCategoryClass = (cat) => {
  const map = { Food: 'food', Transport: 'transport', Bills: 'bills', Shopping: 'shopping', Healthcare: 'healthcare', Entertainment: 'entertainment' };
  return `badge badge-${map[cat] || 'other'}`;
};

const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;

export default function Dashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [trend, setTrend] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const loadData = useCallback(async () => {
    try {
      const [anaRes, trendRes, expRes] = await Promise.all([
        api.get('/expenses/analytics/summary'),
        api.get('/expenses/analytics/trend'),
        api.get('/expenses?limit=8')
      ]);
      setAnalytics(anaRes.data);
      setTrend(trendRes.data);
      setExpenses(expRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const deleteExpense = async (id) => {
    if (!confirm('Delete this expense?')) return;
    await api.delete(`/expenses/${id}`);
    loadData();
  };

  const exportToCSV = async () => {
    try {
      const { data } = await api.get('/expenses?limit=10000');
      if (!data || data.length === 0) return alert('No data to export');
      const header = ['Date', 'Amount', 'Category', 'Merchant', 'Description', 'Payment Method'].join(',');
      const rows = data.map(exp => [
        new Date(exp.date).toLocaleDateString(),
        exp.amount,
        exp.category,
        `"${(exp.merchant || '').replace(/"/g, '""')}"`,
        `"${(exp.description || '').replace(/"/g, '""')}"`,
        exp.paymentMethod || ''
      ].join(','));
      const csvString = [header, ...rows].join('\n');
      const blob = new Blob([csvString], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('href', url);
      a.setAttribute('download', `nebula_expenses_${new Date().toISOString().split('T')[0]}.csv`);
      a.click();
    } catch(e) {
      alert('Error exporting data');
    }
  };

  const logout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: 28, height: 28, margin: '0 auto 12px' }} />
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Loading your dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Left sidebar nav */}
      <div style={{
        width: 220, borderRight: '1px solid var(--border)',
        background: 'var(--surface)', display: 'flex', flexDirection: 'column',
        padding: '20px 12px', flexShrink: 0
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px 20px', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>💸</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Nebula</div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Expense Tracker</div>
          </div>
        </div>

        {/* Nav links */}
        {[
          { id: 'overview', label: 'Overview', icon: '📊' },
          { id: 'budgets', label: 'Budgets', icon: '🎯' },
          { id: 'trends', label: 'Trends', icon: '📈' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 8, border: 'none',
              background: activeTab === tab.id ? 'var(--bg)' : 'transparent',
              color: activeTab === tab.id ? 'var(--text)' : 'var(--text-muted)',
              fontSize: 13, fontWeight: activeTab === tab.id ? 500 : 400,
              cursor: 'pointer', textAlign: 'left', width: '100%', marginBottom: 2
            }}
          >
            <span>{tab.icon}</span>{tab.label}
          </button>
        ))}

        <Link
          to="/history"
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 12px', borderRadius: 8,
            color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none', marginBottom: 2
          }}
        >
          <span>📋</span>All Expenses
        </Link>

        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div style={{ padding: '0 8px', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{user.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}>{user.email}</div>
          </div>
          <button
            onClick={logout}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 8,
              background: 'none', border: '1px solid var(--border)',
              color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer'
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <div style={{
          padding: '16px 24px', borderBottom: '1px solid var(--border)',
          background: 'var(--surface)', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexShrink: 0
        }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 600 }}>
              {activeTab === 'overview' && `${analytics?.month} ${analytics?.year} Overview`}
              {activeTab === 'budgets' && 'Budget Tracker'}
              {activeTab === 'trends' && '6-Month Spending Trend'}
            </h1>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              {activeTab === 'overview' && `${analytics?.count || 0} transactions this month`}
              {activeTab === 'budgets' && 'Monthly category budget progress'}
              {activeTab === 'trends' && 'Track your spending over time'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {activeTab === 'overview' && (
              <button
                onClick={exportToCSV}
                style={{
                  padding: '8px 16px', background: 'var(--bg)', color: 'var(--text)',
                  border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 500,
                  display: 'flex', alignItems: 'center', gap: 6, transition: '0.2s'
                }}
              >
                📥 Export CSV
              </button>
            )}
            <button
              onClick={() => { setEditExpense(null); setShowForm(true); }}
              style={{
                padding: '8px 16px', background: 'var(--accent)', color: '#fff',
                borderRadius: 8, fontSize: 13, fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              + Add Expense
            </button>
          </div>
        </div>

        <div style={{ padding: 24, flex: 1 }}>
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
                {[
                  {
                    label: 'Total This Month',
                    value: fmt(analytics?.totalThis),
                    sub: analytics?.change
                      ? `${analytics.change > 0 ? '▲' : '▼'} ${Math.abs(analytics.change)}% vs last month`
                      : 'No prior data',
                    color: analytics?.change > 0 ? 'var(--red)' : 'var(--green)'
                  },
                  { label: 'Last Month', value: fmt(analytics?.totalLast), sub: 'Previous month total' },
                  { label: 'Transactions', value: analytics?.count || 0, sub: 'This month' },
                ].map((stat, i) => (
                  <div key={i} style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)', padding: '16px 18px',
                    boxShadow: 'var(--shadow)'
                  }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{stat.label}</div>
                    <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.5px' }}>{stat.value}</div>
                    <div style={{ fontSize: 11, color: stat.color || 'var(--text-faint)', marginTop: 4 }}>{stat.sub}</div>
                  </div>
                ))}
              </div>

              {/* Charts row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', padding: '16px 18px', boxShadow: 'var(--shadow)'
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Spending by Category</div>
                  <CategoryPieChart data={analytics?.byCategory} />
                </div>
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', padding: '16px 18px', boxShadow: 'var(--shadow)'
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Category Breakdown</div>
                  <SpendingBarChart data={analytics?.byCategory} />
                </div>
              </div>

              {/* Recent expenses */}
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)'
              }}>
                <div style={{
                  padding: '14px 18px', borderBottom: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Recent Expenses</span>
                  <Link to="/history" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}>
                    View all →
                  </Link>
                </div>
                {expenses.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
                    No expenses yet. Add one or ask the AI!
                  </div>
                ) : (
                  expenses.map((exp, i) => (
                    <div
                      key={exp.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 18px',
                        borderBottom: i < expenses.length - 1 ? '1px solid var(--border)' : 'none'
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: 9, background: 'var(--bg)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0
                      }}>
                        {{ Food: '🍽', Transport: '🚗', Bills: '🏠', Shopping: '🛍', Healthcare: '💊', Entertainment: '🎬' }[exp.category] || '💰'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{exp.merchant || exp.description || exp.category}</span>
                          <span className={getCategoryClass(exp.category)}>{exp.category}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                          {new Date(exp.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          {exp.paymentMethod && ` · ${exp.paymentMethod}`}
                        </div>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{fmt(exp.amount)}</div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => { setEditExpense(exp); setShowForm(true); }}
                          style={{
                            padding: '4px 10px', background: 'var(--bg)', border: '1px solid var(--border)',
                            borderRadius: 6, fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer'
                          }}
                        >Edit</button>
                        <button
                          onClick={() => deleteExpense(exp.id)}
                          style={{
                            padding: '4px 10px', background: 'var(--red-bg)', border: '1px solid #fecaca',
                            borderRadius: 6, fontSize: 11, color: 'var(--red)', cursor: 'pointer'
                          }}
                        >Del</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* BUDGETS TAB */}
          {activeTab === 'budgets' && (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '20px 24px', boxShadow: 'var(--shadow)',
              maxWidth: 560
            }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Set budgets by asking the AI: <em>"Set food budget to ₹5000"</em> or <em>"Set transport budget to ₹2000"</em>
                </div>
              </div>
              <BudgetProgressBars budgetStatus={analytics?.budgetStatus} />
            </div>
          )}

          {/* TRENDS TAB */}
          {activeTab === 'trends' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '16px 18px', boxShadow: 'var(--shadow)'
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Monthly Spending (6 months)</div>
                <TrendLineChart data={trend} />
              </div>
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '16px 18px', boxShadow: 'var(--shadow)'
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Month Comparison</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { label: 'This Month', value: fmt(analytics?.totalThis), color: 'var(--accent)' },
                    { label: 'Last Month', value: fmt(analytics?.totalLast), color: 'var(--text-muted)' }
                  ].map((item, i) => (
                    <div key={i} style={{ background: 'var(--bg)', borderRadius: 8, padding: '14px 16px' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{item.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 600, color: item.color }}>{item.value}</div>
                    </div>
                  ))}
                </div>
                {analytics?.change && (
                  <div style={{
                    marginTop: 14, padding: '10px 14px',
                    background: analytics.change > 0 ? 'var(--red-bg)' : 'var(--green-bg)',
                    borderRadius: 8, fontSize: 13,
                    color: analytics.change > 0 ? 'var(--red)' : 'var(--green)'
                  }}>
                    {analytics.change > 0 ? '▲' : '▼'} {Math.abs(analytics.change)}% {analytics.change > 0 ? 'increase' : 'decrease'} compared to last month
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right chat panel */}
      <div style={{
        width: 340, borderLeft: '1px solid var(--border)',
        padding: 16, display: 'flex', flexDirection: 'column',
        background: 'var(--surface)', flexShrink: 0
      }}>
        <ChatPanel onExpenseChange={loadData} />
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <ExpenseForm
          expense={editExpense}
          onSave={loadData}
          onClose={() => { setShowForm(false); setEditExpense(null); }}
        />
      )}
    </div>
  );
}
