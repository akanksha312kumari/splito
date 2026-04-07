import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, LogOut, Edit2, X, Check, Bell, Moon, Sun, Shield, CreditCard, HelpCircle, Bot, Trash2 } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api/client';
import Skeleton, { SkeletonCard } from '../components/Skeleton';
import ErrorState from '../components/ErrorState';

/* ── Toggle Component ── */
function Toggle({ id, checked, onChange, label }) {
  return (
    <label htmlFor={id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 44, height: 24, borderRadius: 12, position: 'relative',
          background: checked ? 'var(--primary)' : 'var(--surface-high)',
          transition: 'background var(--transition)', flexShrink: 0,
          cursor: 'pointer',
        }}
      >
        <div style={{
          position: 'absolute', top: 3, left: checked ? 23 : 3, width: 18, height: 18,
          borderRadius: '50%', background: 'white',
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
          transition: 'left var(--transition)',
        }} />
      </div>
      {label && <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{label}</span>}
    </label>
  );
}

/* ── Edit Profile Modal ── */
function EditProfileModal({ currentName, currentPhone, onSave, onClose }) {
  const [name, setName] = useState(currentName || '');
  const [phone, setPhone] = useState(currentPhone || '');

  const submit = () => {
    if (name.trim().length < 2) return;
    onSave(name.trim(), phone.trim());
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="card animate-fade-up" style={{ width: '100%', maxWidth: 440, padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3>Edit Profile</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={20} /></button>
        </div>
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--on-surface-muted)', marginBottom: '6px' }}>Display Name</label>
          <input
            autoFocus
            type="text"
            className="input"
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--on-surface-muted)', marginBottom: '6px' }}>Phone Number (Optional)</label>
          <input
            type="tel"
            className="input"
            placeholder="e.g. +91 9876543210"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={submit} disabled={name.trim().length < 2}>
            <Check size={16} /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Settings Drawer ── */
function SettingsDrawer({ title, children, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 9000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div className="card animate-fade-up" style={{ width: '100%', maxWidth: 600, borderRadius: '24px 24px 0 0', padding: '2rem', paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Main Profile Page ── */
export default function Profile() {
  const navigate         = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const toast            = useToast();

  const { data: profile, loading, error, refetch } = useApi('/profile');
  const { data: activity }                          = useApi('/profile/activity');

  // Real settings from API
  const { data: settingsData, refetch: refetchSettings } = useApi('/settings');
  const [settings, setSettings] = useState({});

  useEffect(() => {
    if (settingsData) {
      setSettings(settingsData);
      // Apply theme immediately
      if (settingsData.dark_mode) document.documentElement.setAttribute('data-theme', 'dark');
      else document.documentElement.removeAttribute('data-theme');
    }
  }, [settingsData]);

  // Modal controls
  const [editingName, setEditingName]     = useState(false);
  const [activeDrawer, setActiveDrawer]   = useState(null); // 'notifications' | 'payment' | 'security' | 'ai' | 'help'
  const [savingName, setSavingName]       = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const xp          = profile?.xp ?? 0;
  const nextLevelXP = profile?.next_level_xp ?? 700;
  const progress    = Math.min(100, (xp / nextLevelXP) * 100);

  /* ── Setting helpers ── */
  const setSetting = async (key, value) => {
    // Optimistic update
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    
    if (key === 'dark_mode') {
      if (value) document.documentElement.setAttribute('data-theme', 'dark');
      else document.documentElement.removeAttribute('data-theme');
    }

    try {
      await api.put('/settings', { [key]: value });
      // Keep localStorage in sync as a fast-load cache for App.jsx
      localStorage.setItem('splito_settings', JSON.stringify(updated));
    } catch (e) {
      toast.error('Failed to save setting to cloud');
      refetchSettings(); // Rollback
    }
  };

  /* ── Save Profile ── */
  const handleSaveProfile = async (newName, newPhone) => {
    setSavingName(true);
    try {
      await api.put('/profile', { name: newName, phone: newPhone });
      await refreshUser();
      await refetch();
      toast.success('Profile updated');
      setEditingName(false);
    } catch (e) {
      toast.error(e.message || 'Could not update profile');
    } finally {
      setSavingName(false);
    }
  };

  /* ── Avatar Upload ── */
  const fileRef = useRef(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const handleAvatarUpload = async (file) => {
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append('avatar', file);
      await api.upload('/profile/avatar', form);
      await refreshUser();
      await refetch();
      toast.success('Profile photo updated');
    } catch (e) {
      toast.error(e.message || 'Avatar upload failed');
    } finally {
      setUploadingAvatar(false);
    }
  };

  /* ── Logout ── */
  const handleLogout = () => {
    logout();
    navigate('/auth');
    toast.success('Signed out successfully');
  };

  /* ── Setting rows config ── */
  const settingRows = [
    {
      id: 'notifications', icon: Bell, label: 'Notification preferences',
      preview: settings.notif_enabled !== false ? 'On' : 'Off',
      onClick: () => setActiveDrawer('notifications'),
    },
    {
      id: 'ai', icon: Bot, label: 'AI recommendations',
      preview: settings.ai_enabled !== false ? 'Enabled' : 'Disabled',
      onClick: () => setActiveDrawer('ai'),
    },
    {
      id: 'payment', icon: CreditCard, label: 'Payment methods',
      preview: settings.payment_method || 'UPI',
      onClick: () => setActiveDrawer('payment'),
    },
    {
      id: 'security', icon: Shield, label: 'Privacy & Security',
      onClick: () => setActiveDrawer('security'),
    },
    {
      id: 'theme', icon: settings.dark_mode ? Moon : Sun, label: 'Appearance',
      preview: settings.dark_mode ? 'Dark' : 'Light',
      onClick: () => {
        const newVal = !settings.dark_mode;
        setSetting('dark_mode', newVal);
        toast.info(newVal ? 'Dark mode enabled' : 'Light mode enabled');
      },
      isToggle: true, toggleKey: 'dark_mode',
    },
    {
      id: 'help', icon: HelpCircle, label: 'Help & Support',
      onClick: () => setActiveDrawer('help'),
    },
  ];

  return (
    <div className="page animate-fade-up">

      {/* ── Edit Profile Modal ── */}
      {editingName && (
        <EditProfileModal
          currentName={profile?.name || user?.name}
          currentPhone={profile?.phone || ''}
          onSave={handleSaveProfile}
          onClose={() => setEditingName(false)}
        />
      )}

      {/* ── Logout confirm ── */}
      {logoutConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div className="card animate-fade-up" style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>👋</div>
            <h3 style={{ marginBottom: '0.5rem' }}>Sign out?</h3>
            <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>You'll need to log in again to access Splito.</p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setLogoutConfirm(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1, background: 'var(--error)', boxShadow: 'none' }} onClick={handleLogout}>
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings Drawers ── */}
      {activeDrawer === 'notifications' && (
        <SettingsDrawer title="Notification Preferences" onClose={() => setActiveDrawer(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {[
              { key: 'notif_enabled',    label: 'Push notifications' },
              { key: 'notif_expense',    label: 'New expense alerts' },
              { key: 'notif_settlement', label: 'Settlement reminders' },
              { key: 'notif_ai',         label: 'AI spending insights' },
            ].map(({ key, label }) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 500 }}>{label}</span>
                <Toggle id={key} checked={settings[key] !== false} onChange={v => { setSetting(key, v); toast.success(`${label} ${v ? 'enabled' : 'disabled'}`); }} />
              </div>
            ))}
          </div>
        </SettingsDrawer>
      )}

      {activeDrawer === 'ai' && (
        <SettingsDrawer title="AI Recommendations" onClose={() => setActiveDrawer(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {[
              { key: 'ai_enabled',       label: 'Smart spending insights' },
              { key: 'ai_predictions',   label: 'Budget predictions' },
              { key: 'ai_suggestions',   label: 'Expense suggestions' },
              { key: 'ai_weekly_report', label: 'Weekly AI report' },
            ].map(({ key, label }) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 500 }}>{label}</span>
                <Toggle id={key} checked={settings[key] !== false} onChange={v => { setSetting(key, v); toast.success(`${label} ${v ? 'enabled' : 'disabled'}`); }} />
              </div>
            ))}
          </div>
        </SettingsDrawer>
      )}

      {activeDrawer === 'payment' && (
        <SettingsDrawer title="Payment Methods" onClose={() => setActiveDrawer(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {['UPI', 'Google Pay', 'PhonePe', 'Cash', 'Bank Transfer'].map(m => (
              <button
                key={m}
                onClick={() => { setSetting('payment_method', m); toast.success(`Default payment set to ${m}`); setActiveDrawer(null); }}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: settings.payment_method === m ? 'rgba(232,164,0,0.10)' : 'var(--surface-low)', border: `1.5px solid ${settings.payment_method === m ? 'var(--primary)' : 'transparent'}`, borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
              >
                <span>{m}</span>
                {settings.payment_method === m && <Check size={18} color="var(--primary)" />}
              </button>
            ))}
          </div>
        </SettingsDrawer>
      )}

      {activeDrawer === 'security' && (
        <SettingsDrawer title="Privacy & Security" onClose={() => setActiveDrawer(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontWeight: 500 }}>Two-factor authentication</p>
                <p className="text-muted" style={{ fontSize: '0.8125rem' }}>Extra security for your account</p>
              </div>
              <Toggle id="2fa" checked={!!settings.twofa} onChange={v => { setSetting('twofa', v); toast.info(v ? '2FA enabled (demo)' : '2FA disabled'); }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontWeight: 500 }}>Share expense data</p>
                <p className="text-muted" style={{ fontSize: '0.8125rem' }}>Allow anonymous analytics</p>
              </div>
              <Toggle id="analytics" checked={settings.analytics !== false} onChange={v => { setSetting('analytics', v); toast.info(v ? 'Analytics enabled' : 'Analytics disabled'); }} />
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid var(--surface-mid)' }} />
            <button
              className="btn btn-secondary"
              style={{ border: '1.5px solid var(--error)', color: 'var(--error)', background: 'rgba(239,68,68,0.04)' }}
              onClick={() => { setActiveDrawer(null); toast.error('Data deletion requested (demo — no action taken)'); }}
            >
              <Trash2 size={16} /> Request account deletion
            </button>
          </div>
        </SettingsDrawer>
      )}

      {activeDrawer === 'help' && (
        <SettingsDrawer title="Help & Support" onClose={() => setActiveDrawer(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              { label: '📖 Getting Started Guide',  action: () => toast.info('Opening guide (demo)') },
              { label: '💬 Chat with Support',       action: () => toast.info('Support chat coming soon') },
              { label: '🐛 Report a Bug',            action: () => toast.info('Bug report form (demo)') },
              { label: '⭐ Rate on App Store',       action: () => toast.info('Opening App Store (demo)') },
              { label: '📋 Terms & Privacy Policy',  action: () => toast.info('Opening terms (demo)') },
            ].map(({ label, action }) => (
              <button key={label} onClick={() => { action(); }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--surface-low)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.9375rem', textAlign: 'left' }}>
                {label} <ChevronRight size={16} color="var(--on-surface-faint)" />
              </button>
            ))}
          </div>
        </SettingsDrawer>
      )}

      {/* ── Header ── */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem' }}>Profile</h1>
      </header>

      {loading ? (
        <>
          <SkeletonCard lines={3} style={{ marginBottom: '1.5rem', minHeight: 120 }} />
          <SkeletonCard lines={2} style={{ marginBottom: '1.5rem' }} />
        </>
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <>
          {/* ── User card ── */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem', padding: '2rem', background: 'linear-gradient(135deg, rgba(232,164,0,0.07), rgba(240,124,58,0.05))' }}>
            <div
              className="avatar avatar-xl"
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))', boxShadow: '0 8px 28px rgba(232,164,0,0.30)', flexShrink: 0, position: 'relative', cursor: 'pointer', overflow: 'hidden' }}
              onClick={() => fileRef.current?.click()}
              title="Change Profile Photo"
            >
              {profile?.avatar ? (
                <img src={profile.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                (profile?.name?.[0] || user?.name?.[0] || 'A').toUpperCase()
              )}
              {uploadingAvatar && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 16, height: 16, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                </div>
              )}
            </div>
            <input type="file" ref={fileRef} accept="image/*" style={{ display: 'none' }} onChange={e => handleAvatarUpload(e.target.files?.[0])} />
            
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
                <h2 style={{ fontSize: '1.375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profile?.name || user?.name || 'User'}
                </h2>
                <button
                  id="edit-profile-btn"
                  className="btn btn-ghost"
                  style={{ padding: '4px 8px', borderRadius: 8, flexShrink: 0 }}
                  onClick={() => setEditingName(true)}
                  title="Edit profile"
                >
                  <Edit2 size={14} />
                </button>
                {savingName && <span style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>Saving…</span>}
              </div>
              <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: profile?.phone ? '2px' : '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.email || user?.email}</p>
              {profile?.phone && <p className="text-muted" style={{ fontSize: '0.8125rem', marginBottom: '0.75rem', fontWeight: 500 }}>📱 {profile.phone}</p>}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span className="badge badge-primary">Level {profile?.level ?? 1} Splitter</span>
                <span className="badge badge-success">{profile?.badges?.filter(b => b.earned).length ?? 0} Badges</span>
              </div>
            </div>
          </div>

          {/* ── Activity stats ── */}
          {activity && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {[
                { label: 'Paid for', value: activity.expenses_paid },
                { label: 'Groups',   value: activity.groups },
                { label: 'Settled',  value: activity.settled },
              ].map(s => (
                <div key={s.label} className="card" style={{ textAlign: 'center', padding: '1rem' }}>
                  <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>{s.value}</p>
                  <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '2px' }}>{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── XP Progress ── */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
              <div>
                <p style={{ fontWeight: 700, marginBottom: '2px' }}>Level {profile?.level ?? 1} → Level {(profile?.level ?? 1) + 1}</p>
                <p className="text-muted" style={{ fontSize: '0.8125rem' }}>{(profile?.xp_to_next ?? 0).toLocaleString('en-IN')} XP to go</p>
              </div>
              <span style={{ fontWeight: 800, fontSize: '1.125rem', color: 'var(--primary)' }}>
                {xp.toLocaleString('en-IN')} XP
              </span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: progress + '%', transition: 'width 1s cubic-bezier(0.4,0,0.2,1)' }} />
            </div>
          </div>

          {/* ── Badges ── */}
          {profile?.badges && (
            <div style={{ marginBottom: '2rem' }}>
              <div className="section-header"><h3>Badges</h3></div>
              <div className="desktop-grid-2">
                {profile.badges.map(b => (
                  <div key={b.key} className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', opacity: b.earned ? 1 : 0.5, position: 'relative', overflow: 'hidden' }}>
                    {!b.earned && <span style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', fontSize: '0.75rem', color: 'var(--on-surface-faint)', fontWeight: 600 }}>🔒 Locked</span>}
                    <div style={{ fontSize: '2rem', flexShrink: 0 }}>{b.icon}</div>
                    <div>
                      <p style={{ fontWeight: 700, marginBottom: '2px' }}>{b.title}</p>
                      <p className="text-muted" style={{ fontSize: '0.8125rem', lineHeight: 1.5 }}>{b.description}</p>
                      {b.earned && (
                        <span className="badge badge-success" style={{ marginTop: '0.5rem', display: 'inline-flex' }}>
                          ✓ Earned{b.earned_at ? ` · ${new Date(b.earned_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Settings list ── */}
          <div>
            <div className="section-header"><h3>Settings</h3></div>
            <div className="card" style={{ padding: '0 1.5rem' }}>
              {settingRows.map(s => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.id}
                    id={`setting-${s.id}`}
                    className="expense-row"
                    onClick={s.onClick}
                    style={{ cursor: 'pointer', justifyContent: 'space-between', transition: 'background var(--transition)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface-low)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={18} color="var(--primary)" />
                      </div>
                      <span style={{ fontWeight: 500 }}>{s.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {s.preview && <span className="text-muted" style={{ fontSize: '0.8125rem' }}>{s.preview}</span>}
                      {s.isToggle ? (
                        <Toggle id={`toggle-${s.id}`} checked={!!settings[s.toggleKey]} onChange={v => { setSetting(s.toggleKey, v); }} />
                      ) : (
                        <ChevronRight size={18} color="var(--on-surface-faint)" />
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Sign out row */}
              <div
                id="signout-btn"
                className="expense-row"
                onClick={() => setLogoutConfirm(true)}
                style={{ cursor: 'pointer', justifyContent: 'space-between', borderBottom: 'none', color: 'var(--error)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <LogOut size={18} color="var(--error)" />
                  </div>
                  <span style={{ fontWeight: 600 }}>Sign Out</span>
                </div>
                <ChevronRight size={18} color="var(--error)" />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
