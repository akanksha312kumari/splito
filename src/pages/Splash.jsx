import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';

// Override the global body for splash only
const splashStyle = document.createElement('style');
splashStyle.id = 'splash-style';
splashStyle.textContent = 'body { background: #0f0c29 !important; }';
document.head.appendChild(splashStyle);

export default function Splash() {
  const navigate = useNavigate();
  // Remove the override when leaving
  const go = (path) => {
    document.getElementById('splash-style')?.remove();
    navigate(path);
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      background: 'linear-gradient(150deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Ambient glow orbs */}
      <div style={{ position: 'absolute', top: '15%', left: '10%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(91,94,244,0.35) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '20%', right: '5%', width: 250, height: 250, borderRadius: '50%', background: 'radial-gradient(circle, rgba(155,62,247,0.3) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', zIndex: 1 }}>
        {/* Logo mark */}
        <div style={{
          width: 96, height: 96, borderRadius: 28,
          background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '1.75rem',
          boxShadow: '0 20px 60px rgba(91,94,244,0.5), 0 0 0 1px rgba(255,255,255,0.1)',
          fontSize: '2.75rem', fontWeight: 900, color: 'white'
        }}>S</div>

        <h1 style={{ fontSize: 'clamp(3rem, 10vw, 5rem)', color: 'white', marginBottom: '0.5rem' }}>Splito</h1>
        <p style={{ fontSize: '1.25rem', color: 'rgba(255,255,255,0.65)', fontWeight: 400, marginBottom: '3rem' }}>
          Split smart. Live better.
        </p>

        {/* AI badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 999, padding: '0.5rem 1.25rem', marginBottom: '3rem',
          color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem', fontWeight: 500,
        }}>
          <Sparkles size={16} color="#c4b5fd" /> AI-powered expense intelligence
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: 380 }}>
          <button
            className="btn btn-primary btn-lg"
            style={{ width: '100%', boxShadow: '0 8px 32px rgba(91,94,244,0.5)' }}
            onClick={() => go('/auth')}
          >
            Get Started <ArrowRight size={20} />
          </button>
          <button
            className="btn"
            style={{ width: '100%', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.15)', padding: '1rem' }}
            onClick={() => go('/auth')}
          >
            Sign in to your account
          </button>
        </div>
      </div>
    </div>
  );
}
