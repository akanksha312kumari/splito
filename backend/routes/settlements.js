const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db   = require('../database');
const auth = require('../middleware/auth');

// GET /api/settlements — list for current user
router.get('/', auth, (req, res) => {
  const { group_id, status } = req.query;
  let query = `
    SELECT s.*,
      fu.name AS from_name, tu.name AS to_name, g.name AS group_name
    FROM settlements s
    JOIN users fu ON fu.id = s.from_user
    JOIN users tu ON tu.id = s.to_user
    JOIN groups g ON g.id = s.group_id
    WHERE (s.from_user=? OR s.to_user=?)
  `;
  const params = [req.userId, req.userId];

  if (group_id) { query += ' AND s.group_id=?'; params.push(group_id); }
  if (status === 'pending') { query += ' AND s.is_paid=0'; }
  if (status === 'paid')    { query += ' AND s.is_paid=1'; }
  query += ' ORDER BY s.created_at DESC';

  res.json(db.prepare(query).all(...params));
});

// POST /api/settlements — create a settlement request
router.post('/', auth, (req, res) => {
  const { group_id, from_user, to_user, amount, method = 'UPI' } = req.body;
  if (!group_id || !to_user || !amount) return res.status(400).json({ error: 'group_id, to_user, amount required' });

  const isMember = db.prepare('SELECT 1 FROM group_members WHERE group_id=? AND user_id=?').get(group_id, req.userId);
  if (!isMember) return res.status(403).json({ error: 'Not a member' });

  const actualFromUser = from_user || req.userId;
  const id = uuidv4();
  db.prepare('INSERT INTO settlements (id,group_id,from_user,to_user,amount,method) VALUES (?,?,?,?,?,?)')
    .run(id, group_id, actualFromUser, to_user, Number(amount), method);

  // Notify the recipient
  const me = db.prepare('SELECT name FROM users WHERE id=?').get(req.userId);
  db.prepare('INSERT INTO notifications (id,user_id,title,body,type) VALUES (?,?,?,?,?)')
    .run(uuidv4(), to_user, 'Settlement Request',
      `${me.name} sent you a ₹${amount} settlement request.`, 'info');

  if (req.io) {
    req.io.to(`user_${to_user}`).emit('notification', {
      title: 'Settlement Request',
      body: `${me.name} sent you a ₹${amount} settlement request.`
    });
    // Let both users know balance info should be rebuilt
    req.io.to(`user_${req.userId}`).emit('balance_update', { group_id });
    req.io.to(`user_${to_user}`).emit('balance_update', { group_id });
  }

  res.status(201).json(db.prepare('SELECT * FROM settlements WHERE id=?').get(id));
});

