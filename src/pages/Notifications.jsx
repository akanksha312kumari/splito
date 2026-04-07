import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useNotifCount } from '../hooks/useNotifCount';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

export default function Notifications() {
  // Poll every 30s for live updates
  const { data: notifs, loading, refetch } = useApi('/notifications', [], 'notification');
  const { refetch: refetchCount } = useNotifCount();
  const toast = useToast();

  const markRead = async (id) => {
    // Optimistic: handled by refetch, but we mark instantly
    try {
      await api.put(`/notifications/${id}/read`, {});
      refetch();
      refetchCount();
    } catch (e) {
      toast.error('Could not mark as read');
    }
  };

  const markAll = async () => {
    try {
      await api.put('/notifications/read-all', {});
      refetch();
      refetchCount();
      toast.success('All notifications marked as read');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const deleteNotif = async (e, id) => {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      refetch();
      refetchCount();
    } catch (e) {
      toast.error('Could not delete notification');
    }
  };

  const predictive = notifs?.filter(n => (n.type === 'error' || n.type === 'ai') && n.is_ai) || [];
  const rest = notifs?.filter(n => !n.is_ai || (n.type !== 'error' && n.type !== 'ai')) || [];
  const hasUnread = notifs?.some(n => !n.is_read);

  const typeIcon = { success: '✅', info: 'ℹ️', warning: '⏰', error: '🚨', ai: '🤖' };
  const dotColor = { success: 'var(--success)', warning: 'var(--warning)', error: 'var(--error)', ai: 'var(--primary)', info: 'var(--surface-high)' };

  return (
    <div className="page animate-fade-up">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '4px' }}>Notifications</h1>
          <p className="text-muted">Smart alerts and real-time updates</p>
        </div>
        {hasUnread && (
          <button className="btn btn-secondary btn-sm" onClick={markAll}>Mark all read</button>
        )}
      </header>

      {/* Skeleton loading */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
              <Skeleton width={40} height={40} radius="50%" />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Skeleton width="60%" height={15} />
                <Skeleton width="85%" height={13} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Predictive AI alerts */}
      {!loading && predictive.map(n => (
        <div key={n.id} onClick={() => markRead(n.id)} style={{ borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(249,115,22,0.05))', border: '1.5px solid rgba(239,68,68,0.25)', padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '1rem', cursor: 'pointer', opacity: n.is_read ? 0.65 : 1 }}>
          <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>🚨</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
              <span style={{ fontWeight: 700 }}>{n.title}</span>
              <span className="badge badge-error">Predictive AI</span>
            </div>
            <p className="text-muted" style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>{n.body}</p>
            <p className="text-faint" style={{ fontSize: '0.75rem', marginTop: '6px' }}>AI-generated · {formatTime(n.created_at)}</p>
          </div>
          <button onClick={e => deleteNotif(e, n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', opacity: 0.4, lineHeight: 1 }}>✕</button>
        </div>
      ))}

      {/* Regular notifications */}
      {!loading && rest.length > 0 && (
        <div>
          <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--on-surface-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recent</p>
          <div className="card" style={{ padding: '0 1.5rem' }}>
            {rest.map(n => (
              <div key={n.id} className="expense-row" onClick={() => markRead(n.id)} style={{ alignItems: 'flex-start', cursor: 'pointer', opacity: n.is_read ? 0.6 : 1, position: 'relative' }}>
                <span style={{ fontSize: '1.375rem', flexShrink: 0, marginTop: '2px' }}>{typeIcon[n.type] || '📩'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <p style={{ fontWeight: n.is_read ? 500 : 700, fontSize: '0.9375rem' }}>{n.title}</p>
                    <p className="text-faint" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>{formatTime(n.created_at)}</p>
                  </div>
                  <p className="text-muted" style={{ fontSize: '0.875rem', lineHeight: 1.5 }}>{n.body}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {!n.is_read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor[n.type] || 'var(--primary)' }} />}
                  <button onClick={e => deleteNotif(e, n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', opacity: 0.35, lineHeight: 1 }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && notifs?.length === 0 && (
        <EmptyState icon="🎉" title="You're all caught up!" subtitle="No notifications right now. We'll alert you when something needs your attention." />
      )}
    </div>
  );
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  if (diff < 172_800_000) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
