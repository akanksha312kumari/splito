/**
 * EmptyState — consistent empty list / no-data state
 * Usage: <EmptyState icon="💸" title="No expenses" subtitle="Add your first expense" action={<button>Add</button>} />
 */
export default function EmptyState({ icon = '📭', title, subtitle, action }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: '0.75rem', padding: '3.5rem 2rem',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '3rem', lineHeight: 1 }}>{icon}</div>
      {title    && <p style={{ fontWeight: 700, fontSize: '1.0625rem' }}>{title}</p>}
      {subtitle && <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-muted)', maxWidth: 280 }}>{subtitle}</p>}
      {action   && <div style={{ marginTop: '0.5rem' }}>{action}</div>}
    </div>
  );
}
