import { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS    = { success: CheckCircle2, error: XCircle, info: Info };
const BG_MAP   = {
  success: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(6,182,212,0.06))',
  error:   'linear-gradient(135deg, rgba(239,68,68,0.1),  rgba(249,115,22,0.06))',
  info:    'linear-gradient(135deg, rgba(91,94,244,0.08), rgba(155,62,247,0.06))',
};
const CLR_MAP  = { success: 'var(--success)', error: 'var(--error)', info: 'var(--primary)' };
const BORDER   = { success: 'rgba(16,185,129,0.25)', error: 'rgba(239,68,68,0.25)', info: 'rgba(91,94,244,0.2)' };

let nextId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts(t => t.filter(x => x.id !== id)), []);

  const show = useCallback((message, type = 'info', duration = 3500) => {
    const id = ++nextId;
    setToasts(t => [...t.slice(-3), { id, message, type }]); // max 4
    setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const toast = useMemo(() => ({
    success: (msg, dur) => show(msg, 'success', dur),
    error:   (msg, dur) => show(msg, 'error',   dur),
    info:    (msg, dur) => show(msg, 'info',     dur),
    dismiss,
  }), [show, dismiss]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Portal-like fixed container */}
      <div style={{
        position: 'fixed', top: '1.25rem', right: '1.25rem',
        zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.625rem',
        pointerEvents: 'none', maxWidth: 360,
      }}>
        {toasts.map(t => {
          const Icon = ICONS[t.type] || Info;
          return (
            <div key={t.id} className="animate-fade-up" style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
              padding: '1rem 1.25rem', borderRadius: 'var(--radius-lg)',
              background: BG_MAP[t.type], border: `1.5px solid ${BORDER[t.type]}`,
              boxShadow: 'var(--shadow-lg)', pointerEvents: 'all',
              backdropFilter: 'blur(16px)',
            }}>
              <Icon size={18} color={CLR_MAP[t.type]} style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ flex: 1, fontSize: '0.9rem', fontWeight: 500, color: 'var(--on-surface)', lineHeight: 1.5 }}>
                {t.message}
              </p>
              <button onClick={() => dismiss(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-faint)', padding: 0, display: 'flex' }}>
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
