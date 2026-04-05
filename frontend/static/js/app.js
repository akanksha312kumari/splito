const API_URL = "https://splito-nghk.onrender.com";
/**
 * Splito — Main App Logic (SPA)
 * Handles routing, rendering, state, and UI interactions.
 */

/* ════════════════════════════════════════════════════════════════════════════
   STATE
════════════════════════════════════════════════════════════════════════════ */
const State = {
  user: null,
  groups: [],
  currentGroup: null,
  chartInstances: {},
};

/* ════════════════════════════════════════════════════════════════════════════
   UTILS
════════════════════════════════════════════════════════════════════════════ */
const fmt = (n) => '₹' + parseFloat(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function categoryEmoji(cat) {
  const map = {
    'Food & Dining': '🍕', 'Transport': '🚗', 'Housing': '🏠',
    'Entertainment': '🎉', 'Shopping': '🛒', 'Travel': '✈️',
    'Utilities': '💡', 'Healthcare': '💊', 'Other': '📦'
  };
  return map[cat] || '📦';
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 3000);
}

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

/* ════════════════════════════════════════════════════════════════════════════
   ROUTER
════════════════════════════════════════════════════════════════════════════ */
function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const view = document.getElementById(`view-${viewId}`);
  if (view) view.classList.add('active');

  const nav = document.querySelector(`[data-view="${viewId}"]`);
  if (nav) nav.classList.add('active');

  // Lazy load
  if (viewId === 'dashboard') loadDashboard();
  if (viewId === 'groups') loadGroups();
  if (viewId === 'expenses') loadAllExpenses();
  if (viewId === 'analytics') loadAnalytics();
  if (viewId === 'insights') loadInsights();
}

/* ════════════════════════════════════════════════════════════════════════════
   AUTH
════════════════════════════════════════════════════════════════════════════ */
function showAuth() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  setupUser();
  showView('dashboard');
}

function setupUser() {
  const user = Auth.getUser();
  if (!user) return;
  State.user = user;

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('dashboard-greeting').textContent = `${greet}, ${user.username.split(' ')[0]} 👋`;
  document.getElementById('sidebar-name').textContent = user.username;

  const av = document.getElementById('sidebar-avatar');
  av.textContent = initials(user.username);
  av.style.background = user.avatar_color || '#6366f1';
}

/* ════════════════════════════════════════════════════════════════════════════
   DASHBOARD
════════════════════════════════════════════════════════════════════════════ */
async function loadDashboard() {
  try {
    const [groupsRes, expensesRes, insightsRes] = await Promise.all([
      GroupsAPI.list(),
      ExpensesAPI.list(),
      InsightsAPI.get(),
    ]);

    State.groups = groupsRes.groups || [];
    const stats = insightsRes.personal_stats || {};

    // Stat cards
    document.getElementById('stat-owed').textContent = fmt(stats.total_owed_to_me);
    document.getElementById('stat-iowe').textContent = fmt(stats.total_i_owe);
    document.getElementById('stat-paid').textContent = fmt(stats.total_paid_30d);
    document.getElementById('stat-groups').textContent = stats.active_groups || 0;

    // AI banner (first high-priority insight)
    const highIns = (insightsRes.insights || []).find(i => i.priority === 'high');
    if (highIns) {
      document.getElementById('ai-banner-text').textContent = highIns.message;
      document.getElementById('ai-banner').style.display = 'flex';
    }

    // Recent expenses
    renderRecentExpenses(expensesRes.expenses || []);

    // Groups
    renderDashboardGroups(State.groups);

  } catch (e) {
    console.error('Dashboard load error:', e);
  }
}

function renderRecentExpenses(expenses) {
  const el = document.getElementById('recent-expenses-list');
  if (!expenses.length) { el.innerHTML = '<div class="empty-state">No expenses yet. Add one!</div>'; return; }

  el.innerHTML = expenses.slice(0, 8).map(e => `
    <div class="tx-item">
      <div class="tx-icon">${categoryEmoji(e.category)}</div>
      <div class="tx-info">
        <div class="tx-title">${e.title}</div>
        <div class="tx-meta">${e.paid_by_name} · ${timeAgo(e.created_at)}</div>
      </div>
      <div class="tx-amount neutral">${fmt(e.amount)}</div>
    </div>
  `).join('');
}

