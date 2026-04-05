/**
 * Skeleton — animated shimmer placeholder for loading states
 * Usage: <Skeleton width="100%" height={24} radius="var(--radius-md)" />
 */
export default function Skeleton({ width = '100%', height = 20, radius = 'var(--radius-sm)', style = {} }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius: radius,
        background: 'linear-gradient(90deg, var(--surface-low) 25%, var(--surface-mid) 50%, var(--surface-low) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s ease-in-out infinite',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

/** Convenience: a full card-shaped skeleton */
export function SkeletonCard({ lines = 2, style = {} }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', ...style }}>
      <Skeleton width="60%" height={18} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '40%' : '100%'} height={14} />
      ))}
    </div>
  );
}
