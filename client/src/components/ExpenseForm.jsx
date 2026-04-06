import { useState, useEffect } from 'react';
import api from '../api';

const CATEGORIES = ['Food', 'Transport', 'Bills', 'Shopping', 'Healthcare', 'Entertainment', 'Other'];
const PAYMENT_METHODS = ['card', 'upi', 'cash', 'netbanking'];

export default function ExpenseForm({ expense, onSave, onClose }) {
  const isEdit = !!expense?.id;
  const [form, setForm] = useState({
    amount: '',
    category: 'Food',
    description: '',
    merchant: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'card'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (expense) {
      setForm({
        amount: expense.amount || '',
        category: expense.category || 'Food',
        description: expense.description || '',
        merchant: expense.merchant || '',
        date: expense.date ? expense.date.split('T')[0] : new Date().toISOString().split('T')[0],
        paymentMethod: expense.paymentMethod || 'card'
      });
    }
  }, [expense]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.amount || isNaN(form.amount) || parseFloat(form.amount) <= 0) {
      return setError('Enter a valid amount');
    }
    setLoading(true);
    setError('');
    try {
      if (isEdit) {
        await api.put(`/expenses/${expense.id}`, form);
      } else {
        await api.post('/expenses', form);
      }
      onSave?.();
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16
    }} onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="animate-fade" style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
        padding: 24, width: '100%', maxWidth: 440,
        boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600 }}>{isEdit ? 'Edit Expense' : 'Add Expense'}</h2>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg)', border: '1px solid var(--border)',
              width: 30, height: 30, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: 'var(--text-muted)'
            }}
          >×</button>
        </div>

        {error && (
          <div style={{
            background: 'var(--red-bg)', color: 'var(--red)',
            border: '1px solid #fecaca', borderRadius: 'var(--radius-sm)',
            padding: '9px 12px', fontSize: 13, marginBottom: 14
          }}>{error}</div>
        )}

        <form onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                Amount (₹) *
              </label>
              <input
                type="number" required step="0.01" min="0.01"
                placeholder="0.00" value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
                style={{ fontSize: 20, fontWeight: 600, padding: '10px 12px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                Category *
              </label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                Date
              </label>
              <input
                type="date" value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                Merchant
              </label>
              <input
                type="text" placeholder="Zomato, Amazon..."
                value={form.merchant}
                onChange={e => setForm({ ...form, merchant: e.target.value })}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                Payment Method
              </label>
              <select value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })}>
                {PAYMENT_METHODS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                Description
              </label>
              <input
                type="text" placeholder="What did you buy?"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button
              type="button" onClick={onClose}
              style={{
                flex: 1, padding: '10px', background: 'var(--bg)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                fontSize: 14, color: 'var(--text-muted)'
              }}
            >
              Cancel
            </button>
            <button
              type="submit" disabled={loading}
              style={{
                flex: 1, padding: '10px',
                background: loading ? 'var(--text-faint)' : 'var(--accent)',
                color: '#fff', borderRadius: 'var(--radius-sm)',
                fontSize: 14, fontWeight: 500,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
              }}
            >
              {loading
                ? <><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />Saving...</>
                : isEdit ? 'Save Changes' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
