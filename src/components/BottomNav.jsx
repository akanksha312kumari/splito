import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Scan, PlusCircle, Bell, User } from 'lucide-react';
import { useNotifCount } from '../hooks/useNotifCount';

const items = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Home' },
  { to: '/scanner',       icon: Scan,            label: 'Scan' },
  null, // FAB placeholder
  { to: '/notifications', icon: Bell,            label: 'Alerts', badge: true },
  { to: '/profile',       icon: User,            label: 'Profile' },
];

export default function BottomNav() {
  const navigate  = useNavigate();
  const { pathname } = useLocation();
  const { count }    = useNotifCount();

  return (
    <nav className="bottom-nav">
      {items.map((item, i) => {
        if (!item) return (
          <button key="fab" className="bottom-nav-fab" onClick={() => navigate('/add-expense')}>
            <PlusCircle size={26} />
          </button>
        );

        const Icon     = item.icon;
        const isActive = pathname === item.to;
        const showBadge = item.badge && count > 0;

        return (
          <button
            key={item.to}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => navigate(item.to)}
          >
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <Icon size={22} />
              {showBadge && (
                <span style={{
                  position: 'absolute', top: -4, right: -5,
                  width: 14, height: 14, background: 'var(--error)',
                  borderRadius: 999, fontSize: '0.5625rem', fontWeight: 800,
                  color: 'white', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', lineHeight: 1, minWidth: 14,
                }}>
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
