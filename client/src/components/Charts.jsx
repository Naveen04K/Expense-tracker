import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend
} from 'recharts';

const COLORS = {
  Food: '#f59e0b',
  Transport: '#3b82f6',
  Bills: '#8b5cf6',
  Shopping: '#ec4899',
  Healthcare: '#10b981',
  Entertainment: '#f97316',
  Other: '#6b7280'
};

const DEFAULT_COLORS = ['#1a1a18', '#4a90e2', '#e25555', '#f5a623', '#7ed321', '#9013fe', '#50c8c6'];

const fmt = (v) => `₹${Number(v).toLocaleString('en-IN')}`;

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'white', border: '1px solid #e8e8e4',
        borderRadius: 8, padding: '8px 12px', fontSize: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
      }}>
        {label && <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>}
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color || '#1a1a18' }}>
            {p.name}: {fmt(p.value)}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function CategoryPieChart({ data }) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-faint)', fontSize: 13 }}>
        No data yet
      </div>
    );
  }

  const chartData = Object.entries(data).map(([name, value]) => ({
    name, value: Math.round(value)
  })).sort((a, b) => b.value - a.value);

  const getColor = (name, i) => COLORS[name] || DEFAULT_COLORS[i % DEFAULT_COLORS.length];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <PieChart width={160} height={160}>
        <Pie
          data={chartData} cx={76} cy={76}
          innerRadius={46} outerRadius={70}
          paddingAngle={2} dataKey="value"
        >
          {chartData.map((entry, i) => (
            <Cell key={i} fill={getColor(entry.name, i)} stroke="none" />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
      </PieChart>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {chartData.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: getColor(item.name, i)
            }} />
            <span style={{ flex: 1, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.name}
            </span>
            <span style={{ fontWeight: 500, color: 'var(--text)' }}>{fmt(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SpendingBarChart({ data }) {
  if (!data || Object.keys(data).length === 0) return null;

  const chartData = Object.entries(data)
    .map(([name, value]) => ({ name, amount: Math.round(value) }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ec" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b6b68' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#6b6b68' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="amount" name="Spent" radius={[4, 4, 0, 0]} fill="#1a1a18">
          {chartData.map((entry, i) => (
            <Cell key={i} fill={COLORS[entry.name] || DEFAULT_COLORS[i % DEFAULT_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendLineChart({ data }) {
  if (!data || data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ec" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b6b68' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#6b6b68' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
        <Tooltip content={<CustomTooltip />} />
        <Line type="monotone" dataKey="total" name="Total" stroke="#1a1a18" strokeWidth={2} dot={{ r: 4, fill: '#1a1a18' }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BudgetProgressBars({ budgetStatus }) {
  if (!budgetStatus || budgetStatus.length === 0) {
    return (
      <div style={{ color: 'var(--text-faint)', fontSize: 13, textAlign: 'center', padding: 20 }}>
        No budgets set. Ask the AI: "Set food budget to ₹5000"
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {budgetStatus.map((b, i) => {
        const pct = Math.min(b.percentage, 100);
        const over = b.percentage > 100;
        const warn = b.percentage > 80;
        const color = over ? 'var(--red)' : warn ? 'var(--amber)' : 'var(--green)';
        const bgColor = over ? 'var(--red-bg)' : warn ? 'var(--amber-bg)' : 'var(--green-bg)';

        return (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
              <span style={{ fontWeight: 500 }}>{b.category}</span>
              <span style={{ color: over ? 'var(--red)' : 'var(--text-muted)' }}>
                {fmt(b.spent)} / {fmt(b.budget)}
                {over && ' (over!)'}
              </span>
            </div>
            <div style={{ height: 8, background: 'var(--bg)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${pct}%`,
                background: color, borderRadius: 99,
                transition: 'width 0.5s ease'
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
