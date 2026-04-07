import { useNavigate } from 'react-router-dom';
import { BrainCircuit } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import Skeleton, { SkeletonCard } from '../components/Skeleton';
import ErrorState from '../components/ErrorState';

export default function AIReport() {
  const navigate  = useNavigate();
  const { data: report,  loading: rLoading, error: rError, refetch } = useApi('/ai/report');
  const { data: score } = useApi('/ai/score');
  const { data: recs }  = useApi('/ai/suggestions');

  const scoreNum  = score?.score ?? 0;
  const scorePerc = scoreNum / 100;
  const R         = 54;
  const circ      = 2 * Math.PI * R;
  const dash      = scorePerc * circ;
  const color     = scoreNum >= 80 ? 'var(--success)' : scoreNum >= 50 ? 'var(--warning)' : 'var(--error)';

  return (
    <div className="page animate-fade-up">
      <header style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '4px' }}>
          <div className="ai-icon-wrap" style={{ width: 36, height: 36 }}><BrainCircuit size={18} /></div>
          <h1 style={{ fontSize: '1.75rem' }}>AI Report</h1>
        </div>
        <p className="text-muted">Powered by financial intelligence</p>
      </header>

      {rError && <ErrorState message={rError} onRetry={refetch} />}

      {/* Score ring */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '2rem', background: 'linear-gradient(135deg, rgba(232,164,0,0.06), rgba(240,124,58,0.04))', flexWrap: 'wrap' }}>
        {rLoading ? <Skeleton width={128} height={128} radius="50%" /> : (
          <div style={{ position: 'relative', width: 128, height: 128, flexShrink: 0 }}>
            <svg width={128} height={128} viewBox="0 0 128 128">
              <circle cx={64} cy={64} r={R} fill="none" stroke="var(--surface-low)" strokeWidth={14} />
              <circle cx={64} cy={64} r={R} fill="none" stroke={color} strokeWidth={14}
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={circ / 4}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '2rem', fontWeight: 900, color }}>{scoreNum}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--on-surface-muted)', fontWeight: 500 }}>/ 100</span>
            </div>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 160 }}>
          <h2 style={{ fontSize: '1.375rem', marginBottom: 6 }}>
            {scoreNum >= 80 ? 'Excellent Splitter! 🌟' : scoreNum >= 60 ? 'Good Progress! 👍' : 'Needs Attention 📊'}
          </h2>
          <p className="text-muted" style={{ lineHeight: 1.6 }}>
            {score?.summary || 'Your AI-powered expense efficiency score based on split history and settlement speed.'}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <span className="badge badge-primary">{score?.trend_label || 'Trend: Stable'}</span>
            {score?.badge_tag && <span className="badge badge-success">{score.badge_tag}</span>}
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      {rLoading ? (
        <div className="desktop-grid-2" style={{ marginBottom: '2rem' }}>
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      ) : report?.categories && (
        <div style={{ marginBottom: '2rem' }}>
          <div className="section-header"><h3>Category Analysis</h3></div>
          <div className="desktop-grid-2">
            {report.categories.map((cat, i) => (
              <div key={i} className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '1.75rem' }}>{cat.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700 }}>{cat.name}</p>
                    <p className="text-muted" style={{ fontSize: '0.8125rem' }}>₹{cat.amount.toLocaleString('en-IN')} · {cat.pct}% of spend</p>
                  </div>
                  <span className={`badge ${cat.status === 'good' ? 'badge-success' : cat.status === 'warn' ? 'badge-warning' : 'badge-error'}`}>
                    {cat.status === 'good' ? '↓ Below avg' : cat.status === 'warn' ? '→ Avg' : '↑ Above avg'}
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${Math.min(100, cat.pct)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Recommendations */}
      {recs?.length > 0 && (
        <div>
          <div className="section-header" style={{ marginBottom: '1rem' }}><h3>Recommendations</h3></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {recs.map((r, i) => (
              <div key={i} className="ai-card">
                <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
                  <div className="ai-icon-wrap" style={{ width: 34, height: 34, flexShrink: 0 }}>
                    <BrainCircuit size={16} />
                  </div>
                  <div>
                    {r.title && <p style={{ fontWeight: 700, marginBottom: '4px', color: 'var(--primary)' }}>{r.title}</p>}
                    <p style={{ fontSize: '0.9rem', lineHeight: 1.65, color: 'var(--on-surface)' }}>{r.message}</p>
                    {r.action && (
                      <button className="btn btn-secondary btn-sm" style={{ marginTop: '0.625rem' }}>
                        {r.action}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
