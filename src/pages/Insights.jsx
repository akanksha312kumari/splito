import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import Skeleton, { SkeletonCard } from '../components/Skeleton';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

const PERIODS = ['week', 'month', 'year'];
const PERIOD_LABELS = { week: 'Week', month: 'Month', year: 'Year' };

const SLICE_COLORS = ['#e8a400', '#f07c3a', '#2daa6e', '#f59e0b', '#ef4444', '#06b6d4', '#f97316'];

export default function Insights() {
  const [period, setPeriod] = useState('week');
  const { data, loading, error, refetch } = useApi(`/insights/breakdown?period=${period}`, [period]);
  const { data: settings } = useApi('/settings');

  const aiEnabled = settings?.ai_enabled !== false;

  const slices   = data?.categories || [];
  const total    = slices.reduce((s, c) => s + c.amount, 0);
  const trend    = data?.trend || [];
  const maxBar   = Math.max(...trend.map(t => t.amount), 1);

  // SVG donut
  const R = 80, CX = 90, CY = 90;
  const circ = 2 * Math.PI * R;
  let cumulDash = 0;
  const donutSlices = slices.map((cat, i) => {
    const frac    = total > 0 ? cat.amount / total : 0;
    const dashLen = frac * circ;
    const offset  = circ - cumulDash;
    cumulDash    += dashLen;
    return { ...cat, dashLen, offset, color: SLICE_COLORS[i % SLICE_COLORS.length] };
  });

  return (
    <div className="page animate-fade-up">
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '4px' }}>Insights</h1>
        <p className="text-muted">Your personal spending analytics</p>
      </header>

      {/* Period toggle */}
      <div className="pill-toggle" style={{ marginBottom: '2rem', maxWidth: 300 }}>
        {PERIODS.map(p => (
          <button key={p} className={`pill-option ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {loading && (
        <div className="desktop-grid-2">
          <SkeletonCard lines={4} style={{ minHeight: 260 }} />
          <SkeletonCard lines={4} style={{ minHeight: 260 }} />
        </div>
      )}

      {error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && !error && (
        <>
          <div className="desktop-grid-2" style={{ marginBottom: '2rem' }}>
            {/* Donut chart */}
            <div className="card">
              <h3 style={{ marginBottom: '1.5rem' }}>Spending by Category</h3>
              {total === 0 ? (
                <EmptyState icon="📊" title="No spending data" subtitle={`No expenses recorded this ${period}.`} />
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                    <svg width={180} height={180} viewBox="0 0 180 180">
                      <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--surface-low)" strokeWidth={24} />
                      {donutSlices.map((s, i) => (
                        <circle key={i} cx={CX} cy={CY} r={R}
                          fill="none" stroke={s.color} strokeWidth={24}
                          strokeDasharray={`${s.dashLen} ${circ - s.dashLen}`}
                          strokeDashoffset={s.offset}
                          transform={`rotate(-90 ${CX} ${CY})`}
                          style={{ transition: 'stroke-dasharray 0.6s ease' }}
                        />
                      ))}
                      <text x={CX} y={CY - 6} textAnchor="middle" fontSize={18} fontWeight={800} fill="var(--on-surface)" fontFamily="Inter">
                        ₹{(total / 1000).toFixed(1)}k
                      </text>
                      <text x={CX} y={CY + 14} textAnchor="middle" fontSize={11} fill="var(--on-surface-muted)" fontFamily="Inter">total</text>
                    </svg>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                    {donutSlices.map((s, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 500 }}>{capitalize(s.category)}</span>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--on-surface-muted)' }}>{total > 0 ? ((s.amount / total) * 100).toFixed(1) : 0}%</span>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>₹{s.amount.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Bar trend chart */}
            <div className="card">
              <h3 style={{ marginBottom: '1.25rem' }}>Spending Trend</h3>
              {trend.length === 0 ? (
                <EmptyState icon="📈" title="No trend data" subtitle="Spend across multiple days to see a trend." />
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: 140, paddingBottom: '1.25rem', position: 'relative' }}>
                  {trend.map((t, i) => {
                    const pct = maxBar > 0 ? (t.amount / maxBar) * 100 : 0;
                    const isTop = Math.max(...trend.map(x => x.amount)) === t.amount;
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
                        <div
                          title={`₹${t.amount.toLocaleString('en-IN')}`}
                          style={{
                            width: '100%', borderRadius: '6px 6px 0 0',
                            height: pct + '%',
                            background: isTop
                              ? 'linear-gradient(to top, var(--primary), var(--secondary))'
                              : 'var(--surface-high)',
                            transition: 'height 0.6s ease',
                            minHeight: pct > 0 ? 4 : 0,
                          }}
                        />
                        <span style={{ fontSize: '0.6875rem', color: 'var(--on-surface-muted)', textAlign: 'center', lineHeight: 1 }}>
                          {period === 'year' ? t.label?.slice(0,3) : t.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Top categories summary row */}
          {slices.length > 0 && (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
                {slices.slice(0, 4).map((s, i) => (
                  <div key={i} style={{ textAlign: 'center', padding: '0.625rem', background: 'var(--surface-low)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: SLICE_COLORS[i], margin: '0 auto 6px' }} />
                    <p style={{ fontWeight: 700, fontSize: '1rem' }}>₹{(s.amount / 1000).toFixed(1)}k</p>
                    <p className="text-muted" style={{ fontSize: '0.6875rem' }}>{capitalize(s.category)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI comparison text */}
          {aiEnabled ? (
            data?.comparison && (
              <div className="ai-card">
                <p style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '6px' }}>📊 AI Comparison</p>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--on-surface)' }}>{data.comparison}</p>
              </div>
            )
          ) : (
            <div className="ai-card" style={{ opacity: 0.7, border: '1.5px dashed var(--surface-mid)', background: 'transparent' }}>
              <p className="text-muted" style={{ fontSize: '0.9rem', textAlign: 'center', margin: '0.5rem 0' }}>
                💡 Enable **Smart spending insights** in your profile to see periodic comparisons and AI tips.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }
