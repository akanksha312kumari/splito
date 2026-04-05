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

const METHODS = ['UPI', 'Google Pay', 'PhonePe', 'Cash', 'Bank Transfer'];

export default function Settlement() {
  const navigate          = useNavigate();
  const [params]          = useSearchParams();
  const groupId           = params.get('group');
  const { user, refreshUser } = useAuth();
  const toast             = useToast();

  const { data: suggestions, loading: sugLoading, error: sugError, refetch: refetchSug } = useApi(`/settlements/suggestions?group_id=${groupId}`, [], 'balance_update');
  const { data: pending,  refetch: refetchPending }  = useApi(`/settlements?group_id=${groupId}&status=pending`, [], 'balance_update');
  const { data: history }  = useApi(`/settlements?group_id=${groupId}&status=paid`, [], 'balance_update');

  const [method,  setMethod]  = useState('UPI');
  const [paying,  setPaying]  = useState(null);

  const pay = async (s) => {
    if (!s?.id) return;
    setPaying(s.id);
    try {
      await api.put(`/settlements/${s.id}/pay`, {});
      await refetchPending();
      await refetchSug();
      await refreshUser();          // update XP in sidebar
      toast.success(`Payment of ₹${s.amount.toLocaleString('en-IN')} marked ✓  You earned +50 XP!`);
    } catch (e) {
      toast.error(e.message || 'Payment failed');
    } finally {
      setPaying(null);
    }
  };

  const createAndPay = async (s) => {
    if (!s || !s.to_user || !s.amount) return;
    setPaying('new-paid');
    try {
      // 1. Create the pending request matching exactly what the AI suggested
      const created = await api.post('/settlements', {
        group_id: groupId,
        from_user: s.from_user,
        to_user: s.to_user,
        amount: s.amount,
        method
      });
      // 2. Mark as immediately paid
      await api.put(`/settlements/${created.id}/pay`, {});
      
      await refetchPending();
      await refetchSug();
      await refreshUser();
      toast.success(`Record updated: ₹${s.amount.toLocaleString('en-IN')} paid via ${method} ✓`);
    } catch (e) {
      toast.error(e.message || 'Payment action failed');
    } finally {
      setPaying(null);
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
        method
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
        <div style={{ borderRadius: 'var(--radius-xl)', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', padding: '2rem', color: 'white', marginBottom: '2rem', boxShadow: '0 12px 40px rgba(91,94,244,0.4)' }}>
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

          {/* Method picker */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem', justifyContent: 'center' }}>
            {METHODS.map(m => (
              <button key={m} onClick={() => setMethod(m)} style={{ padding: '6px 14px', borderRadius: 999, border: '1.5px solid', borderColor: method === m ? 'white' : 'rgba(255,255,255,0.3)', background: method === m ? 'white' : 'transparent', color: method === m ? 'var(--primary)' : 'white', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'all var(--transition)' }}>
                {m}
              </button>
            ))}
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1rem' }}>
            <button className="btn" style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }} onClick={() => initiatePayment(targetSuggestion)} disabled={paying === 'new-pending' || paying === 'new-paid'}>
              {paying === 'new-pending' ? 'Sending...' : 'Send Request'}
            </button>
            <button className="btn btn-primary" style={{ background: 'white', color: 'var(--primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} onClick={() => createAndPay(targetSuggestion)} disabled={paying === 'new-pending' || paying === 'new-paid'}>
              {paying === 'new-paid' ? 'Processing...' : <><CheckCircle2 size={16} /> Mark as Paid</>}
            </button>
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
                  <button className="btn btn-primary btn-sm" onClick={() => pay(s)} disabled={paying === s.id}>
                    {paying === s.id ? '…' : <><CheckCircle2 size={14} /> Pay</>}
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
    </div>
  );
}

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
