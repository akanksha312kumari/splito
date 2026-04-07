import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Sparkles, PlusCircle, Users, X, Check, UserPlus, LogOut, MessageCircle, Send, Image as ImageIcon, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import Skeleton, { SkeletonCard } from '../components/Skeleton';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import GroupChat from '../components/GroupChat';

/* ─── Create Group Modal ─── */
const EMOJIS = ['👥', '🏠', '✈️', '🎉', '🍕', '🚕', '🏖️', '💼', '🎮', '🏃'];

function CreateGroupModal({ onCreated, onClose }) {
  const toast = useToast();
  const [name,       setName]       = useState('');
  const [emoji,      setEmoji]      = useState('👥');
  const [emailInput, setEmailInput] = useState('');
  const [members,    setMembers]    = useState([]);
  const [saving,     setSaving]     = useState(false);

  const addMember = () => {
    const e = emailInput.trim().toLowerCase();
    if (e && !members.includes(e)) {
      setMembers([...members, e]);
      setEmailInput('');
    }
  };

  const removeMember = (email) => {
    setMembers(members.filter(m => m !== email));
  };

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const g = await api.post('/groups', { name: name.trim(), emoji });
      
      // Add members
      const addPromises = members.map(async (email) => {
        try {
          await api.post(`/groups/${g.id}/members`, { email });
        } catch (err) {
          console.error(`Failed to add ${email}:`, err);
          toast.error(`Could not add ${email}: User not found`);
        }
      });
      await Promise.all(addPromises);

      toast.success('Group created successfully');
      onCreated(g);
    } catch (e) {
      toast.error(e.message || 'Could not create group');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="card animate-fade-up" style={{ width: '100%', maxWidth: 460, padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3>Create New Group</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Emoji picker */}
        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface-muted)', marginBottom: '0.625rem' }}>Choose an emoji</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          {EMOJIS.map(e => (
            <button key={e} onClick={() => setEmoji(e)} style={{ fontSize: '1.5rem', width: 44, height: 44, borderRadius: 'var(--radius-md)', border: `2px solid ${emoji === e ? 'var(--primary)' : 'transparent'}`, background: emoji === e ? 'rgba(232,164,0,0.12)' : 'var(--surface-low)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all var(--transition)' }}>
              {e}
            </button>
          ))}
        </div>

        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface-muted)', marginBottom: '0.5rem' }}>Group name</p>
        <input
          autoFocus
          type="text"
          placeholder="e.g. Goa Trip, Flat Mates…"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          style={{ marginBottom: '1.5rem' }}
        />

        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface-muted)', marginBottom: '0.5rem' }}>Add Members (Emails)</p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
          <input
            type="email"
            placeholder="friend@splito.app"
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addMember(); }}
          />
          <button className="btn btn-secondary" onClick={addMember} disabled={!emailInput.trim()}>Add</button>
        </div>

        {members.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '1.5rem' }}>
            {members.map(m => (
              <div key={m} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--surface-low)', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8125rem', fontWeight: 500 }}>
                {m}
                <button
                  onClick={() => removeMember(m)}
                  style={{ background: 'none', border: 'none', color: 'var(--on-surface-faint)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2 }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.875rem', marginTop: members.length > 0 ? 0 : '1.5rem' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={submit} disabled={saving || !name.trim()}>
            {saving ? 'Creating…' : <><Check size={16} /> Create Group</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Add Member Modal ─── */
function AddMemberModal({ groupId, onAdded, onClose }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!email.trim() || !email.includes('@')) return;
    setSaving(true);
    try {
      await api.post(`/groups/${groupId}/members`, { email: email.trim().toLowerCase() });
      toast.success('Member added successfully!');
      onAdded();
    } catch (e) {
      toast.error(e.message || 'Could not add member (Make sure they exist).');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="card animate-fade-up" style={{ width: '100%', maxWidth: 400, padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3>Add New Member</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={20} /></button>
        </div>
        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface-muted)', marginBottom: '0.5rem' }}>Member's Email</p>
        <input
          autoFocus
           type="email"
          placeholder="friend@splito.app"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          style={{ marginBottom: '1.5rem' }}
        />
        <div style={{ display: 'flex', gap: '0.875rem' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={submit} disabled={saving || !email.trim()}>
            {saving ? 'Adding…' : <><UserPlus size={16} /> Add Member</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Groups List (no ID) ─── */
function GroupsList() {
  const navigate = useNavigate();
  const toast    = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const { data: groups = [], loading, error, refetch } = useApi('/groups', [], 'balance_update');

  const handleCreated = (g) => {
    setShowCreate(false);
    refetch();
    navigate(`/group?id=${g.id}`);
  };

  return (
    <div className="page animate-fade-up">
      {showCreate && <CreateGroupModal onCreated={handleCreated} onClose={() => setShowCreate(false)} />}

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '4px' }}>Groups</h1>
          <p className="text-muted">Manage your expense groups</p>
        </div>
        <button id="create-group-btn" className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
          <PlusCircle size={16} /> New Group
        </button>
      </header>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[1,2,3].map(i => <SkeletonCard key={i} lines={2} />)}
        </div>
      )}

      {error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && !error && groups.length === 0 && (
        <EmptyState
          icon="👥"
          title="No groups yet"
          subtitle="Create a group to start splitting expenses with friends, roommates, or travel buddies."
          action={<button id="first-group-btn" className="btn btn-primary" onClick={() => setShowCreate(true)}><PlusCircle size={18} /> Create Your First Group</button>}
        />
      )}

      {!loading && groups.map(g => (
        <div
          key={g.id}
          className="card card-clickable"
          onClick={() => navigate(`/group?id=${g.id}`)}
          style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1rem' }}
        >
          <div style={{ fontSize: '1.75rem', width: 48, height: 48, borderRadius: 'var(--radius-md)', background: 'var(--surface-low)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {g.emoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 700, fontSize: '1.0625rem', marginBottom: '2px' }}>{g.name}</p>
            <p className="text-muted" style={{ fontSize: '0.875rem' }}>{g.member_count} members · {g.expense_count} expenses</p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontWeight: 800, fontSize: '1.125rem', color: g.net_balance >= 0 ? 'var(--success)' : 'var(--error)' }}>
              {g.net_balance >= 0 ? '+' : ''}₹{Math.abs(g.net_balance).toLocaleString('en-IN')}
            </p>
            <p style={{ fontSize: '0.75rem', color: g.net_balance >= 0 ? 'var(--success)' : 'var(--error)' }}>
              {g.net_balance >= 0 ? 'owed to you' : 'you owe'}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Group Detail (has ID) ─── */
function GroupDetailView({ groupId }) {
  const navigate   = useNavigate();
  const location   = useLocation();
  const toast      = useToast();
  const { user }   = useAuth();
  
  const [showAddMember, setShowAddMember] = useState(false);
  const [activeTab, setActiveTab] = useState('expenses'); // expenses, balances, members, chat

  const { data: group, loading, error, refetch } = useApi(groupId ? `/groups/${groupId}` : null, [groupId], 'balance_update');
  const { data: balances, refetch: refetchBalances } = useApi(groupId ? `/groups/${groupId}/balances` : null, [groupId], 'balance_update');
  const { data: suggestions } = useApi('/ai/suggestions');
  const groupSuggestion = suggestions?.find(s => s.group_id === groupId);

  // Auto-refresh data when navigating back after adding an expense
  useEffect(() => {
    if (location.state?.expenseAdded) {
      refetch();
      refetchBalances();
      toast.success('Expense added to this group! ✓');
      window.history.replaceState({}, '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLeave = async () => {
    if (!window.confirm(`Are you sure you want to leave ${group?.name || 'this group'}?`)) return;
    try {
      await api.delete(`/groups/${groupId}/members/${user.id}`);
      toast.success('You have left the group.');
      navigate('/group');
    } catch (e) {
      toast.error(e.message || 'Failed to leave the group.');
    }
  };

  const handleRoleChange = async (memberId, newRole) => {
    try {
      await api.put(`/groups/${groupId}/members/${memberId}/role`, { role: newRole });
      toast.success('Role updated');
      refetch();
    } catch (e) {
      toast.error(e.message || 'Could not change role');
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Remove this member from the group?')) return;
    try {
      await api.delete(`/groups/${groupId}/members/${memberId}`);
      toast.success('Member removed');
      refetch();
    } catch (e) {
      toast.error(e.message || 'Could not remove member');
    }
  };

  const currentUserRole = group?.members?.find(m => m.id === user?.id)?.role;
  const isAdmin = group?.created_by === user?.id || currentUserRole === 'admin';

  if (loading) return (
    <div className="page animate-fade-up">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <Skeleton width={44} height={44} radius="var(--radius-md)" />
        <div style={{ flex: 1 }}><Skeleton width="50%" height={22} /><Skeleton width="35%" height={14} style={{ marginTop: 6 }} /></div>
      </div>
      <SkeletonCard lines={3} style={{ marginBottom: '1.5rem' }} />
      <SkeletonCard lines={4} />
    </div>
  );

  if (error) return <div className="page"><ErrorState message={error} onRetry={refetch} /></div>;
  if (!group) return <div className="page"><EmptyState icon="🔍" title="Group not found" action={<button className="btn btn-secondary btn-sm" onClick={() => navigate('/group')}>← All Groups</button>} /></div>;

  return (
    <div className="page animate-fade-up">
      {showAddMember && (
        <AddMemberModal 
          groupId={groupId} 
          onClose={() => setShowAddMember(false)} 
          onAdded={() => {
            setShowAddMember(false);
            refetch();
            refetchBalances();
          }}
        />
      )}
      <header style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button className="btn btn-ghost btn-icon" onClick={() => navigate('/group')}><ArrowLeft size={22} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: '1.375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.emoji} {group.name}</h2>
          <p className="text-muted" style={{ fontSize: '0.8125rem' }}>
            {group.member_count} members · {group.expense_count} expenses
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => navigate(`/settlement?group=${groupId}`)}>
          Settle Up
        </button>
      </header>

      {/* Group Actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '2rem' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowAddMember(true)}>
          <UserPlus size={16} /> Add Member
        </button>
        <button className="btn btn-secondary btn-sm" style={{ color: 'var(--error)', borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.04)' }} onClick={handleLeave}>
          <LogOut size={16} /> Leave Group
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid var(--surface-mid)', marginBottom: '1.5rem', overflowX: 'auto', whiteSpace: 'nowrap' }}>
        {[
          { id: 'expenses', label: 'Expenses' },
          { id: 'balances', label: 'Balances' },
          { id: 'members', label: `Members (${group.members?.length || 0})` },
          { id: 'chat', label: 'Chat' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '0.75rem 0', fontWeight: 600, fontSize: '0.9375rem',
              borderBottom: `2.5px solid ${activeTab === t.id ? 'var(--primary)' : 'transparent'}`,
              color: activeTab === t.id ? 'var(--on-surface)' : 'var(--on-surface-muted)',
              background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
              cursor: 'pointer', transition: 'all 0.2s ease'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'expenses' && (
        <div className="animate-fade-up">
          {groupSuggestion && (
            <div className="ai-card" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div className="ai-icon-wrap" style={{ flexShrink: 0 }}><Sparkles size={18} /></div>
              <div>
                <p style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.875rem', marginBottom: '4px' }}>AI Detected Pattern</p>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>{groupSuggestion.message}</p>
              </div>
            </div>
          )}

          <div className="section-header" style={{ marginBottom: '1rem' }}>
            <h3>Recent Expenses</h3>
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { refetch(); refetchBalances(); toast.info('Refreshed'); }} title="Refresh">↻</button>
              <button id="add-expense-btn" className="btn btn-secondary btn-sm" onClick={() => navigate('/add-expense', { state: { prefill: { groupId } } })}>
                <PlusCircle size={14} /> Add
              </button>
            </div>
          </div>

          {group.expenses?.length === 0 ? (
            <EmptyState
              icon="💸" title="No expenses yet" subtitle="Add the first expense for this group!"
              action={<button id="add-first-expense-btn" className="btn btn-primary btn-sm" onClick={() => navigate('/add-expense', { state: { prefill: { groupId } } })}>+ Add Expense</button>}
            />
          ) : (
            <div className="card" style={{ padding: '0 1.5rem' }}>
              {group.expenses?.map(e => (
                <div key={e.id} className="expense-row">
                  <div className="expense-icon">{e.emoji || '💸'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</p>
                    <p className="text-muted" style={{ fontSize: '0.8125rem' }}>Paid by {e.paid_by_name}</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontWeight: 700 }}>₹{e.amount.toLocaleString('en-IN')}</p>
                    <p className="text-muted" style={{ fontSize: '0.75rem' }}>{new Date(e.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'balances' && (
        <div className="animate-fade-up">
          <div className="card" style={{
            background: group.net_balance >= 0
              ? 'linear-gradient(135deg, rgba(232,164,0,0.08), rgba(240,124,58,0.05))'
              : 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(249,115,22,0.06))',
            border: `1.5px solid ${group.net_balance >= 0 ? 'rgba(232,164,0,0.2)' : 'rgba(239,68,68,0.2)'}`,
            marginBottom: '1.5rem'
          }}>
            <p className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '2px' }}>
              {group.net_balance >= 0 ? 'You are owed' : 'You owe'}
            </p>
            <p style={{ fontSize: '1.75rem', fontWeight: 800, color: group.net_balance >= 0 ? 'var(--primary)' : 'var(--error)' }}>
              ₹{Math.abs(group.net_balance).toLocaleString('en-IN')}
            </p>
          </div>

          {balances?.length > 0 ? (
            <div className="card">
              <p style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '1rem' }}>Group Member Balances</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {balances.map(b => (
                  <div key={b.user_id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--surface-low)' }}>
                    <div className="avatar avatar-sm" style={{ background: `hsl(${(b.name?.charCodeAt(0) || 0) * 37 % 360}, 60%, 55%)` }}>
                      {b.name?.[0] || '?'}
                    </div>
                    <span style={{ flex: 1, fontWeight: 500 }}>{b.name} {b.user_id === user.id && '(You)'}</span>
                    <span style={{ fontWeight: 700, color: b.balance === 0 ? 'var(--on-surface)' : (b.balance > 0 ? 'var(--primary)' : 'var(--error)'), fontSize: '0.9375rem' }}>
                      {b.balance > 0 ? '+' : ''}₹{Math.abs(b.balance).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState icon="⚖️" title="All Settled Up" subtitle="There are no pending balances in this group." />
          )}
        </div>
      )}

      {activeTab === 'members' && (
        <div className="animate-fade-up card" style={{ padding: '0 1.5rem' }}>
          {group.members?.map(m => (
            <div key={m.id} className="expense-row" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="avatar avatar-sm" style={{ background: m.avatar ? 'none' : `hsl(${(m.name?.charCodeAt(0) || 0) * 37 % 360}, 60%, 55%)` }}>
                {m.avatar ? <img src={m.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (m.name?.[0] || '?')}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: '0.9375rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {m.name} {m.id === user.id && '(You)'}
                  {m.role === 'admin' && <span className="badge badge-primary" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>Admin</span>}
                </p>
                <p className="text-muted" style={{ fontSize: '0.8125rem' }}>{m.email}</p>
              </div>

              {/* Member Actions (only if current user is admin and the targeted user is NOT the creator to prevent locking out) */}
              {isAdmin && m.id !== group.created_by && m.id !== user.id && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select
                    className="input"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', height: 'auto', background: 'var(--surface-high)' }}
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.id, e.target.value)}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button className="btn btn-ghost btn-icon" style={{ color: 'var(--error)' }} onClick={() => handleRemoveMember(m.id)} title="Remove Member">
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'chat' && (
        <GroupChat groupId={groupId} />
      )}
    </div>
  );
}

/* ─── Router: show list or detail based on ?id param ─── */
export default function GroupDetail() {
  const [params] = useSearchParams();
  const groupId  = params.get('id') || '';

  return groupId ? <GroupDetailView groupId={groupId} /> : <GroupsList />;
}