// PUT /api/settlements/:id/pay — mark as paid
router.put('/:id/pay', auth, (req, res) => {
  const s = db.prepare('SELECT * FROM settlements WHERE id=?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Settlement not found' });
  const isMember = db.prepare('SELECT 1 FROM group_members WHERE group_id=? AND user_id=?').get(s.group_id, req.userId);
  if (!isMember) return res.status(403).json({ error: 'Only group members can mark as paid' });
  if (s.is_paid) return res.status(409).json({ error: 'Already paid' });

  db.prepare("UPDATE settlements SET is_paid=1, paid_at=datetime('now') WHERE id=?").run(s.id);

  // New Partial Settlement Logic:
  // Mark expense splits as settled sequentially based on amount paid
  const splits = db.prepare(`
    SELECT es.* FROM expense_splits es
    JOIN expenses e ON e.id = es.expense_id
    WHERE e.group_id=? AND es.user_id=? AND e.paid_by=? AND es.is_settled=0
    ORDER BY e.created_at ASC
  `).all(s.group_id, s.from_user, s.to_user);

  let remainingToApply = s.amount;
  for (const sp of splits) {
    if (remainingToApply <= 0) break;

    const currentDebt = sp.amount - (sp.settled_amount || 0);
    const applyToThisSplit = Math.min(remainingToApply, currentDebt);
    
    const newSettledAmount = (sp.settled_amount || 0) + applyToThisSplit;
    const isNowFullySettled = newSettledAmount >= sp.amount - 0.01 ? 1 : 0;

    db.prepare('UPDATE expense_splits SET settled_amount=?, is_settled=? WHERE id=?')
      .run(newSettledAmount, isNowFullySettled, sp.id);

    remainingToApply -= applyToThisSplit;
  }

  // Notify the recipient
  const me = db.prepare('SELECT name FROM users WHERE id=?').get(req.userId);
  db.prepare('INSERT INTO notifications (id,user_id,title,body,type) VALUES (?,?,?,?,?)')
    .run(uuidv4(), s.to_user, 'Payment Received',
      `${me.name} marked ₹${s.amount} as paid via ${s.method}.`, 'success');

  // Award XP to from_user for settling quickly
  db.prepare('UPDATE users SET xp = xp + 50 WHERE id=?').run(req.userId);

  if (req.io) {
    req.io.to(`user_${s.to_user}`).emit('notification', {
      title: 'Payment Received',
      body: `${me.name} marked ₹${s.amount} as paid via ${s.method}.`
    });
    req.io.to(`user_${req.userId}`).emit('balance_update', { group_id: s.group_id });
    req.io.to(`user_${s.to_user}`).emit('balance_update', { group_id: s.group_id });
  }

  res.json(db.prepare('SELECT * FROM settlements WHERE id=?').get(s.id));
});

// GET /api/settlements/suggestions — AI-suggested optimal settlements
router.get('/suggestions', auth, (req, res) => {
  const { group_id } = req.query;
  if (!group_id) return res.status(400).json({ error: 'group_id required' });

  const members = db.prepare('SELECT user_id FROM group_members WHERE group_id=?').all(group_id).map(m => m.user_id);
  const balances = {};
  members.forEach(m => { balances[m] = 0; });

  const splits = db.prepare(`
    SELECT (es.amount - COALESCE(es.settled_amount, 0)) AS remaining_amount, e.paid_by, es.user_id
    FROM expense_splits es JOIN expenses e ON e.id = es.expense_id
    WHERE e.group_id = ? AND es.is_settled = 0
  `).all(group_id);

  splits.forEach(s => {
    if (s.paid_by !== s.user_id) {
      balances[s.paid_by] = (balances[s.paid_by] || 0) + s.remaining_amount;
      balances[s.user_id] = (balances[s.user_id] || 0) - s.remaining_amount;
    }
  });

  // Greedy min-cash-flow
  const creditors = Object.entries(balances).filter(([,v]) => v > 0).sort((a,b) => b[1]-a[1]);
  const debtors   = Object.entries(balances).filter(([,v]) => v < 0).sort((a,b) => a[1]-b[1]);
  const transactions = [];

  let ci = 0, di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const [cId, cAmt] = creditors[ci];
    const [dId, dAmt] = debtors[di];
    const amt = Math.min(cAmt, -dAmt);
    if (amt > 0.01) {
      transactions.push({ from_user: dId, to_user: cId, amount: Math.round(amt * 100) / 100 });
    }
    creditors[ci][1] -= amt;
    debtors[di][1]   += amt;
    if (Math.abs(creditors[ci][1]) < 0.01) ci++;
    if (Math.abs(debtors[di][1])   < 0.01) di++;
  }

  // Resolve names
  const userNames = db.prepare(`SELECT id,name FROM users WHERE id IN (${members.map(()=>'?').join(',')})`)
    .all(...members);
  const nameMap = Object.fromEntries(userNames.map(u => [u.id, u.name]));

  res.json(transactions.map(t => ({
    ...t,
    from_name: nameMap[t.from_user] || t.from_user,
    to_name:   nameMap[t.to_user]   || t.to_user,
  })));
});

module.exports = router;
