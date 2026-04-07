const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db   = require('../database');
const auth = require('../middleware/auth');
const multer  = require('multer');
const path    = require('path');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads'),
  filename: (req, file, cb) => cb(null, `avatar_${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/profile
router.get('/', auth, (req, res) => {
  const user = db.prepare('SELECT id,name,email,avatar,phone,xp,level,created_at FROM users WHERE id=?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const badges = db.prepare('SELECT * FROM badges WHERE user_id=? ORDER BY earned_at DESC').all(req.userId);
  const nextLevelXP = user.level * 700;

  // All available badges with earned status
  const allBadges = [
    { key: 'smart_saver',      title: 'Smart Saver',      description: 'Spent 20% below average for 4 weeks', icon: '🧠' },
    { key: 'top_contributor',  title: 'Top Contributor',  description: 'First to settle in 10 group trips',   icon: '🏆' },
    { key: 'speed_settler',    title: 'Speed Settler',    description: 'Settle balance within 1 hour',        icon: '⚡' },
    { key: 'data_nerd',        title: 'Data Nerd',        description: 'Viewed insights 30 days in a row',    icon: '📊' },
  ];

  const earnedKeys = new Set(badges.map(b => b.badge_key));
  const badgesWithStatus = allBadges.map(b => ({
    ...b,
    earned: earnedKeys.has(b.key),
    earned_at: badges.find(e => e.badge_key === b.key)?.earned_at || null,
  }));

  res.json({
    ...user,
    next_level_xp: nextLevelXP,
    xp_to_next: Math.max(0, nextLevelXP - user.xp),
    badges: badgesWithStatus,
  });
});

// PUT /api/profile — update name/phone
router.put('/', auth, (req, res) => {
  const { name, phone } = req.body;
  db.prepare('UPDATE users SET name=COALESCE(?,name), phone=COALESCE(?,phone) WHERE id=?')
    .run(name, phone, req.userId);
  res.json(db.prepare('SELECT id,name,email,avatar,phone,xp,level FROM users WHERE id=?').get(req.userId));
});

// POST /api/profile/avatar — upload new profile photo
router.post('/avatar', auth, upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  
  const avatarUrl = `/uploads/${req.file.filename}`;
  db.prepare('UPDATE users SET avatar=? WHERE id=?').run(avatarUrl, req.userId);
  
  res.json({ avatar: avatarUrl });
});

// GET /api/profile/activity — recent activity summary
router.get('/activity', auth, (req, res) => {
  const expenses_count = db.prepare(`
    SELECT COUNT(*) AS c FROM expenses e
    JOIN group_members gm ON gm.group_id=e.group_id AND gm.user_id=?
    WHERE e.paid_by=?
  `).get(req.userId, req.userId).c;

  const groups_count = db.prepare('SELECT COUNT(*) AS c FROM group_members WHERE user_id=?').get(req.userId).c;

  const settled_count = db.prepare('SELECT COUNT(*) AS c FROM settlements WHERE from_user=? AND is_paid=1').get(req.userId).c;

  res.json({ expenses_paid: expenses_count, groups: groups_count, settled: settled_count });
});

module.exports = router;
