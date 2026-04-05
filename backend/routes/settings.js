const express = require('express');
const router  = express.Router();
const db   = require('../database');
const auth = require('../middleware/auth');

// GET /api/settings
router.get('/', auth, (req, res) => {
  let settings = db.prepare('SELECT * FROM user_settings WHERE user_id=?').get(req.userId);
  
  // If no settings exist yet, create default entry
  if (!settings) {
    db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(req.userId);
    settings = db.prepare('SELECT * FROM user_settings WHERE user_id=?').get(req.userId);
  }

  // Convert SQLite 0/1 to boolean
  const boolKeys = ['dark_mode', 'notif_enabled', 'notif_expense', 'notif_settlement', 'notif_ai', 'ai_enabled', 'ai_predictions', 'ai_suggestions', 'ai_weekly_report'];
  const formatted = { ...settings };
  boolKeys.forEach(k => formatted[k] = !!settings[k]);

  res.json(formatted);
});

// PUT /api/settings
router.put('/', auth, (req, res) => {
  const fields = [
    'dark_mode', 'notif_enabled', 'notif_expense', 'notif_settlement', 'notif_ai', 
    'ai_enabled', 'ai_predictions', 'ai_suggestions', 'ai_weekly_report', 'payment_method'
  ];
  
  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      const val = typeof req.body[f] === 'boolean' ? (req.body[f] ? 1 : 0) : req.body[f];
      // Use UPSERT pattern: INSERT with ON CONFLICT UPDATE
      // This ensures that even if registration missed it, we create it here.
      db.prepare(`
        INSERT INTO user_settings (user_id, ${f}) VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET ${f} = excluded.${f}
      `).run(req.userId, val);
    }
  });

  res.json({ success: true });
});

module.exports = router;
