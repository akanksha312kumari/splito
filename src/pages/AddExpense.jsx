import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Mic, Receipt, Utensils, Car, Home, ShoppingCart, Plane, Music, Check } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import ErrorState from '../components/ErrorState';
import Skeleton from '../components/Skeleton';

const CATEGORIES = [
  { id: 'food',    icon: Utensils,     label: 'Food',     emoji: '🍕' },
  { id: 'travel',  icon: Car,          label: 'Travel',   emoji: '🚕' },
  { id: 'home',    icon: Home,         label: 'Home',     emoji: '🏠' },
  { id: 'shop',    icon: ShoppingCart, label: 'Shopping', emoji: '🛒' },
  { id: 'flight',  icon: Plane,        label: 'Flights',  emoji: '✈️' },
  { id: 'fun',     icon: Music,        label: 'Fun',      emoji: '🎉' },
];

export default function AddExpense() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const toast      = useToast();

  // ✅ Correctly read prefill from React Router location state
  const prefill = location.state?.prefill || {};

  const { data: groups = [], loading: grpLoading, error: grpError } = useApi('/groups');

  const [title,      setTitle]      = useState(prefill.title    || '');
  const [amount,     setAmount]     = useState(prefill.amount   ? String(prefill.amount) : '');
  const [groupId,    setGroupId]    = useState(prefill.groupId  || '');
  const [category,   setCategory]   = useState(prefill.category || 'food');
  const [splitType,  setSplitType]  = useState('equal');
  const [customSplits, setCustomSplits] = useState({});
  const [isListening, setListening] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [success,    setSuccess]    = useState(false);

  // Auto-select group if only one
  useEffect(() => {
    if (!groupId && groups?.length === 1) setGroupId(groups[0].id);
  }, [groups, groupId]);

  // Fetch members when group selected
  const { data: groupDetail, loading: membersLoading } = useApi(
    groupId ? `/groups/${groupId}` : null,
    [groupId]
  );
  const members = groupDetail?.members || [];

  const perPerson = (members.length > 0 && amount && !isNaN(Number(amount)))
    ? (Number(amount) / members.length).toFixed(2)
    : '0.00';

  const validate = () => {
    if (!groupId)                                          return 'Please select a group.';
    if (!title.trim())                                     return 'Please enter a description.';
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return 'Please enter a valid amount.';
    if (splitType === 'custom') {
      const sum = Object.values(customSplits).reduce((a, b) => a + Number(b || 0), 0);
      if (Math.abs(sum - Number(amount)) > 0.05) {
        return `Custom sum is ₹${sum.toFixed(2)}, which does not match total amount ₹${amount}`;
      }
    }
    return '';
  };

  const save = async () => {
    const err = validate();
    if (err) { setFieldError(err); return; }
    setFieldError('');
    setLoading(true);

    const cat = CATEGORIES.find(c => c.id === category);
    try {
      await api.post('/expenses', {
        group_id:   groupId,
        title:      title.trim(),
        amount:     Number(amount),
        category,
        split_type: splitType,
        splits:     splitType === 'custom' ? customSplits : undefined,
        emoji:      cat?.emoji || '💸',
      });
      // Show inline success animation, then navigate
      setSuccess(true);
      toast.success(`Expense "₹${Number(amount).toLocaleString('en-IN')}" added! 🎉`);
      setTimeout(() => {
        if (groupId) {
          navigate(`/group?id=${groupId}`, { state: { expenseAdded: true } });
        } else {
          navigate('/dashboard', { state: { expenseAdded: true } });
        }
      }, 900);
    } catch (e) {
      toast.error(e.message || 'Failed to save expense');
      setLoading(false);
    }
  };

  // Web Speech API voice input
  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast.info('Voice input not supported in this browser.'); return; }
    const rec = new SR();
    rec.lang = 'en-IN';
    rec.onstart  = () => setListening(true);
    rec.onend    = () => setListening(false);
    rec.onresult = (e) => {
      const text  = e.results[0][0].transcript;
      const match = text.match(/(\d+(?:\.\d+)?)\s+(?:for\s+)?(.+)/i);
      if (match) { setAmount(match[1]); setTitle(match[2]); }
      else setTitle(text);
      toast.info(`Heard: "${text}"`);
    };
    rec.onerror = () => { setListening(false); toast.error('Could not capture voice input.'); };
    rec.start();
  };

  return (
    <div className="page animate-fade-up">
      {/* Success overlay */}
      {success && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(16,185,129,0.12)', backdropFilter: 'blur(8px)',
          animation: 'fadeInUp 0.3s ease both',
        }}>
          <div style={{ background: 'white', borderRadius: '50%', width: 88, height: 88, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 40px rgba(16,185,129,0.4)' }}>
            <Check size={44} strokeWidth={3} color="var(--success)" />
          </div>
        </div>
      )}

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <button className="btn btn-ghost btn-icon" onClick={() => navigate(-1)}><ArrowLeft size={22} /></button>
        <h2 style={{ fontSize: '1.5rem' }}>Add Expense</h2>
        <button className="btn btn-ghost btn-icon" onClick={() => navigate('/scanner')} title="Scan receipt">
          <Receipt size={22} color="var(--primary)" />
        </button>
      </header>

      {/* Amount + description hero */}
      <div className="card" style={{ textAlign: 'center', padding: '2.5rem 2rem', marginBottom: '1.5rem', background: 'linear-gradient(135deg, rgba(232,164,0,0.06), rgba(240,124,58,0.04))' }}>
        <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>Total amount (₹)</p>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: '4px' }}>
          <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)' }}>₹</span>
          <input
            id="amount-input"
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            style={{ fontSize: 'clamp(2.5rem, 8vw, 4rem)', fontWeight: 800, width: 220, border: 'none', background: 'transparent', textAlign: 'center', letterSpacing: '-0.03em', color: 'var(--on-surface)', padding: 0, boxShadow: 'none' }}
          />
        </div>
        <input
          id="title-input"
          type="text"
          placeholder="What was it for?"
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={{ textAlign: 'center', marginTop: '1rem', background: 'var(--surface-low)', border: 'none' }}
          onKeyDown={e => e.key === 'Enter' && save()}
        />
      </div>

      {/* Group picker */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <p style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.75rem' }}>Group</p>
        {grpLoading ? <Skeleton height={48} /> : grpError ? <ErrorState message={grpError} /> : (
          <select id="group-select" value={groupId} onChange={e => setGroupId(e.target.value)}>
            <option value="">Select a group…</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>)}
          </select>
        )}
      </div>

      {/* Category chips */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <p style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '1rem' }}>Category</p>
        <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
          {CATEGORIES.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setCategory(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '0.5rem 0.875rem', borderRadius: 999, border: 'none',
                background: category === id ? 'linear-gradient(135deg, var(--primary), var(--secondary))' : 'var(--surface-low)',
                color: category === id ? 'white' : 'var(--on-surface-muted)',
                fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
                fontFamily: 'inherit', transition: 'all var(--transition)',
                boxShadow: category === id ? '0 4px 14px rgba(232,164,0,0.28)' : 'none',
                transform: category === id ? 'scale(1.04)' : 'scale(1)',
              }}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Split type + member list */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <p style={{ fontWeight: 600 }}>Split Type</p>
          <div className="pill-toggle" style={{ width: 180 }}>
            <button className={`pill-option ${splitType === 'equal' ? 'active' : ''}`} onClick={() => setSplitType('equal')}>Equal</button>
            <button className={`pill-option ${splitType === 'custom' ? 'active' : ''}`} onClick={() => setSplitType('custom')}>Custom</button>
          </div>
        </div>

        {groupId && (
          membersLoading ? (
            <div style={{ display: 'flex', gap: '1rem' }}>
              {[1,2,3].map(i => <Skeleton key={i} width={48} height={48} radius="50%" />)}
            </div>
          ) : members.length > 0 ? (
            <>
              {splitType === 'equal' ? (
                <>
                  <div style={{ background: 'var(--surface-low)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', marginBottom: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="text-muted" style={{ fontSize: '0.875rem' }}>Each person pays</span>
                    <span style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--primary)' }}>₹{perPerson}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.875rem', flexWrap: 'wrap' }}>
                    {members.map(m => (
                      <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <div className="avatar avatar-md" style={{ background: `hsl(${(m.name.charCodeAt(0) * 37) % 360}, 60%, 55%)` }}>
                          {m.name[0].toUpperCase()}
                        </div>
                        <span style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'var(--on-surface-muted)', maxWidth: 52, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.name.split(' ')[0]}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {members.map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-low)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div className="avatar avatar-sm" style={{ background: `hsl(${(m.name.charCodeAt(0) * 37) % 360}, 60%, 55%)` }}>
                          {m.name[0].toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{m.name.split(' ')[0]}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--primary)' }}>₹</span>
                        <input 
                          type="number"
                          placeholder="0.00"
                          value={customSplits[m.id] !== undefined ? customSplits[m.id] : ''}
                          onChange={(e) => setCustomSplits(prev => ({ ...prev, [m.id]: e.target.value }))}
                          style={{ width: 80, border: 'none', background: 'transparent', textAlign: 'right', fontWeight: 700, fontSize: '1.125rem', padding: 0 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null
        )}

        {!groupId && (
          <p className="text-muted" style={{ fontSize: '0.875rem', fontStyle: 'italic' }}>Select a group above to see members</p>
        )}
      </div>

      {/* Validation error */}
      {fieldError && (
        <div style={{ color: 'var(--error)', fontSize: '0.875rem', marginBottom: '1rem', padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          ⚠️ {fieldError}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <button
          id="voice-btn"
          onClick={startVoice}
          title="Voice input"
          className={isListening ? 'animate-pulse-slow' : ''}
          style={{
            width: 56, height: 56, borderRadius: '50%', padding: 0, flexShrink: 0,
            background: isListening
              ? 'linear-gradient(135deg, var(--error), #f97316)'
              : 'linear-gradient(135deg, var(--secondary), var(--primary))',
            color: 'white',
            boxShadow: isListening ? '0 0 0 8px rgba(239,68,68,0.15)' : '0 8px 28px rgba(232,164,0,0.35)',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all var(--transition)',
          }}
        >
          <Mic size={22} />
        </button>
        <button
          id="save-expense-btn"
          className="btn btn-primary"
          style={{ flex: 1, padding: '1rem', fontSize: '1.0625rem', opacity: loading || success ? 0.75 : 1 }}
          onClick={save}
          disabled={loading || success}
        >
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
              Saving…
            </span>
          ) : success ? '✓ Saved!' : 'Save Expense'}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
