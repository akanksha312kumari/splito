import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import PaymentModal from '../components/PaymentModal';

export default function Settlement() {
  const navigate          = useNavigate();
  const [params]          = useSearchParams();
  const groupId           = params.get('group');
  const { user, refreshUser } = useAuth();
  const toast             = useToast();

  const { data: suggestions, loading: sugLoading, error: sugError, refetch: refetchSug } = useApi(`/settlements/suggestions?group_id=${groupId}`, [], 'balance_update');
  const { data: pending,  refetch: refetchPending }  = useApi(`/settlements?group_id=${groupId}&status=pending`, [], 'balance_update');
  const { data: history }  = useApi(`/settlements?group_id=${groupId}&status=paid`, [], 'balance_update');

  const [paying,  setPaying]  = useState(null);
  const [modalConfig, setModalConfig] = useState(null);

  const handlePaymentComplete = async ({ method, details }) => {
    if (!modalConfig) return;
    const { type, data } = modalConfig;
    const finalMethod = details ? `${method} (${details})` : method;

    if (type === 'createAndPay') {
      setPaying('new-paid');
      try {
        const created = await api.post('/settlements', {
          group_id: groupId,
          from_user: data.from_user,
          to_user: data.to_user,
          amount: data.amount,
          method: finalMethod
        });
        await api.put(`/settlements/${created.id}/pay`, {});
        await refetchPending();
        await refetchSug();
        await refreshUser();
        toast.success(`Payment sent via ${method} ✓`);
      } catch (e) {
        toast.error(e.message || 'Payment action failed');
      } finally {
        setPaying(null);
      }
    } else if (type === 'payPending') {
      setPaying(data.id);
      try {
        // Here we just mark as paid since they used the actual simulated payment flow
        await api.put(`/settlements/${data.id}/pay`, {});
        await refetchPending();
        await refetchSug();
        await refreshUser();
        toast.success(`Payment marked ✓`);
      } catch (e) {
        toast.error(e.message || 'Payment failed');
      } finally {
        setPaying(null);
      }
    }
  };

  const initiatePayment = async (s) => {
    if (!s || !s.to_user || !s.amount) return;
    setPaying('new-pending');
    try {
      await api.post('/settlements', {
        group_id: groupId,
        from_user: s.from_user,
        to_user: s.to_user,
        amount: s.amount,
        method: 'Requested directly'
      });
      
      await refetchPending();
      await refetchSug();
      toast.success(`Payment request sent for ₹${s.amount.toLocaleString('en-IN')}`);
    } catch (e) {
      toast.error(e.message || 'Action failed');
    } finally {
      setPaying(null);
    }
  };

  const myOweSuggestion = suggestions?.find(s => s.from_user === user?.id);
  const myReceiveSuggestion = suggestions?.find(s => s.to_user === user?.id);
  const targetSuggestion = myOweSuggestion || myReceiveSuggestion || suggestions?.[0];

  useEffect(() => {
    if (!groupId) {
      toast.error("No group selected for settlement");
      navigate('/group', { replace: true });
    }
  }, [groupId, navigate, toast]);

  if (!groupId) return null;

  return (
    <div className="page animate-fade-up">
      <header style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button className="btn btn-ghost btn-icon" onClick={() => navigate(-1)}><ArrowLeft size={22} /></button>
        <h2 style={{ fontSize: '1.5rem' }}>Settle Up</h2>
      </header>

      {sugLoading && <Skeleton width="100%" height={160} radius="var(--radius-xl)" style={{ marginBottom: '2rem' }} />}

      {sugError && <ErrorState message={sugError} onRetry={refetchSug} />}

      {/* AI Optimal Settlement */}
      {!sugLoading && targetSuggestion && (
        <div style={{ borderRadius: 'var(--radius-xl)', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', padding: '2rem', color: 'white', marginBottom: '2rem', boxShadow: '0 12px 40px rgba(232,164,0,0.35)' }}>
          <p style={{ opacity: 0.85, fontSize: '0.8125rem', marginBottom: '1.25rem' }}>✨ AI Optimal Settlement</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="avatar avatar-lg" style={{ background: 'rgba(255,255,255,0.25)', margin: '0 auto 6px', backdropFilter: 'blur(10px)' }}>{targetSuggestion.from_name?.[0]}</div>
              <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>{targetSuggestion.from_name}</p>
              <span className="badge" style={{ background: 'rgba(255,255,255,0.15)', color: 'white', marginTop: 4 }}>Pays</span>
            </div>
            <div style={{ flex: 1, textAlign: 'center', minWidth: 80 }}>
              <div style={{ fontSize: '1.875rem', fontWeight: 900, marginBottom: 4 }}>₹{targetSuggestion.amount.toLocaleString('en-IN')}</div>
              <div style={{ opacity: 0.7, fontSize: '1.25rem' }}>→</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="avatar avatar-lg" style={{ background: 'rgba(255,255,255,0.25)', margin: '0 auto 6px', backdropFilter: 'blur(10px)' }}>{targetSuggestion.to_name?.[0]}</div>
              <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>{targetSuggestion.to_name}</p>
              <span className="badge" style={{ background: 'rgba(255,255,255,0.15)', color: 'white', marginTop: 4 }}>Receives</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1rem' }}>
            {targetSuggestion.from_user === user?.id ? (
              <button 
                className="btn btn-primary" 
                style={{ background: 'white', color: 'var(--primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', width: '100%', maxWidth: 200 }} 
                onClick={() => setModalConfig({ type: 'createAndPay', data: targetSuggestion, amount: targetSuggestion.amount, payee: targetSuggestion.to_name })} 
                disabled={paying === 'new-paid'}
              >
                {paying === 'new-paid' ? 'Processing...' : 'Pay Now'}
              </button>
            ) : (
              <button 
                className="btn" 
                style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', width: '100%', maxWidth: 200 }} 
                onClick={() => initiatePayment(targetSuggestion)} 
                disabled={paying === 'new-pending'}
              >
                {paying === 'new-pending' ? 'Sending...' : 'Request Payment'}
              </button>
            )}
          </div>
          <p style={{ textAlign: 'center', opacity: 0.7, fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
            This clears {suggestions.length} balance{suggestions.length !== 1 ? 's' : ''} in the group optimally.
          </p>
        </div>
      )}

      {/* All settled */}
      {!sugLoading && suggestions?.length === 0 && !pending?.length && (
        <EmptyState icon="🎉" title="All settled up!" subtitle="No outstanding balances in this group. Great teamwork! 🏆" />
      )}

      {/* Pending settlements */}
      {pending?.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <div className="section-header"><h3>Pending Payments</h3></div>
          <div className="card" style={{ padding: '0 1.5rem' }}>
            {pending.map(s => (
              <div key={s.id} className="expense-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontWeight: 600 }}>{s.from_name} → {s.to_name}</p>
                  <p className="text-muted" style={{ fontSize: '0.8125rem' }}>{s.method} · {formatDate(s.created_at)}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--error)' }}>₹{s.amount.toLocaleString('en-IN')}</span>
                  <button className="btn btn-primary btn-sm" onClick={() => s.from_user === user?.id ? setModalConfig({ type: 'payPending', data: s, amount: s.amount, payee: s.to_name }) : initiatePayment(s)} disabled={paying === s.id}>
                    {paying === s.id ? '…' : s.from_user === user?.id ? 'Pay Now' : 'Reminder'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {history?.length > 0 && (
        <div>
          <div className="section-header"><h3>Payment History</h3></div>
          <div className="card" style={{ padding: '0 1.5rem' }}>
            {history.map(h => (
              <div key={h.id} className="expense-row" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CheckCircle2 size={18} color="var(--success)" />
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{h.from_name} → {h.to_name}</p>
                    <p className="text-muted" style={{ fontSize: '0.8125rem' }}>{h.method} · {formatDate(h.paid_at)}</p>
                  </div>
                </div>
                <span style={{ fontWeight: 700, color: 'var(--success)' }}>₹{h.amount.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <PaymentModal 
        isOpen={!!modalConfig}
        onClose={() => setModalConfig(null)}
        amount={modalConfig?.amount || 0}
        payeeName={modalConfig?.payee || 'User'}
        onComplete={handlePaymentComplete}
      />
    </div>
  );
}

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
