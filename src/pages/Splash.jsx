import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';

// Override the global body for splash only
const splashStyle = document.createElement('style');
splashStyle.id = 'splash-style';
splashStyle.textContent = 'body { background: #fffbea !important; }';
document.head.appendChild(splashStyle);

// Cute coin-face logo SVG component
function CoinLogo({ size = 96 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.29,
      background: 'linear-gradient(135deg, #e8a400, #f07c3a)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      marginBottom: '1.75rem',
      boxShadow: '0 20px 60px rgba(232,164,0,0.45), 0 0 0 1px rgba(255,255,255,0.3)',
    }}>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="30" cy="30" r="25" fill="white" fillOpacity="0.92"/>
        {/* Eyes */}
        <circle cx="22" cy="26" r="3" fill="#e8a400"/>
        <circle cx="38" cy="26" r="3" fill="#e8a400"/>
        {/* Smile */}
        <path d="M20 36 Q30 44 40 36" stroke="#f07c3a" strokeWidth="3" strokeLinecap="round" fill="none"/>
        {/* Blush */}
        <ellipse cx="17" cy="34" rx="4" ry="2.5" fill="#f07c3a" fillOpacity="0.3"/>
        <ellipse cx="43" cy="34" rx="4" ry="2.5" fill="#f07c3a" fillOpacity="0.3"/>
        {/* Split dashes */}
        <line x1="30" y1="7" x2="30" y2="53" stroke="#e8a400" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 3"/>
      </svg>
    </div>
  );
}

export default function Splash() {
  const navigate = useNavigate();
  const go = (path) => {
    document.getElementById('splash-style')?.remove();
    navigate(path);
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      background: 'linear-gradient(150deg, #fffbea 0%, #fff3b0 40%, #ffe08a 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Ambient glow orbs */}
      <div style={{ position: 'absolute', top: '10%', left: '5%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(232,164,0,0.22) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '15%', right: '5%', width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(240,124,58,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,240,150,0.4) 0%, transparent 65%)', pointerEvents: 'none' }} />

      <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', zIndex: 1 }}>
        {/* Cute logo */}
        <CoinLogo size={100} />

        <h1 style={{ fontSize: 'clamp(3rem, 10vw, 5rem)', color: '#2d2400', marginBottom: '0.5rem', fontFamily: "'Nunito', sans-serif", fontWeight: 900 }}>Splito</h1>
        <p style={{ fontSize: '1.2rem', color: '#7a6a2a', fontWeight: 600, marginBottom: '3rem' }}>
          Split smart. Live better. ✨
        </p>

        {/* AI badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)',
          border: '1.5px solid rgba(232,164,0,0.3)',
          borderRadius: 999, padding: '0.5rem 1.25rem', marginBottom: '3rem',
          color: '#7a6a2a', fontSize: '0.9rem', fontWeight: 600,
        }}>
          <Sparkles size={16} color="#e8a400" /> AI-powered expense intelligence
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: 380 }}>
          <button
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
            onClick={() => go('/auth')}
          >
            Get Started <ArrowRight size={20} />
          </button>
          <button
            className="btn"
            style={{ width: '100%', background: 'rgba(255,255,255,0.6)', color: '#7a6a2a', border: '1.5px solid rgba(232,164,0,0.3)', padding: '1rem', fontWeight: 600 }}
            onClick={() => go('/auth')}
          >
            Sign in to your account
          </button>
        </div>
      </div>
    </div>
  );
}
