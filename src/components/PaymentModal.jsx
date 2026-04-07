import { useState, useEffect } from 'react';
import { X, CheckCircle2, ChevronRight, Smartphone, CreditCard, Landmark, Loader2 } from 'lucide-react';

const METHODS = [
  { id: 'gpay', name: 'Google Pay', icon: <Smartphone size={20} /> },
  { id: 'phonepe', name: 'PhonePe', icon: <Smartphone size={20} /> },
  { id: 'upi', name: 'Other UPI', icon: <Smartphone size={20} /> },
  { id: 'card', name: 'Debit / Credit Card', icon: <CreditCard size={20} /> },
  { id: 'netbanking', name: 'Net Banking', icon: <Landmark size={20} /> },
];

export default function PaymentModal({ isOpen, onClose, amount, payeeName, onComplete }) {
  const [step, setStep] = useState('method_select'); // method_select, details, processing, success
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [details, setDetails] = useState('');
  const [saveDetails, setSaveDetails] = useState(true);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('method_select');
      setSelectedMethod(null);
      setDetails('');
      setSaveDetails(true);
    }
  }, [isOpen]);

  const handleMethodSelect = (method) => {
    setSelectedMethod(method);
    const saved = localStorage.getItem(`payment_details_${method.id}`);
    if (saved) {
      setDetails(saved);
      setSaveDetails(true);
    } else {
      setDetails('');
      setSaveDetails(true);
    }
    setStep('details');
  };

  const handleProceed = () => {
    if (saveDetails && details) {
      localStorage.setItem(`payment_details_${selectedMethod.id}`, details);
    } else if (!saveDetails) {
      localStorage.removeItem(`payment_details_${selectedMethod.id}`);
    }
    setStep('processing');

    // Simulate Gateway Processing delay
    setTimeout(() => {
      setStep('success');
      setTimeout(() => {
        onComplete({ method: selectedMethod.name, details });
        onClose();
      }, 1500);
    }, 2500);
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div 
        className="animate-fade-up" 
        style={{ width: '100%', maxWidth: 400, background: 'var(--surface)', borderRadius: '1.5rem 1.5rem 1rem 1rem', padding: '1.5rem', position: 'relative', boxShadow: '0 -10px 40px rgba(0,0,0,0.2)' }}
      >
        <button 
          onClick={onClose} 
          disabled={step === 'processing' || step === 'success'}
          style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'var(--surface-low)', border: 'none', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--on-surface-muted)' }}
        >
          <X size={18} />
        </button>

        {step === 'method_select' && (
          <div>
            <h3 style={{ marginBottom: '0.25rem' }}>Pay {payeeName}</h3>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--on-surface)', marginBottom: '1.5rem' }}>
              ₹{amount.toLocaleString('en-IN')}
            </div>

            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface-muted)', marginBottom: '1rem' }}>RECOMMENDED</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {METHODS.map(m => (
                <button 
                  key={m.id} 
                  onClick={() => handleMethodSelect(m)}
                  style={{ display: 'flex', alignItems: 'center', padding: '1rem', background: 'var(--surface-low)', border: '1.5px solid transparent', borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all var(--transition)', width: '100%', textAlign: 'left' }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(232,164,0,0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '1rem' }}>
                    {m.icon}
                  </div>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: '1rem', color: 'var(--on-surface)' }}>{m.name}</span>
                  <ChevronRight size={20} color="var(--on-surface-faint)" />
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'details' && (
          <div>
            <h3 style={{ marginBottom: '1.5rem' }}>{selectedMethod?.name} Details</h3>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface-muted)', marginBottom: '0.5rem' }}>
                {selectedMethod?.id === 'card' ? 'Card Number' : selectedMethod?.id === 'netbanking' ? 'Account Number' : 'UPI ID / Mobile Number'}
              </label>
              <input 
                type="text" 
                className="input input-lg"
                autoFocus
                placeholder={selectedMethod?.id === 'card' ? 'XXXX XXXX XXXX XXXX' : 'e.g. name@okhdfc'}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                style={{ width: '100%', border: '2px solid rgba(232,164,0,0.3)', background: 'var(--surface-low)' }}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', marginBottom: '2rem' }}>
              <input 
                type="checkbox" 
                checked={saveDetails}
                onChange={(e) => setSaveDetails(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: 'var(--primary)' }}
              />
              <span style={{ fontSize: '0.875rem', color: 'var(--on-surface-muted)' }}>Securely save details for future payments</span>
            </label>

            <button 
              className="btn btn-primary btn-lg" 
              style={{ width: '100%' }}
              disabled={!details.trim()}
              onClick={handleProceed}
            >
              Proceed to Pay ₹{amount.toLocaleString('en-IN')}
            </button>
          </div>
        )}

        {step === 'processing' && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <Loader2 size={48} color="var(--primary)" className="spin" style={{ margin: '0 auto 1.5rem' }} />
            <h3 style={{ marginBottom: '0.5rem' }}>Opening {selectedMethod?.name}...</h3>
            <p style={{ color: 'var(--on-surface-muted)', fontSize: '0.875rem' }}>Please complete the payment on the secure gateway. Do not close this window.</p>
          </div>
        )}

        {step === 'success' && (
          <div className="animate-fade-up" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: 'white' }}>
              <CheckCircle2 size={40} />
            </div>
            <h2 style={{ marginBottom: '0.5rem' }}>Payment Successful!</h2>
            <p style={{ color: 'var(--on-surface-muted)', fontSize: '0.875rem' }}>₹{amount.toLocaleString('en-IN')} sent to {payeeName}</p>
          </div>
        )}
      </div>
    </div>
  );
}
