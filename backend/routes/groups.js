const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db   = require('../database');
const auth = require('../middleware/auth');
const multer  = require('multer');
const path    = require('path');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads'),
  filename: (req, file, cb) => cb(null, `chat_${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Helpers
function getGroup(id) {
  return db.prepare('SELECT * FROM groups WHERE id = ?').get(id);
}
function isMember(groupId, userId) {
  return !!db.prepare('SELECT 1 FROM group_members WHERE group_id=? AND user_id=?').get(groupId, userId);
}

// GET /api/groups — list groups for current user
router.get('/', auth, (req, res) => {
  const groups = db.prepare(`
    SELECT g.*, gm.role,
      (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) AS member_count,
      (SELECT COUNT(*) FROM expenses WHERE group_id = g.id) AS expense_count
    FROM groups g
    JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
    ORDER BY g.created_at DESC
  `).all(req.userId);

  // Append each group's net balance for this user
  const result = groups.map(g => {
    const net = computeNetBalance(g.id, req.userId);
    return { ...g, net_balance: net };
  });

  res.json(result);
});

// POST /api/groups — create
router.post('/', auth, (req, res) => {
  const { name, emoji = '👥', description = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const id = uuidv4();
  db.prepare('INSERT INTO groups (id,name,emoji,description,created_by) VALUES (?,?,?,?,?)').run(id, name, emoji, description, req.userId);
  db.prepare('INSERT INTO group_members (group_id,user_id,role) VALUES (?,?,?)').run(id, req.userId, 'admin');

  res.status(201).json(getGroup(id));
});

// GET /api/groups/:id
router.get('/:id', auth, (req, res) => {
  const group = getGroup(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (!isMember(group.id, req.userId)) return res.status(403).json({ error: 'Not a member' });

  const members = db.prepare(`
    SELECT u.id,u.name,u.email,u.avatar,gm.role
    FROM users u JOIN group_members gm ON gm.user_id = u.id
    WHERE gm.group_id = ?
  `).all(group.id);

  const expenses = db.prepare(`
    SELECT e.*, u.name AS paid_by_name
    FROM expenses e JOIN users u ON u.id = e.paid_by
    WHERE e.group_id = ?
    ORDER BY e.created_at DESC
  `).all(group.id);

  const net = computeNetBalance(group.id, req.userId);

  res.json({ ...group, members, expenses, net_balance: net });
});

// PUT /api/groups/:id
router.put('/:id', auth, (req, res) => {
  const group = getGroup(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.created_by !== req.userId) return res.status(403).json({ error: 'Only creator can edit' });

  const { name, emoji, description } = req.body;
  db.prepare('UPDATE groups SET name=COALESCE(?,name), emoji=COALESCE(?,emoji), description=COALESCE(?,description) WHERE id=?')
    .run(name, emoji, description, group.id);
  res.json(getGroup(group.id));
});

// DELETE /api/groups/:id
router.delete('/:id', auth, (req, res) => {
  const group = getGroup(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.created_by !== req.userId) return res.status(403).json({ error: 'Only creator can delete' });

  db.prepare('DELETE FROM groups WHERE id=?').run(group.id);
  res.json({ message: 'Group deleted' });
});

// POST /api/groups/:id/members — add member by email
router.post('/:id/members', auth, (req, res) => {
  const group = getGroup(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (!isMember(group.id, req.userId)) return res.status(403).json({ error: 'Not a member' });

  const { email } = req.body;
  const user = db.prepare('SELECT id,name,email FROM users WHERE email=?').get(email);
  if (!user) return res.status(404).json({ error: 'User not found with that email' });
  if (isMember(group.id, user.id)) return res.status(409).json({ error: 'Already a member' });

  db.prepare('INSERT INTO group_members (group_id,user_id) VALUES (?,?)').run(group.id, user.id);
  res.status(201).json({ message: 'Member added', user });
});

// DELETE /api/groups/:id/members/:userId
router.delete('/:id/members/:userId', auth, (req, res) => {
  const group = getGroup(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.created_by !== req.userId && req.params.userId !== req.userId)
    return res.status(403).json({ error: 'Forbidden' });

  db.prepare('DELETE FROM group_members WHERE group_id=? AND user_id=?').run(group.id, req.params.userId);
  res.json({ message: 'Member removed' });
});

// PUT /api/groups/:id/members/:userId/role
router.put('/:id/members/:userId/role', auth, (req, res) => {
  const group = getGroup(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  
  // Only admin or group creator can change roles
  const currentUserRole = db.prepare('SELECT role FROM group_members WHERE group_id=? AND user_id=?').get(group.id, req.userId)?.role;
  if (group.created_by !== req.userId && currentUserRole !== 'admin') {
    return res.status(403).json({ error: 'Only admins can change roles' });
  }

  const { role } = req.body;
  if (!['admin', 'member'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

  db.prepare('UPDATE group_members SET role=? WHERE group_id=? AND user_id=?').run(role, group.id, req.params.userId);
  res.json({ message: 'Role updated' });
});

// GET /api/groups/:id/balances — detailed who-owes-whom
router.get('/:id/balances', auth, (req, res) => {
  const group = getGroup(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (!isMember(group.id, req.userId)) return res.status(403).json({ error: 'Not a member' });

  const members = db.prepare('SELECT user_id FROM group_members WHERE group_id=?').all(group.id).map(m => m.user_id);
  const balances = {};
  members.forEach(m => { balances[m] = 0; });

  const expenses = db.prepare('SELECT * FROM expenses WHERE group_id=?').all(group.id);
  expenses.forEach(exp => {
    const splits = db.prepare('SELECT * FROM expense_splits WHERE expense_id=? AND is_settled=0').all(exp.id);
    splits.forEach(s => {
      if (s.user_id !== exp.paid_by) {
        balances[exp.paid_by] = (balances[exp.paid_by] || 0) + s.amount;
        balances[s.user_id]   = (balances[s.user_id]   || 0) - s.amount;
      }
    });
  });

  // Also factor in paid settlements
  const activeSettlements = db.prepare('SELECT * FROM settlements WHERE group_id=? AND is_paid=1').all(group.id);
  activeSettlements.forEach(s => {
    balances[s.to_user]   = (balances[s.to_user]   || 0) + s.amount;
    balances[s.from_user] = (balances[s.from_user] || 0) - s.amount;
  });

  const userNames = db.prepare(`SELECT id,name FROM users WHERE id IN (${members.map(()=>'?').join(',')})`)
    .all(...members);
  const nameMap = Object.fromEntries(userNames.map(u => [u.id, u.name]));

  const result = Object.entries(balances).map(([uid, balance]) => ({
    user_id: uid, name: nameMap[uid] || uid, balance
  }));

  res.json(result);
});

function computeNetBalance(groupId, userId) {
  // Positive = you are owed, Negative = you owe
  const splits = db.prepare(`
    SELECT es.amount, e.paid_by, es.user_id, es.is_settled
    FROM expense_splits es
    JOIN expenses e ON e.id = es.expense_id
    WHERE e.group_id = ? AND es.is_settled = 0
  `).all(groupId);

  let net = 0;
  splits.forEach(s => {
    if (s.paid_by === userId && s.user_id !== userId) net += s.amount;
    if (s.user_id === userId && s.paid_by !== userId) net -= s.amount;
  });
  return Math.round(net * 100) / 100;
}

// ─── CHAT ENDPOINTS ───

// GET /api/groups/:id/messages
router.get('/:id/messages', auth, (req, res) => {
  const group = getGroup(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (!isMember(group.id, req.userId)) return res.status(403).json({ error: 'Not a member' });

  const messages = db.prepare(`
    SELECT m.*, u.name, u.avatar 
    FROM messages m 
    JOIN users u ON u.id = m.user_id 
    WHERE m.group_id=? 
    ORDER BY m.created_at ASC
  `).all(group.id);

  res.json(messages);
});

// POST /api/groups/:id/messages
router.post('/:id/messages', auth, (req, res) => {
  const group = getGroup(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (!isMember(group.id, req.userId)) return res.status(403).json({ error: 'Not a member' });

  const { text, attachment_url, expense_id } = req.body;
  if (!text && !attachment_url) return res.status(400).json({ error: 'Message must have text or attachment' });

  const msgId = uuidv4();
  db.prepare('INSERT INTO messages (id, group_id, user_id, text, attachment_url, expense_id) VALUES (?,?,?,?,?,?)')
    .run(msgId, group.id, req.userId, text || null, attachment_url || null, expense_id || null);

  const newMsg = db.prepare(`
    SELECT m.*, u.name, u.avatar 
    FROM messages m JOIN users u ON u.id = m.user_id 
    WHERE m.id=?
  `).get(msgId);

  // Broadcast to group
  req.io.to(`group_${group.id}`).emit('new_message', newMsg);

  res.status(201).json(newMsg);
});

// POST /api/groups/:id/messages/attach
router.post('/:id/messages/attach', auth, upload.single('attachment'), (req, res) => {
  const group = getGroup(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (!isMember(group.id, req.userId)) return res.status(403).json({ error: 'Not a member' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const attachment_url = `/uploads/${req.file.filename}`;
  res.json({ attachment_url });
});

module.exports = router;
