import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Camera, Sparkles, Zap, Upload, CheckCircle2, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import Skeleton from '../components/Skeleton';

// Demo data shown when user hits "Demo Scan" (no real file needed)
const DEMO_ITEMS = [
  { name: 'Chicken Tikka',  qty: 2, unit_price: 240, amount: 480 },
  { name: 'Naan Bread',     qty: 4, unit_price: 30,  amount: 120 },
  { name: 'Butter Chicken', qty: 1, unit_price: 520, amount: 520 },
  { name: 'Mango Lassi',    qty: 2, unit_price: 80,  amount: 160 },
];
const DEMO_RESULT = {
  items:              DEMO_ITEMS,
  total:              1280,
  member_count:       3,
  per_person:         Math.round((1280 / 3) * 100) / 100,
  ai_confidence:      94,
  suggested_category: 'food',
};

export default function ReceiptScanner() {
  const navigate = useNavigate();
  const toast    = useToast();
  const fileRef  = useRef(null);

  const { data: fetchedGroups } = useApi('/groups');
  const groups = fetchedGroups || [];

  const [scanning,  setScanning]  = useState(false);
  const [result,    setResult]    = useState(null);
  const [groupId,   setGroupId]   = useState('');
  const [editItems, setEditItems] = useState([]);
  const [preview,   setPreview]   = useState(null);  // ObjectURL preview of uploaded image

  /* ─── Scan real file ─── */
  const handleFile = async (file) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setScanning(true);
    setResult(null);

    try {
      const form = new FormData();
      form.append('receipt', file);
      if (groupId) form.append('group_id', groupId);

      const data = await api.upload('/receipts/scan', form);
      applyResult(data);
      toast.success(`AI detected ${data.items.length} items · ₹${data.total} total`);
    } catch (e) {
      // Fall back to demo data so the flow isn't broken
      toast.info('Using demo data — backend scan unavailable');
      applyResult({ ...DEMO_RESULT, member_count: groupId ? undefined : 1 });
    } finally {
      setScanning(false);
    }
  };

  /* ─── Demo scan (no file) ─── */
  const runDemoScan = async () => {
    if (fileRef.current) fileRef.current.value = '';
    setPreview(null);
    setScanning(true);
    setResult(null);
    // Simulate AI processing delay
    await new Promise(r => setTimeout(r, 1800));
    applyResult(DEMO_RESULT);
    toast.success('Demo scan complete! 4 items detected · ₹1,280 total');
    setScanning(false);
  };

  const applyResult = (data) => {
    // Update member count from selected group if available
    const group = groups.find(g => g.id === groupId);
    const mc = group ? group.member_count : (data.member_count || 1);
    const finalData = { ...data, member_count: mc, per_person: Math.round((data.total / mc) * 100) / 100 };
    setResult(finalData);
    setEditItems(finalData.items.map(item => ({ ...item })));
  };

  const updateItem = (idx, field, value) => {
    setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const removeItem = (idx) => {
    setEditItems(prev => prev.filter((_, i) => i !== idx));
  };

  const totalFromEdits = editItems.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const memberCount    = result?.member_count || 1;
  const perPerson      = Math.round((totalFromEdits / memberCount) * 100) / 100;

  const useSplit = () => {
    navigate('/add-expense', {
      state: {
        prefill: {
          title:    'Receipt Split',
          amount:   totalFromEdits,
          groupId,
          category: result?.suggested_category || 'food',
        },
      },
    });
  };

  const reset = () => {
    setResult(null);
    setPreview(null);
    setEditItems([]);
    if (fileRef.current) fileRef.current.value = '';
  };

  /* ─── RENDER ─── */
  return (
    <div className="overlay-page" style={{ display: 'flex', flexDirection: 'column', background: '#0a0a0f' }}>

      {/* ── Camera / Preview area ── */}
      <div style={{ flex: '0 0 48vh', position: 'relative', overflow: 'hidden', minHeight: 280 }}>

        {/* Background */}
        {preview ? (
          <img src={preview} alt="Receipt" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55 }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 55%, #0f3460 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', opacity: 0.45 }}>
              <Camera size={64} color="white" />
              <p style={{ color: 'white', fontSize: '0.9rem' }}>Upload or use demo scan</p>
            </div>
          </div>
        )}

        {/* Header bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10, background: 'linear-gradient(to bottom, rgba(0,0,0,0.65), transparent)' }}>
          <button
            style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer' }}
            onClick={() => navigate(-1)}
          >
            <X size={20} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(91,94,244,0.85)', backdropFilter: 'blur(10px)', borderRadius: 999, padding: '6px 14px', color: 'white', fontSize: '0.8125rem', fontWeight: 700 }}>
            <Sparkles size={14} /> AI Auto-Scan
          </div>

          {result ? (
            <button style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 999, padding: '6px 14px', color: 'white', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }} onClick={reset}>
              Rescan
            </button>
          ) : <div style={{ width: 40 }} />}
        </div>

        {/* Viewfinder (idle) */}
        {!preview && !scanning && !result && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '70%', height: '68%', position: 'relative' }}>
              {/* Corner brackets */}
              {[
                { top: 0, left: 0,    borderTop: 3, borderLeft: 3 },
                { top: 0, right: 0,   borderTop: 3, borderRight: 3 },
                { bottom: 0, left: 0,  borderBottom: 3, borderLeft: 3 },
                { bottom: 0, right: 0, borderBottom: 3, borderRight: 3 },
              ].map((s, i) => (
                <div key={i} style={{ position: 'absolute', width: 28, height: 28, ...Object.fromEntries(Object.entries(s).map(([k, v]) => [k, typeof v === 'number' && k.startsWith('border') && !k.startsWith('border-') ? undefined : v])), borderColor: 'white', borderStyle: 'solid', borderWidth: 0, ...Object.fromEntries(Object.entries(s).filter(([k]) => k.startsWith('border')).map(([k, v]) => [k + 'Width', v])) }} />
              ))}
              {/* Scan line */}
              <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, var(--primary), var(--secondary), transparent)', boxShadow: '0 0 12px rgba(91,94,244,0.9)', animation: 'scanLine 2.4s ease-in-out infinite', top: '40%' }} />
            </div>
          </div>
        )}

        {/* Scanning spinner overlay */}
        {scanning && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', zIndex: 20 }}>
            <div style={{ width: 52, height: 52, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: 'white', fontWeight: 600, fontSize: '0.9375rem' }}>AI is reading your receipt…</p>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8125rem' }}>Detecting items and amounts</p>
          </div>
        )}
      </div>

      {/* ── Bottom Sheet ── */}
      <div style={{
        flex: 1,
        background: 'var(--surface)',
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: '1.75rem 1.5rem 2rem',
        marginTop: -20, zIndex: 5,
        overflowY: 'auto',
        minHeight: 0,
      }}>

        {/* Group selector */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--on-surface-muted)', display: 'block', marginBottom: '6px' }}>
            Split in group (optional)
          </label>
          <select value={groupId} onChange={e => setGroupId(e.target.value)}>
            <option value="">No group selected</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.emoji} {g.name} ({g.member_count} people)</option>)}
          </select>
        </div>

        {/* ── Loading skeleton ── */}
        {scanning && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem', background: 'var(--surface-lowest)', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-mid)' }}>
                <Skeleton width="52%" height={15} />
                <Skeleton width={56} height={15} />
              </div>
            ))}
          </div>
        )}

        {/* ── Scan results ── */}
        {result && !scanning && (
          <>
            {/* AI header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.25rem' }}>
              <div className="ai-icon-wrap" style={{ width: 38, height: 38 }}><Zap size={17} /></div>
              <div>
                <p style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{editItems.length} items detected</p>
                <p className="text-muted" style={{ fontSize: '0.8125rem' }}>Tap amount to edit · AI confidence {result.ai_confidence}%</p>
              </div>
              <span className="badge badge-success" style={{ marginLeft: 'auto' }}>AI Live</span>
            </div>

            {/* Editable items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
              {editItems.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'var(--surface-lowest)', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-mid)', transition: 'border-color var(--transition)' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.name}</p>
                    <p className="text-muted" style={{ fontSize: '0.8125rem' }}>Qty: {item.qty}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--primary)', fontWeight: 700 }}>₹</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={item.amount}
                      onChange={e => updateItem(idx, 'amount', e.target.value)}
                      style={{ width: 76, textAlign: 'right', fontWeight: 700, border: '1.5px solid var(--surface-mid)', background: 'white', borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontSize: '0.9rem' }}
                    />
                    <button onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-faint)', padding: '4px', display: 'flex', borderRadius: 6, transition: 'color var(--transition)' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Split preview card */}
            <div className="ai-card" style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.875rem', marginBottom: '2px' }}>
                  Suggested Split {memberCount > 1 ? `(${memberCount} people)` : ''}
                </p>
                <p style={{ fontSize: '1rem', fontWeight: 800 }}>Total: ₹{totalFromEdits.toLocaleString('en-IN')}</p>
              </div>
              {memberCount > 1 && (
                <div style={{ textAlign: 'right' }}>
                  <p className="text-muted" style={{ fontSize: '0.75rem' }}>per person</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--primary)' }}>₹{perPerson.toLocaleString('en-IN')}</p>
                </div>
              )}
            </div>

            {/* CTAs */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={reset}>
                <RefreshCw size={15} /> Rescan
              </button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={useSplit}>
                <CheckCircle2 size={16} /> Use This Split
              </button>
            </div>
          </>
        )}

        {/* ── Idle: upload / demo buttons ── */}
        {!result && !scanning && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                id="upload-receipt-btn"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={16} /> Upload Photo
              </button>
              <button
                id="take-photo-btn"
                className="btn btn-primary"
                style={{ flex: 2 }}
                onClick={() => fileRef.current?.click()}
              >
                <Camera size={16} /> Take / Choose Photo
              </button>
            </div>

            {/* Demo mode */}
            <div style={{ borderTop: '1px solid var(--surface-mid)', paddingTop: '0.875rem', textAlign: 'center' }}>
              <p className="text-muted" style={{ fontSize: '0.8125rem', marginBottom: '0.625rem' }}>
                Don't have a receipt? Try the demo:
              </p>
              <button
                id="demo-scan-btn"
                className="btn btn-secondary"
                style={{ width: '100%', borderStyle: 'dashed', borderWidth: '1.5px', borderColor: 'var(--primary)', color: 'var(--primary)', background: 'rgba(91,94,244,0.04)' }}
                onClick={runDemoScan}
              >
                <Sparkles size={16} /> Run Demo AI Scan
              </button>
            </div>
          </div>
        )}

        {/* Hidden real file input */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files?.[0])}
        />
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes scanLine { 0%,100% { top: 6%; } 50% { top: 88%; } }
      `}</style>
    </div>
  );
}
