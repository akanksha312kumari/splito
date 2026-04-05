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
        <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,var(--primary),var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '1.5rem' }}>S</div>
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
