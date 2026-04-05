const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db   = require('../database');
const auth = require('../middleware/auth');

// GET /api/expenses — all expenses for current user's groups
router.get('/', auth, (req, res) => {
  const { group_id, category, limit = 50 } = req.query;

  let query = `
    SELECT e.*, u.name AS paid_by_name, g.name AS group_name, g.emoji AS group_emoji
    FROM expenses e
    JOIN users   u ON u.id = e.paid_by
    JOIN groups  g ON g.id = e.group_id
    JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
  `;
  const params = [req.userId];

  if (group_id) { query += ' AND e.group_id = ?'; params.push(group_id); }
  if (category)  { query += ' AND e.category = ?'; params.push(category); }
  query += ' ORDER BY e.created_at DESC LIMIT ?';
  params.push(Number(limit));

  const expenses = db.prepare(query).all(...params);
  res.json(expenses);
});

// POST /api/expenses — create expense
router.post('/', auth, (req, res) => {
  const { group_id, title, amount, category = 'other', split_type = 'equal', emoji = '💸', splits } = req.body;
  if (!group_id || !title || !amount) return res.status(400).json({ error: 'group_id, title, amount required' });

  const isMember = db.prepare('SELECT 1 FROM group_members WHERE group_id=? AND user_id=?').get(group_id, req.userId);
  if (!isMember) return res.status(403).json({ error: 'Not a member of this group' });

  const id = uuidv4();
  db.prepare('INSERT INTO expenses (id,group_id,title,amount,category,paid_by,split_type,emoji) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, group_id, title, Number(amount), category, req.userId, split_type, emoji);

  // Create splits
  const members = db.prepare('SELECT user_id FROM group_members WHERE group_id=?').all(group_id).map(m => m.user_id);

  if (split_type === 'equal' || !splits) {
    const share = Math.round((Number(amount) / members.length) * 100) / 100;
    const insertSplit = db.prepare('INSERT INTO expense_splits (id,expense_id,user_id,amount,is_settled) VALUES (?,?,?,?,?)');
    members.forEach(uid => {
      insertSplit.run(uuidv4(), id, uid, share, uid === req.userId ? 1 : 0);
    });
  } else {
    // Custom splits
    const insertSplit = db.prepare('INSERT INTO expense_splits (id,expense_id,user_id,amount,is_settled) VALUES (?,?,?,?,?)');
    Object.entries(splits).forEach(([uid, amt]) => {
      insertSplit.run(uuidv4(), id, uid, Number(amt), uid === req.userId ? 1 : 0);
    });
  }

  // Notify group members
  const insertNotif = db.prepare('INSERT INTO notifications (id,user_id,title,body,type) VALUES (?,?,?,?,?)');
  members.filter(uid => uid !== req.userId).forEach(uid => {
    insertNotif.run(uuidv4(), uid, 'New Expense Added',
      `New expense "${title}" of ₹${amount} was added to your group.`, 'info');
      
    if (req.io) {
      req.io.to(`user_${uid}`).emit('notification', {
        title: 'New Expense Added',
        body: `New expense "${title}" of ₹${amount} was added to your group.`
      });
      req.io.to(`user_${uid}`).emit('balance_update', { group_id });
    }
  });

  const expense = db.prepare(`SELECT e.*,u.name AS paid_by_name FROM expenses e JOIN users u ON u.id=e.paid_by WHERE e.id=?`).get(id);
  res.status(201).json(expense);
});

// GET /api/expenses/:id
router.get('/:id', auth, (req, res) => {
  const expense = db.prepare(`
    SELECT e.*, u.name AS paid_by_name, g.name AS group_name
    FROM expenses e JOIN users u ON u.id=e.paid_by JOIN groups g ON g.id=e.group_id
    WHERE e.id=?
  `).get(req.params.id);
  if (!expense) return res.status(404).json({ error: 'Expense not found' });

  const isMember = db.prepare('SELECT 1 FROM group_members WHERE group_id=? AND user_id=?').get(expense.group_id, req.userId);
  if (!isMember) return res.status(403).json({ error: 'Not a member' });

  const splits = db.prepare(`
    SELECT es.*, u.name FROM expense_splits es JOIN users u ON u.id=es.user_id WHERE es.expense_id=?
  `).all(expense.id);

  res.json({ ...expense, splits });
});

// PUT /api/expenses/:id
router.put('/:id', auth, (req, res) => {
  const expense = db.prepare('SELECT * FROM expenses WHERE id=?').get(req.params.id);
  if (!expense) return res.status(404).json({ error: 'not found' });
  if (expense.paid_by !== req.userId) return res.status(403).json({ error: 'Only the payer can edit' });

  const { title, amount, category, emoji } = req.body;
  db.prepare('UPDATE expenses SET title=COALESCE(?,title), amount=COALESCE(?,amount), category=COALESCE(?,category), emoji=COALESCE(?,emoji) WHERE id=?')
    .run(title, amount, category, emoji, expense.id);

  res.json(db.prepare('SELECT * FROM expenses WHERE id=?').get(expense.id));
});

// DELETE /api/expenses/:id
router.delete('/:id', auth, (req, res) => {
  const expense = db.prepare('SELECT * FROM expenses WHERE id=?').get(req.params.id);
  if (!expense) return res.status(404).json({ error: 'not found' });
  if (expense.paid_by !== req.userId) return res.status(403).json({ error: 'Only the payer can delete' });

  db.prepare('DELETE FROM expenses WHERE id=?').run(expense.id);
  res.json({ message: 'Expense deleted' });
});

module.exports = router;
