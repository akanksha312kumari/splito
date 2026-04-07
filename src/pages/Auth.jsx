import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Auth() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [tab, setTab]         = useState('login');
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      if (tab === 'login') {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
      navigate('/dashboard');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: 'auto 1fr' }}>
      {/* Hero panel */}
      <div className="auth-hero" style={{ display: 'none', width: 420, background: 'linear-gradient(150deg, #fffbea 0%, #fff3b0 50%, #ffe08a 100%)', padding: '3rem', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden', borderRight: '1.5px solid rgba(232,164,0,0.18)' }}>
        <style>{`@media(min-width:768px){.auth-hero{display:flex !important;}}`}</style>
        <div style={{ position: 'absolute', bottom: -100, right: -80, width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(240,124,58,0.2) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', top: -60, left: -60, width: 250, height: 250, borderRadius: '50%', background: 'radial-gradient(circle, rgba(232,164,0,0.18) 0%, transparent 70%)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg,#e8a400,#f07c3a)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 4px 16px rgba(232,164,0,0.35)' }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="11" fill="white" fillOpacity="0.9"/>
              <path d="M10 16 Q14 20 18 16" stroke="#e8a400" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
              <circle cx="11" cy="12.5" r="1.2" fill="#e8a400"/>
              <circle cx="17" cy="12.5" r="1.2" fill="#e8a400"/>
              <line x1="14" y1="4" x2="14" y2="24" stroke="#f07c3a" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2"/>
            </svg>
          </div>
          <span style={{ color: '#2d2400', fontWeight: 900, fontSize: '1.375rem', fontFamily: "'Nunito', sans-serif", background: 'linear-gradient(135deg, #e8a400, #f07c3a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Splito</span>
        </div>
        <div>
          <h2 style={{ color: '#2d2400', fontSize: '2rem', marginBottom: '1rem', fontWeight: 800 }}>The smartest way to split expenses.</h2>
          <p style={{ color: '#7a6a2a', lineHeight: 1.7, fontWeight: 500 }}>AI-powered insights, predictive alerts, and beautiful analytics — all in one place.</p>
        </div>
      </div>

      {/* Form */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'var(--surface)' }}>
        <div style={{ width: '100%', maxWidth: 420 }} className="animate-fade-up">
          <h1 style={{ marginBottom: '0.5rem' }}>{tab === 'login' ? 'Welcome back' : 'Create account'}</h1>
          <p className="text-muted" style={{ marginBottom: '2rem' }}>
            {tab === 'login' ? 'Sign in to continue to Splito.' : 'Start splitting smarter today.'}
          </p>

          <div className="pill-toggle" style={{ marginBottom: '1.75rem' }}>
            <button className={`pill-option ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>Log In</button>
            <button className={`pill-option ${tab === 'signup' ? 'active' : ''}`} onClick={() => setTab('signup')}>Sign Up</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            {tab === 'signup' && (
              <div className="input-group">
                <label className="input-label">Full Name</label>
                <input type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
              </div>
            )}
            <div className="input-group">
              <label className="input-label">Email address</label>
              <input type="email" placeholder="hello@splito.app" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Password</label>
              <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()} />
            </div>
          </div>

          {error && (
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, marginBottom: '1rem', color: 'var(--error)', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary" style={{ width: '100%', padding: '1rem', opacity: loading ? 0.7 : 1 }} onClick={submit} disabled={loading}>
            {loading ? 'Please wait…' : tab === 'login' ? 'Sign In' : 'Create Account'} {!loading && <ArrowRight size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
