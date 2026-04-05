const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db   = require('../database');
const auth = require('../middleware/auth');

// GET /api/notifications
router.get('/', auth, (req, res) => {
  const { unread_only } = req.query;
  let q = 'SELECT * FROM notifications WHERE user_id=?';
  if (unread_only === 'true') q += ' AND is_read=0';
  q += ' ORDER BY created_at DESC LIMIT 50';

  res.json(db.prepare(q).all(req.userId));
});

// GET /api/notifications/unread-count
router.get('/unread-count', auth, (req, res) => {
  const count = db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id=? AND is_read=0').get(req.userId).c;
  res.json({ count });
});

// PUT /api/notifications/:id/read
router.put('/:id/read', auth, (req, res) => {
  const n = db.prepare('SELECT * FROM notifications WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!n) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE notifications SET is_read=1 WHERE id=?').run(n.id);
  res.json({ message: 'Marked as read' });
});

// PUT /api/notifications/read-all
router.put('/read-all', auth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(req.userId);
  res.json({ message: 'All notifications marked as read' });
});

// DELETE /api/notifications/:id
router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM notifications WHERE id=? AND user_id=?').run(req.params.id, req.userId);
  res.json({ message: 'Deleted' });
});

module.exports = router;