function renderDashboardGroups(groups) {
  const el = document.getElementById('dashboard-groups-list');
  if (!groups.length) { el.innerHTML = '<div class="empty-state">No groups yet.</div>'; return; }

  el.innerHTML = groups.map(g => {
    const bal = g.my_balance || 0;
    const balCls = bal > 0 ? 'positive' : bal < 0 ? 'negative' : 'zero';
    const balTxt = bal > 0 ? `+${fmt(bal)}` : bal < 0 ? fmt(bal) : '✓ Settled';
    return `
      <div class="group-mini-item" onclick="openGroupDetail('${g.id}')">
        <div class="group-mini-icon">${g.icon}</div>
        <div class="group-mini-info">
          <div class="group-mini-name">${g.name}</div>
          <div class="group-mini-members">${g.member_count} members</div>
        </div>
        <div class="group-mini-bal ${balCls}">${balTxt}</div>
      </div>
    `;
  }).join('');
}

/* ════════════════════════════════════════════════════════════════════════════
   GROUPS
════════════════════════════════════════════════════════════════════════════ */
async function loadGroups() {
  const grid = document.getElementById('groups-grid');
  grid.innerHTML = '<div class="empty-state card skeleton" style="height:120px"></div>'.repeat(3);

  try {
    const res = await GroupsAPI.list();
    State.groups = res.groups || [];
    renderGroupsGrid(State.groups);
  } catch (e) {
    grid.innerHTML = `<div class="empty-state card">Failed to load groups. ${e.message}</div>`;
  }
}

function renderGroupsGrid(groups) {
  const grid = document.getElementById('groups-grid');
  if (!groups.length) {
    grid.innerHTML = `
      <div class="card" style="grid-column:1/-1;text-align:center;padding:60px">
        <div style="font-size:48px;margin-bottom:16px">👥</div>
        <h3 style="margin-bottom:8px">No groups yet</h3>
        <p style="color:var(--text-2);margin-bottom:20px">Create a group or join one with an invite code.</p>
      </div>`;
    return;
  }

  grid.innerHTML = groups.map(g => {
    const bal = g.my_balance || 0;
    const balCls = bal > 0 ? 'positive' : bal < 0 ? 'negative' : 'zero';
    const balTxt = bal > 0 ? `You're owed ${fmt(bal)}` : bal < 0 ? `You owe ${fmt(Math.abs(bal))}` : 'All settled ✓';
    return `
      <div class="group-card" onclick="openGroupDetail('${g.id}')">
        <div class="group-card-icon">${g.icon}</div>
        <div class="group-card-name">${g.name}</div>
        <div class="group-card-desc">${g.description || 'No description'}</div>
        <div class="group-card-footer">
          <span class="group-meta">${g.member_count} members · ${g.role}</span>
          <span class="group-balance ${balCls}">${balTxt}</span>
        </div>
      </div>
    `;
  }).join('');
}

async function openGroupDetail(groupId) {
  showView('group-detail');
  const content = document.getElementById('group-detail-content');
  content.innerHTML = '<div class="empty-state">Loading…</div>';

  try {
    const [res, balRes] = await Promise.all([
      GroupsAPI.get(groupId),
      GroupsAPI.balances(groupId),
    ]);
    State.currentGroup = res.group;
    renderGroupDetail(res, balRes);

    // Wire add expense button
    document.getElementById('add-expense-group-btn').onclick = () => openAddExpenseModal(groupId);
  } catch (e) {
    content.innerHTML = `<div class="empty-state">${e.message}</div>`;
  }
}

