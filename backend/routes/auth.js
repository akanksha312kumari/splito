const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'splito_secret_key_2026';
const JWT_EXPIRES = '7d';

function makeToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'name, email, and password are required' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const id       = uuidv4();
  const hashed  = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id,name,email,password) VALUES (?,?,?,?)').run(id, name, email, hashed);
  
  // Create default settings for new user
  db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(id);

  const user = db.prepare('SELECT id,name,email,xp,level,created_at FROM users WHERE id=?').get(id);
  res.status(201).json({ token: makeToken(id), user });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Invalid email or password' });

  const { password: _p, ...safe } = user;
  res.json({ token: makeToken(user.id), user: safe });
});

// GET /api/auth/me
const auth = require('../middleware/auth');
router.get('/me', auth, (req, res) => {
  const user = db.prepare('SELECT id,name,email,xp,level,avatar,created_at FROM users WHERE id=?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

module.exports = router;
