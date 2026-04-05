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
      <div className="auth-hero" style={{ display: 'none', width: 420, background: 'linear-gradient(150deg, #0f0c29 0%, #302b63 60%, #24243e 100%)', padding: '3rem', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
        <style>{`@media(min-width:768px){.auth-hero{display:flex !important;}}`}</style>
        <div style={{ position: 'absolute', bottom: -100, right: -80, width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(155,62,247,0.25) 0%, transparent 70%)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,var(--primary),var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '1.25rem' }}>S</div>
          <span style={{ color: 'white', fontWeight: 800, fontSize: '1.375rem' }}>Splito</span>
        </div>
        <div>
          <h2 style={{ color: 'white', fontSize: '2rem', marginBottom: '1rem', fontWeight: 800 }}>The smartest way to split expenses.</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>AI-powered insights, predictive alerts, and beautiful analytics — all in one place.</p>
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
