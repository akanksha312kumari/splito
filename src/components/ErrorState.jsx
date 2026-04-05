import { AlertCircle, RefreshCw } from 'lucide-react';

/**
 * ErrorState — consistent error card
 * Usage: <ErrorState message="Could not load groups" onRetry={refetch} />
 */
export default function ErrorState({ message, onRetry }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: '1rem', padding: '3rem 2rem',
      background: 'rgba(239,68,68,0.04)', border: '1.5px solid rgba(239,68,68,0.15)',
      borderRadius: 'var(--radius-lg)', textAlign: 'center',
    }}>
      <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <AlertCircle size={26} color="var(--error)" />
      </div>
      <div>
        <p style={{ fontWeight: 600, marginBottom: '4px' }}>Something went wrong</p>
        <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-muted)' }}>{message || 'An unexpected error occurred.'}</p>
      </div>
      {onRetry && (
        <button className="btn btn-secondary btn-sm" onClick={onRetry} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={14} /> Try again
        </button>
      )}
    </div>
  );
}
