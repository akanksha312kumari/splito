import { useNavigate, useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, PieChart, PlusCircle, Bell, User, BrainCircuit, Scan, Users, Wallet } from 'lucide-react';
import { useNotifCount } from '../hooks/useNotifCount';

const navLinks = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/insights',      icon: PieChart,         label: 'Insights' },
  { to: '/ai-report',     icon: BrainCircuit,     label: 'AI Report' },
  { to: '/notifications', icon: Bell,             label: 'Notifications', badge: true },
  { to: '/group',         icon: Users,            label: 'Groups' },
  { to: '/settlement',    icon: Wallet,           label: 'Settle Up' },
  { to: '/scanner',       icon: Scan,             label: 'Receipt Scanner' },
  { to: '/profile',       icon: User,             label: 'Profile' },
];

export default function Sidebar() {
  const navigate  = useNavigate();
  const { pathname } = useLocation();
  const { count } = useNotifCount();

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          {/* Cute coin-split SVG logo */}
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Coin body */}
            <circle cx="14" cy="14" r="11" fill="white" fillOpacity="0.9"/>
            {/* Smile arc */}
            <path d="M10 16 Q14 20 18 16" stroke="#e8a400" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
            {/* Eyes */}
            <circle cx="11" cy="12.5" r="1.2" fill="#e8a400"/>
            <circle cx="17" cy="12.5" r="1.2" fill="#e8a400"/>
            {/* Split line */}
            <line x1="14" y1="4" x2="14" y2="24" stroke="#f07c3a" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2"/>
          </svg>
        </div>
        <span className="sidebar-logo-text" style={{ background: 'linear-gradient(135deg, #e8a400, #f07c3a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Splito</span>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {navLinks.map(({ to, icon: Icon, label, badge }) => {
          const isActive = pathname === to || pathname.startsWith(to + '/');
          const showBadge = badge && count > 0;
          return (
            <button
              key={to}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
              onClick={() => navigate(to)}
            >
              <span style={{ position: 'relative', display: 'inline-flex' }}>
                <Icon size={20} />
                {showBadge && (
                  <span style={{
                    position: 'absolute', top: -5, right: -6,
                    width: count > 9 ? 18 : 16, height: 16,
                    background: 'var(--error)', borderRadius: 999,
                    fontSize: '0.625rem', fontWeight: 800, color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    lineHeight: 1, minWidth: 16,
                  }}>
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </span>
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Add Expense CTA */}
      <div className="sidebar-add-btn" style={{ position: 'relative', zIndex: 10 }}>
        <Link to="/add-expense" className="btn btn-primary" style={{ width: '100%', textDecoration: 'none' }}>
          <PlusCircle size={18} /> Add Expense
        </Link>
      </div>
    </aside>
  );
}