function renderGroupDetail(res, balRes) {
  const g = res.group;
  const members = res.members || [];
  const expenses = res.recent_expenses || [];
  const balances = balRes.balances || [];
  const suggested = balRes.suggested_payments || [];

  const totalSpend = expenses.reduce((s, e) => s + e.amount, 0);

  const content = document.getElementById('group-detail-content');
  content.innerHTML = `
    <div class="group-detail-hero">
      <div class="group-detail-icon">${g.icon}</div>
      <div class="group-detail-info">
        <h2>${g.name}</h2>
        <p>${g.description || 'No description'}</p>
        <div class="group-detail-stats">
          <div class="gd-stat"><div class="gd-stat-val">${fmt(totalSpend)}</div><div class="gd-stat-label">Total Spend</div></div>
          <div class="gd-stat"><div class="gd-stat-val">${members.length}</div><div class="gd-stat-label">Members</div></div>
          <div class="gd-stat"><div class="gd-stat-val">${expenses.length}</div><div class="gd-stat-label">Expenses</div></div>
        </div>
        <div style="margin-top:14px">
          <div class="invite-chip" onclick="copyInvite('${g.invite_code}')">
            🔗 Invite Code: <span class="invite-code">${g.invite_code}</span>
            <span style="font-size:11px;color:var(--text-3)">Click to copy</span>
          </div>
        </div>
      </div>
    </div>

    <div class="two-col">
      <!-- Balances -->
      <div>
        <div class="balances-section">
          <h3>💰 Balances</h3>
          ${balances.map(b => {
    const cls = b.balance > 0 ? 'pos' : b.balance < 0 ? 'neg' : 'zero';
    const txt = b.balance > 0 ? `+${fmt(b.balance)}` : b.balance < 0 ? fmt(b.balance) : 'Settled';
    return `
              <div class="balance-row">
                <div class="balance-user">
                  <div class="avatar" style="background:${_randColor(b.user_id)}">${initials(b.username)}</div>
                  ${b.username}
                </div>
                <span class="balance-amount ${cls}">${txt}</span>
              </div>
            `;
  }).join('') || '<div style="color:var(--text-3);font-size:13px">No balance data</div>'}
        </div>

        ${suggested.length ? `
          <div class="balances-section">
            <h3>✅ Suggested Payments</h3>
            ${suggested.map(p => `
              <div class="payment-suggestion">
                <div class="avatar" style="width:28px;height:28px;font-size:11px;background:${_randColor(p.from_id)}">${initials(p.from_name)}</div>
                <span>${p.from_name}</span>
                <span class="payment-arrow">→</span>
                <div class="avatar" style="width:28px;height:28px;font-size:11px;background:${_randColor(p.to_id)}">${initials(p.to_name)}</div>
                <span>${p.to_name}</span>
                <span class="payment-amount">${fmt(p.amount)}</span>
                <button class="record-payment-btn" onclick="recordPayment('${g.id}','${p.from_id}','${p.to_id}',${p.amount})">Record</button>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>

      <!-- Recent expenses -->
      <div class="card">
        <div class="card-header">
          <h3>Recent Expenses</h3>
        </div>
        <div class="tx-list">
          ${expenses.length ? expenses.map(e => `
            <div class="tx-item">
              <div class="tx-icon">${categoryEmoji(e.category)}</div>
              <div class="tx-info">
                <div class="tx-title">${e.title}</div>
                <div class="tx-meta">${e.paid_by_name} paid · ${timeAgo(e.created_at)}</div>
              </div>
              <div class="tx-amount neutral">${fmt(e.amount)}</div>
            </div>
          `).join('') : '<div class="empty-state">No expenses yet</div>'}
        </div>
      </div>
    </div>
  `;
}

function _randColor(seed = '') {
  const colors = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#10b981', '#3b82f6'];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

function copyInvite(code) {
  navigator.clipboard.writeText(code).then(() => showToast(`Invite code ${code} copied!`));
}

async function recordPayment(groupId, payerId, payeeId, amount) {
  try {
    await PaymentsAPI.record({ group_id: groupId, payee_id: payeeId, amount });
    showToast('Payment recorded!');
    openGroupDetail(groupId);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   EXPENSES
════════════════════════════════════════════════════════════════════════════ */
async function loadAllExpenses() {
  const el = document.getElementById('expenses-list');
  el.innerHTML = '<div class="empty-state">Loading…</div>';

  try {
    const res = await ExpensesAPI.list();
    renderExpensesTable(res.expenses || [], el);
  } catch (e) {
    el.innerHTML = `<div class="empty-state">${e.message}</div>`;
  }
}

function renderExpensesTable(expenses, container) {
  if (!expenses.length) {
    container.innerHTML = '<div class="empty-state">No expenses yet. Start by adding one!</div>';
    return;
  }

  container.innerHTML = `
    <div class="expenses-table">
      <div class="expenses-header">
        <span>Expense</span>
        <span>Amount</span>
        <span>Category</span>
        <span>Paid by</span>
        <span></span>
      </div>
      ${expenses.map(e => `
        <div class="expense-row">
          <div>
            <div style="font-weight:600">${e.title}</div>
            <div style="font-size:12px;color:var(--text-3)">${timeAgo(e.created_at)}</div>
          </div>
          <div style="font-family:'Syne',sans-serif;font-weight:700">${fmt(e.amount)}</div>
          <div><span class="expense-cat-tag">${categoryEmoji(e.category)} ${e.category}</span></div>
          <div style="font-size:13px;color:var(--text-2)">${e.paid_by_name}</div>
          <div>
            <button class="delete-btn" onclick="deleteExpense('${e.id}',this)" title="Delete">🗑</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function deleteExpense(id, btn) {
  if (!confirm('Delete this expense?')) return;
  try {
    await ExpensesAPI.delete(id);
    btn.closest('.expense-row').remove();
    showToast('Expense deleted');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   ANALYTICS
════════════════════════════════════════════════════════════════════════════ */
async function loadAnalytics(days = 30) {
  try {
    const [catRes, trendRes] = await Promise.all([
      AnalyticsAPI.categories(days),
      AnalyticsAPI.trends(),
    ]);

    renderCategoryChart(catRes.categories || []);
    renderTrendChart(trendRes.weekly || []);
    renderCategoryBars(catRes.categories || []);
  } catch (e) {
    console.error('Analytics error:', e);
  }
}

function _destroyChart(id) {
  if (State.chartInstances[id]) {
    State.chartInstances[id].destroy();
    delete State.chartInstances[id];
  }
}

const CHART_COLORS = [
  '#b8ff3c', '#4f6ef7', '#f7547e', '#2dd4bf', '#fbbf24',
  '#8b5cf6', '#f97316', '#06b6d4', '#10b981', '#ec4899'
];

function renderCategoryChart(cats) {
  _destroyChart('cat-chart');
  const ctx = document.getElementById('cat-chart').getContext('2d');
  State.chartInstances['cat-chart'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: cats.map(c => c.category),
      datasets: [{
        data: cats.map(c => c.amount),
        backgroundColor: CHART_COLORS,
        borderColor: '#0c0f1a',
        borderWidth: 3,
        hoverBorderWidth: 0,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'bottom', labels: { color: '#8892b0', font: { family: 'DM Sans', size: 12 }, padding: 16, boxWidth: 12 } },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ₹${ctx.raw.toLocaleString('en-IN')}` } }
      },
      cutout: '65%',
    }
  });
}

function renderTrendChart(weekly) {
  _destroyChart('trend-chart');
  const ctx = document.getElementById('trend-chart').getContext('2d');
  State.chartInstances['trend-chart'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: weekly.map(w => w.week),
      datasets: [{
        label: 'Spending',
        data: weekly.map(w => w.amount),
        backgroundColor: 'rgba(184,255,60,.8)',
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8892b0', font: { size: 11 } }, grid: { color: '#232840' } },
        y: { ticks: { color: '#8892b0', font: { size: 11 }, callback: v => '₹' + v.toLocaleString('en-IN') }, grid: { color: '#232840' } }
      }
    }
  });
}

function renderCategoryBars(cats) {
  const el = document.getElementById('cat-breakdown-list');
  const max = Math.max(...cats.map(c => c.amount), 1);
  el.innerHTML = cats.map((c, i) => `
    <div class="cat-bar-item">
      <div class="cat-bar-header">
        <span class="cat-bar-label">${categoryEmoji(c.category)} ${c.category}</span>
        <span class="cat-bar-amount">${fmt(c.amount)} (${c.percentage}%)</span>
      </div>
      <div class="cat-bar-track">
        <div class="cat-bar-fill" style="width:${(c.amount / max * 100).toFixed(1)}%;background:${CHART_COLORS[i % CHART_COLORS.length]}"></div>
      </div>
    </div>
  `).join('');
}

/* ════════════════════════════════════════════════════════════════════════════
   INSIGHTS
════════════════════════════════════════════════════════════════════════════ */
async function loadInsights() {
  const grid = document.getElementById('insights-grid');
  grid.innerHTML = '<div class="empty-state card">Analyzing your data… ✨</div>';

  try {
    const res = await InsightsAPI.get();
    renderInsights(res.insights || [], grid);
  } catch (e) {
    grid.innerHTML = `<div class="empty-state card">${e.message}</div>`;
  }
}

function renderInsights(insights, container) {
  if (!insights.length) {
    container.innerHTML = `
      <div class="card" style="grid-column:1/-1;text-align:center;padding:60px">
        <div style="font-size:48px;margin-bottom:12px">🧘</div>
        <h3 style="margin-bottom:8px">All looks good!</h3>
        <p style="color:var(--text-2)">No insights right now. Add more expenses to unlock AI analysis.</p>
      </div>`;
    return;
  }

  container.innerHTML = insights.map((ins, i) => `
    <div class="insight-card ${ins.priority}" style="animation-delay:${i * 0.07}s">
      <div class="insight-header">
        <div class="insight-icon">${ins.icon}</div>
        <div class="insight-meta">
          <div class="insight-type">${ins.type.replace(/_/g, ' ')}</div>
          <div class="insight-title">${ins.title}</div>
        </div>
      </div>
      <p class="insight-msg">${ins.message}</p>
      <div class="insight-group">📍 ${ins.group_name}</div>
      <span class="insight-action">${ins.action}</span>
    </div>
  `).join('');
}

/* ════════════════════════════════════════════════════════════════════════════
   ADD EXPENSE MODAL
════════════════════════════════════════════════════════════════════════════ */
let _splitType = 'equal';
let _selectedParticipants = new Set();
let _currentGroupMembers = [];

function openAddExpenseModal(preselectedGroupId = null) {
  openModal('modal-add-expense');
  document.getElementById('expense-error').textContent = '';

  // Populate groups dropdown
  const groupSel = document.getElementById('ae-group');
  groupSel.innerHTML = State.groups.map(g => `<option value="${g.id}">${g.icon} ${g.name}</option>`).join('');
  if (preselectedGroupId) groupSel.value = preselectedGroupId;

  // Load members for selected group
  loadExpenseParticipants(groupSel.value);
  groupSel.onchange = () => loadExpenseParticipants(groupSel.value);
}

async function loadExpenseParticipants(groupId) {
  const pContainer = document.getElementById('ae-participants');
  pContainer.innerHTML = 'Loading…';
  _selectedParticipants.clear();

  try {
    const res = await GroupsAPI.get(groupId);
    _currentGroupMembers = res.members || [];
    _currentGroupMembers.forEach(m => _selectedParticipants.add(m.id));
    renderParticipants();
  } catch (e) {
    pContainer.innerHTML = 'Failed to load members';
  }
}

function renderParticipants() {
  const container = document.getElementById('ae-participants');
  container.innerHTML = _currentGroupMembers.map(m => `
    <div class="participant-chip ${_selectedParticipants.has(m.id) ? 'selected' : ''}"
         onclick="toggleParticipant('${m.id}')">
      <div class="chip-avatar" style="background:${m.avatar_color || '#6366f1'}">${initials(m.username)}</div>
      ${m.username}
    </div>
  `).join('');
  updateCustomSplits();
}

function toggleParticipant(uid) {
  if (_selectedParticipants.has(uid)) _selectedParticipants.delete(uid);
  else _selectedParticipants.add(uid);
  renderParticipants();
}

function updateCustomSplits() {
  if (_splitType !== 'unequal') return;
  const amount = parseFloat(document.getElementById('ae-amount').value) || 0;
  const per = _selectedParticipants.size ? (amount / _selectedParticipants.size) : 0;

  const list = document.getElementById('custom-splits-list');
  list.innerHTML = [..._selectedParticipants].map(uid => {
    const m = _currentGroupMembers.find(x => x.id === uid);
    return `
      <div class="split-row">
        <span>${m ? m.username : uid}</span>
        <input type="number" class="custom-split-input" data-uid="${uid}"
               value="${per.toFixed(2)}" min="0" step="0.01"
               oninput="recalcRemaining()" />
      </div>
    `;
  }).join('');
  recalcRemaining();
}

function recalcRemaining() {
  const total = parseFloat(document.getElementById('ae-amount').value) || 0;
  const inputs = document.querySelectorAll('.custom-split-input');
  const assigned = [...inputs].reduce((s, i) => s + (parseFloat(i.value) || 0), 0);
  const rem = total - assigned;
  const remEl = document.getElementById('split-remaining');
  if (remEl) {
    remEl.textContent = fmt(Math.abs(rem));
    remEl.style.color = Math.abs(rem) < 0.05 ? 'var(--teal)' : 'var(--rose)';
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   MODAL HELPERS
════════════════════════════════════════════════════════════════════════════ */
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
}

/* ════════════════════════════════════════════════════════════════════════════
   FORM SUBMISSIONS
════════════════════════════════════════════════════════════════════════════ */
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  try {
    const res = await AuthAPI.login({
      email: document.getElementById('login-email').value,
      password: document.getElementById('login-password').value,
    });
    Auth.setToken(res.token);
    Auth.setUser(res.user);
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
  }
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('register-error');
  errEl.textContent = '';
  try {
    const res = await AuthAPI.register({
      username: document.getElementById('reg-name').value,
      email: document.getElementById('reg-email').value,
      password: document.getElementById('reg-password').value,
    });
    Auth.setToken(res.token);
    Auth.setUser(res.user);
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
  }
});

document.getElementById('create-group-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await GroupsAPI.create({
      name: document.getElementById('cg-name').value,
      description: document.getElementById('cg-desc').value,
      icon: document.getElementById('cg-icon').value,
    });
    closeAllModals();
    showToast('Group created! 🎉');
    loadGroups();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

document.getElementById('join-group-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('join-error');
  errEl.textContent = '';
  try {
    const res = await GroupsAPI.join(document.getElementById('jg-code').value);
    closeAllModals();
    showToast(`Joined ${res.group.name}! 🎊`);
    loadGroups();
  } catch (err) {
    errEl.textContent = err.message;
  }
});

document.getElementById('add-expense-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('expense-error');
  errEl.textContent = '';

  const participants = [..._selectedParticipants];
  if (!participants.length) { errEl.textContent = 'Select at least one participant'; return; }

  let customSplits = {};
  if (_splitType === 'unequal') {
    document.querySelectorAll('.custom-split-input').forEach(inp => {
      customSplits[inp.dataset.uid] = parseFloat(inp.value) || 0;
    });
  }

  try {
    await ExpensesAPI.add({
      group_id: document.getElementById('ae-group').value,
      title: document.getElementById('ae-title').value,
      amount: document.getElementById('ae-amount').value,
      category: document.getElementById('ae-category').value,
      split_type: _splitType,
      participants,
      custom_splits: _splitType === 'unequal' ? customSplits : {},
      notes: document.getElementById('ae-notes').value,
    });
    closeAllModals();
    showToast('Expense added! 💸');
    loadDashboard();
  } catch (err) {
    errEl.textContent = err.message;
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   EVENT BINDING
════════════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  // Nav
  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      showView(el.dataset.view);
      // close mobile sidebar
      document.querySelector('.sidebar')?.classList.remove('open');
    });
  });

  // Auth tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn, .auth-form').forEach(el => el.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`${btn.dataset.tab}-form`).classList.add('active');
    });
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', () => {
    Auth.clear();
    showAuth();
  });

  // Quick add
  document.getElementById('quick-add-btn').addEventListener('click', () => openAddExpenseModal());

  // Create group
  document.getElementById('create-group-btn').addEventListener('click', () => openModal('modal-create-group'));
  document.getElementById('join-group-btn').addEventListener('click', () => openModal('modal-join-group'));

  // Back buttons
  document.getElementById('back-to-groups').addEventListener('click', () => showView('groups'));

  // Refresh insights
  document.getElementById('refresh-insights-btn').addEventListener('click', loadInsights);

  // Analytics days filter
  document.getElementById('analytics-days').addEventListener('change', (e) => loadAnalytics(e.target.value));

  // Modal close buttons
  document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      const overlay = btn.closest('.modal-overlay');
      if (overlay) overlay.classList.add('hidden');
    });
  });

  // Close modal on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
  });

  // Icon picker
  const iconPickerEl = document.getElementById('icon-picker');
  const iconInput = document.getElementById('cg-icon');
  iconPickerEl.innerHTML = iconPickerEl.textContent.trim().split(' ').map(icon =>
    `<span class="icon-option${icon === '🏠' ? ' selected' : ''}">${icon}</span>`
  ).join('');
  iconPickerEl.querySelectorAll('.icon-option').forEach(opt => {
    opt.addEventListener('click', () => {
      iconPickerEl.querySelectorAll('.icon-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      iconInput.value = opt.textContent;
    });
  });

  // Split toggle
  document.querySelectorAll('.split-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.split-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _splitType = btn.dataset.split;
      const panel = document.getElementById('custom-splits-panel');
      panel.classList.toggle('hidden', _splitType !== 'unequal');
      if (_splitType === 'unequal') updateCustomSplits();
    });
  });

  // Amount change → update custom splits
  document.getElementById('ae-amount').addEventListener('input', () => {
    if (_splitType === 'unequal') updateCustomSplits();
  });

  // Mobile sidebar toggle
  document.getElementById('mobile-menu-btn').addEventListener('click', () => {
    document.querySelector('.sidebar')?.classList.toggle('open');
  });

  // Dashboard link chips
  document.querySelectorAll('.link-sm[data-view]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      showView(el.dataset.view);
    });
  });

  // ── Bootstrap ────────────────────────────────────────────────────────────
  if (Auth.getToken()) {
    showApp();
  } else {
    showAuth();
  }
});
