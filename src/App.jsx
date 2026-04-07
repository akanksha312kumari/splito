import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import { useAuth } from './context/AuthContext';

import Splash from './pages/Splash';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import GroupDetail from './pages/GroupDetail';
import AddExpense from './pages/AddExpense';
import Insights from './pages/Insights';
import AIReport from './pages/AIReport';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import Settlement from './pages/Settlement';
import ReceiptScanner from './pages/ReceiptScanner';

function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg,#e8a400,#f07c3a)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 8px 24px rgba(232,164,0,0.35)' }}>
          <svg width="32" height="32" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="11" fill="white" fillOpacity="0.9"/>
            <path d="M10 16 Q14 20 18 16" stroke="#e8a400" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
            <circle cx="11" cy="12.5" r="1.2" fill="#e8a400"/>
            <circle cx="17" cy="12.5" r="1.2" fill="#e8a400"/>
            <line x1="14" y1="4" x2="14" y2="24" stroke="#f07c3a" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2"/>
          </svg>
        </div>
        <p style={{ color: 'var(--on-surface-muted)', fontSize: '0.9rem' }}>Loading Splito…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Routes>
          <Route path="/dashboard"     element={<Dashboard />} />
          <Route path="/group"         element={<GroupDetail />} />
          <Route path="/add-expense"   element={<AddExpense />} />
          <Route path="/insights"      element={<Insights />} />
          <Route path="/ai-report"     element={<AIReport />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile"       element={<Profile />} />
          <Route path="/settlement"    element={<Settlement />} />
          <Route path="/scanner"       element={<ReceiptScanner />} />
          <Route path="/*"             element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
      <BottomNav />
    </div>
  );
}

export default function App() {
  useEffect(() => {
    try {
      const settings = JSON.parse(localStorage.getItem('splito_settings')) || {};
      if (settings.dark_mode) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    } catch (e) {}
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/"    element={<Splash />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/*"   element={<ProtectedLayout />} />
      </Routes>
    </Router>
  );
}
