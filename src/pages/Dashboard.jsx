import { useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Sparkles, ChevronRight } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Skeleton, { SkeletonCard } from '../components/Skeleton';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

export default function Dashboard() {
  const navigate      = useNavigate();
  const location      = useLocation();
  const { user }      = useAuth();
  const toast         = useToast();

  const { data: summary, loading: sumLoading, error: sumError, refetch: refetchSum } = useApi('/insights/summary', [], 'balance_update');
  const { data: groups,  loading: grpLoading, error: grpError,  refetch: refetchGrp } = useApi('/groups', [], 'balance_update');
  const { data: expenses } = useApi('/expenses?limit=5', [], 'balance_update');
  const { data: settings } = useApi('/settings');
  const { data: aiSug }    = useApi('/ai/suggestions', [], 'balance_update');
  const { data: scoreData } = useApi('/ai/score', [], 'balance_update');

  const aiEnabled = settings?.ai_enabled !== false;

  // Show success toast when redirected from AddExpense
  useEffect(() => {
    if (location.state?.expenseAdded) {
      toast.success('Expense added successfully! 🎉');
      window.history.replaceState({}, '');
    }
  }, []);

  const firstSuggestion = aiSug?.[0];
  const greeting = getGreeting();

  return (
    <div className="page animate-fade-up">
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '2px' }}>{greeting},</p>
          <h1 style={{ fontSize: '1.75rem' }}>{user?.name || 'You'} 👋</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {aiEnabled && (
            <button className="card card-clickable" onClick={() => navigate('/ai-report')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1rem', borderRadius: 999 }}>
              <Sparkles size={16} color="var(--primary)" />
              <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                {scoreData ? scoreData.score : <Skeleton width={24} height={16} />}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--on-surface-muted)' }}>score</span>
            </button>
          )}
          {/* Quick Add Expense Button */}
          <Link to="/add-expense" className="btn btn-primary" style={{ borderRadius: 999, padding: '0.625rem 1rem', textDecoration: 'none' }}>
            + Add Expense
          </Link>
        </div>
      </header>

      {/* Balance hero + AI insight */}
      <div className="desktop-grid-2" style={{ marginBottom: '1.5rem' }}>
        {sumLoading ? (
          <SkeletonCard lines={3} style={{ minHeight: 180 }} />
        ) : sumError ? (
          <ErrorState message={sumError} onRetry={refetchSum} />
        ) : (
          <div style={{ borderRadius: 'var(--radius-xl)', padding: '2rem', background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)', color: 'white', boxShadow: '0 12px 40px rgba(232,164,0,0.35)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
            <p style={{ fontSize: '0.875rem', opacity: 0.8, marginBottom: '0.5rem' }}>Total you're owed</p>
            <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 3.5rem)', color: 'white', marginBottom: '2rem' }}>
              ₹{(summary?.owed_to_me ?? 0).toLocaleString('en-IN')}
            </h1>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '1.25rem' }}>
              <div>
                <p style={{ fontSize: '0.75rem', opacity: 0.75, marginBottom: '2px' }}>You owe</p>
                <p style={{ fontSize: '1.125rem', fontWeight: 700 }}>₹{(summary?.i_owe ?? 0).toLocaleString('en-IN')}</p>
              </div>
              <button className="btn" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)', fontSize: '0.875rem' }} onClick={() => {
                if (groups && groups.length > 0) {
                  const oweGroups = groups.filter(g => g.net_balance < 0).sort((a,b) => a.net_balance - b.net_balance);
                  const targetGrp = oweGroups.length > 0 ? oweGroups[0] : groups[0];
                  navigate(`/settlement?group=${targetGrp.id}`);
                } else {
                  navigate('/group');
                }
              }}>
                Settle Up →
              </button>
            </div>
          </div>
        )}

        {/* AI Insight card */}
        {aiEnabled && (
          <div className="ai-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="ai-icon-wrap"><Sparkles size={18} /></div>
              <div>
                <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--primary)' }}>Smart Insight</p>
                <p className="text-muted" style={{ fontSize: '0.75rem' }}>AI-generated · just now</p>
              </div>
            </div>
            {aiSug === null ? (
              <Skeleton width="90%" height={16} />
            ) : firstSuggestion ? (
              <>
                <p style={{ fontSize: '0.9375rem', lineHeight: 1.6 }}>{firstSuggestion.message}</p>
                <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => navigate('/insights')}>
                  View breakdown →
                </button>
              </>
            ) : (
              <p style={{ fontSize: '0.9375rem', lineHeight: 1.6 }}>All your balances look healthy! Keep it up 🎉</p>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {sumLoading ? (
          [1,2,3].map(i => <SkeletonCard key={i} lines={1} />)
        ) : (
          <>
            <StatCard label="This Month" value={`₹${(summary?.monthly_spend ?? 0).toLocaleString('en-IN')}`} />
            <StatCard label="Groups"     value={`${summary?.group_count ?? 0} active`} />
            <StatCard label="Pending"    value={`${summary?.pending_count ?? 0} items`} />
          </>
        )}
      </div>

      {/* Groups */}
      <div style={{ marginBottom: '2rem' }}>
        <div className="section-header">
          <h3>Your Groups</h3>
          <button className="btn-ghost" style={{ fontSize: '0.875rem', border: 'none', background: 'none', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }} onClick={() => navigate('/group')}>
            See all <ChevronRight size={14} />
          </button>
        </div>
        {grpLoading ? (
          <div className="scroll-x">
            {[1,2,3].map(i => <SkeletonCard key={i} style={{ minWidth: 180 }} />)}
          </div>
        ) : grpError ? (
          <ErrorState message={grpError} onRetry={refetchGrp} />
        ) : groups?.length === 0 ? (
          <EmptyState icon="👥" title="No groups yet" subtitle="Create a group to start splitting!" action={<Link to="/group" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>Go to Groups</Link>} />
        ) : (
          <div className="scroll-x">
            {groups.map(g => <GroupCard key={g.id} group={g} onClick={() => navigate(`/group?id=${g.id}`)} />)}
          </div>
        )}
      </div>

      {/* Recent Expenses */}
      <div>
        <div className="section-header"><h3>Recent Expenses</h3></div>
        {!expenses ? (
          <div className="card" style={{ padding: '0 1.5rem' }}>
            {[1,2,3].map(i => (
              <div key={i} className="expense-row">
                <Skeleton width={44} height={44} radius="var(--radius-md)" />
                <div style={{ flex: 1 }}><Skeleton width="65%" height={15} /><Skeleton width="40%" height={12} style={{ marginTop: 6 }} /></div>
                <Skeleton width={60} height={15} />
              </div>
            ))}
          </div>
        ) : expenses.length === 0 ? (
          <EmptyState icon="💸" title="No expenses yet" subtitle="Add your first expense to get started." />
        ) : (
          <div className="card" style={{ padding: '0 1.5rem' }}>
            {expenses.map(e => (
              <div key={e.id} className="expense-row">
                <div className="expense-icon">{e.emoji || '💸'}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{e.title}</p>
                  <p className="text-muted" style={{ fontSize: '0.8125rem' }}>{e.group_name}</p>
                </div>
                <p style={{ fontWeight: 700 }}>₹{e.amount.toLocaleString('en-IN')}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <p className="text-muted" style={{ fontSize: '0.8125rem' }}>{label}</p>
      <p style={{ fontSize: '1.25rem', fontWeight: 700 }}>{value}</p>
    </div>
  );
}

function GroupCard({ group, onClick }) {
  const positive = group.net_balance >= 0;
  return (
    <div className="card card-clickable" onClick={onClick} style={{ minWidth: 180, flexShrink: 0 }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{group.emoji}</div>
      <p style={{ fontWeight: 700, marginBottom: '4px' }}>{group.name}</p>
      <p className="text-muted" style={{ fontSize: '0.8125rem', marginBottom: '0.75rem' }}>{group.member_count} members</p>
      <p style={{ fontWeight: 700, fontSize: '1rem', color: positive ? 'var(--success)' : 'var(--error)' }}>
        ₹{Math.abs(group.net_balance).toLocaleString('en-IN')}
      </p>
      <p style={{ fontSize: '0.75rem', color: positive ? 'var(--success)' : 'var(--error)' }}>
        {positive ? 'you are owed' : 'you owe'}
      </p>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
