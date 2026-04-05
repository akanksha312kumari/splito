// Uses Node.js 22+ built-in sqlite (no native compilation needed)
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path   = require('path');

const db = new DatabaseSync(path.join(__dirname, 'splito.db'));

// Helpers — make node:sqlite feel like better-sqlite3
// node:sqlite already has synchronous API, same surface area
db.exec(`PRAGMA journal_mode = WAL`);
db.exec(`PRAGMA foreign_keys = ON`);

// ─── SCHEMA ──────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, avatar TEXT DEFAULT NULL,
    xp INTEGER DEFAULT 0, level INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, emoji TEXT DEFAULT '👥',
    description TEXT DEFAULT '', created_by TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS group_members (
    group_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT DEFAULT 'member',
    joined_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY, group_id TEXT NOT NULL, title TEXT NOT NULL,
    amount REAL NOT NULL, category TEXT DEFAULT 'other', paid_by TEXT NOT NULL,
    split_type TEXT DEFAULT 'equal', emoji TEXT DEFAULT '💸',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (paid_by)  REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS expense_splits (
    id TEXT PRIMARY KEY, expense_id TEXT NOT NULL, user_id TEXT NOT NULL,
    amount REAL NOT NULL, is_settled INTEGER DEFAULT 0,
    FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)    REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS settlements (
    id TEXT PRIMARY KEY, group_id TEXT NOT NULL,
    from_user TEXT NOT NULL, to_user TEXT NOT NULL,
    amount REAL NOT NULL, method TEXT DEFAULT 'UPI',
    is_paid INTEGER DEFAULT 0, paid_at TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (group_id)  REFERENCES groups(id),
    FOREIGN KEY (from_user) REFERENCES users(id),
    FOREIGN KEY (to_user)   REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL,
    body TEXT NOT NULL, type TEXT DEFAULT 'info',
    is_read INTEGER DEFAULT 0, is_ai INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS badges (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, badge_key TEXT NOT NULL,
    title TEXT NOT NULL, description TEXT NOT NULL, icon TEXT,
    earned_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS receipts (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, group_id TEXT,
    filename TEXT, raw_text TEXT, parsed_items TEXT, total REAL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY,
    dark_mode INTEGER DEFAULT 0,
    notif_enabled INTEGER DEFAULT 1,
    notif_expense INTEGER DEFAULT 1,
    notif_settlement INTEGER DEFAULT 1,
    notif_ai INTEGER DEFAULT 1,
    ai_enabled INTEGER DEFAULT 1,
    ai_predictions INTEGER DEFAULT 1,
    ai_suggestions INTEGER DEFAULT 1,
    ai_weekly_report INTEGER DEFAULT 1,
    payment_method TEXT DEFAULT 'UPI',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// ─── INDEXES ──────────────────────────────────────────────────────────────────
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email        ON users(email);
  CREATE INDEX IF NOT EXISTS idx_gm_user                   ON group_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_gm_group                  ON group_members(group_id);
  CREATE INDEX IF NOT EXISTS idx_expenses_group            ON expenses(group_id);
  CREATE INDEX IF NOT EXISTS idx_expenses_paid_by          ON expenses(paid_by);
  CREATE INDEX IF NOT EXISTS idx_expenses_created_at       ON expenses(created_at);
  CREATE INDEX IF NOT EXISTS idx_expenses_category         ON expenses(category);
  CREATE INDEX IF NOT EXISTS idx_splits_expense            ON expense_splits(expense_id);
  CREATE INDEX IF NOT EXISTS idx_splits_user               ON expense_splits(user_id);
  CREATE INDEX IF NOT EXISTS idx_splits_settled            ON expense_splits(is_settled);
  CREATE INDEX IF NOT EXISTS idx_settlements_from          ON settlements(from_user);
  CREATE INDEX IF NOT EXISTS idx_settlements_to            ON settlements(to_user);
  CREATE INDEX IF NOT EXISTS idx_settlements_group         ON settlements(group_id);
  CREATE INDEX IF NOT EXISTS idx_settlements_paid          ON settlements(is_paid);
  CREATE INDEX IF NOT EXISTS idx_notif_user_read           ON notifications(user_id, is_read);
  CREATE INDEX IF NOT EXISTS idx_badges_user               ON badges(user_id);
  CREATE INDEX IF NOT EXISTS idx_receipts_user             ON receipts(user_id);
`);

// ─── SEED ─────────────────────────────────────────────────────────────────────
function seed() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get();
  // node:sqlite returns object with numeric keys AND named keys
  if (count.c > 0 || count[0] > 0) return;

  const { v4: uuidv4 } = require('uuid');
  const hash = p => bcrypt.hashSync(p, 10);

  const users = [
    { id:'user-1', name:'Akanksha', email:'akanksha@splito.app', xp:2450, level:4 },
    { id:'user-2', name:'Alice',    email:'alice@splito.app',    xp:1200, level:2 },
    { id:'user-3', name:'Bob',      email:'bob@splito.app',      xp:900,  level:2 },
    { id:'user-4', name:'Charlie',  email:'charlie@splito.app',  xp:600,  level:1 },
    { id:'user-5', name:'Dave',     email:'dave@splito.app',     xp:400,  level:1 },
  ];
  const insUser = db.prepare('INSERT INTO users (id,name,email,password,xp,level) VALUES (?,?,?,?,?,?)');
  users.forEach(u => insUser.run(u.id, u.name, u.email, hash('password123'), u.xp, u.level));

  const groups = [
    { id:'grp-1', name:'Goa Trip',  emoji:'🌴', desc:'Beach holiday!', by:'user-1' },
    { id:'grp-2', name:'Roommates', emoji:'🏠', desc:'Monthly bills',  by:'user-1' },
    { id:'grp-3', name:'Birthday',  emoji:'🎉', desc:"Alice's bday",   by:'user-2' },
  ];
  const insGrp = db.prepare('INSERT INTO groups (id,name,emoji,description,created_by) VALUES (?,?,?,?,?)');
  groups.forEach(g => insGrp.run(g.id, g.name, g.emoji, g.desc, g.by));

  const insM = db.prepare('INSERT INTO group_members (group_id,user_id,role) VALUES (?,?,?)');
  [
    ['grp-1','user-1','admin'],['grp-1','user-2','member'],['grp-1','user-3','member'],['grp-1','user-4','member'],
    ['grp-2','user-1','admin'],['grp-2','user-3','member'],['grp-2','user-5','member'],
    ['grp-3','user-2','admin'],['grp-3','user-1','member'],['grp-3','user-4','member'],['grp-3','user-5','member'],
  ].forEach(([g,u,r]) => insM.run(g, u, r));

  const expenses = [
    { id:'exp-1', gid:'grp-1', title:"Dinner at Tito's", amt:4000, cat:'food',          by:'user-1', em:'🍕', dt:'2026-04-03 18:00:00' },
    { id:'exp-2', gid:'grp-1', title:'Cab to Airport',    amt:800,  cat:'travel',        by:'user-3', em:'🚕', dt:'2026-04-02 10:30:00' },
    { id:'exp-3', gid:'grp-1', title:'Hotel Booking',     amt:12000,cat:'accommodation', by:'user-2', em:'🏨', dt:'2026-03-31 09:00:00' },
    { id:'exp-4', gid:'grp-2', title:'Groceries',         amt:1300, cat:'food',          by:'user-1', em:'🛒', dt:'2026-04-01 11:00:00' },
    { id:'exp-5', gid:'grp-2', title:'Electricity Bill',  amt:2400, cat:'home',          by:'user-3', em:'⚡', dt:'2026-03-28 14:00:00' },
    { id:'exp-6', gid:'grp-3', title:'Birthday Cake',     amt:1800, cat:'food',          by:'user-2', em:'🎂', dt:'2026-03-25 15:00:00' },
    { id:'exp-7', gid:'grp-1', title:'Snorkeling Tour',   amt:6000, cat:'fun',           by:'user-1', em:'🤿', dt:'2026-04-03 09:00:00' },
    { id:'exp-8', gid:'grp-2', title:'WiFi Bill',         amt:999,  cat:'home',          by:'user-5', em:'📶', dt:'2026-03-30 10:00:00' },
  ];
  const insE = db.prepare('INSERT INTO expenses (id,group_id,title,amount,category,paid_by,emoji,created_at) VALUES (?,?,?,?,?,?,?,?)');
  expenses.forEach(e => insE.run(e.id,e.gid,e.title,e.amt,e.cat,e.by,e.em,e.dt));

  const insSp = db.prepare('INSERT INTO expense_splits (id,expense_id,user_id,amount,is_settled) VALUES (?,?,?,?,?)');
  const splitMap = {
    'exp-1':['user-1','user-2','user-3','user-4'],
    'exp-2':['user-1','user-2','user-3','user-4'],
    'exp-3':['user-1','user-2','user-3','user-4'],
    'exp-4':['user-1','user-3','user-5'],
    'exp-5':['user-1','user-3','user-5'],
    'exp-6':['user-1','user-2','user-4','user-5'],
    'exp-7':['user-1','user-2','user-3','user-4'],
    'exp-8':['user-1','user-3','user-5'],
  };
  Object.entries(splitMap).forEach(([eid, members]) => {
    const exp = expenses.find(e => e.id === eid);
    const share = Math.round((exp.amt / members.length) * 100) / 100;
    members.forEach(uid => insSp.run(uuidv4(), eid, uid, share, uid === exp.by ? 1 : 0));
  });

  const insSett = db.prepare('INSERT INTO settlements (id,group_id,from_user,to_user,amount,method,is_paid,paid_at) VALUES (?,?,?,?,?,?,?,?)');
  insSett.run(uuidv4(),'grp-1','user-3','user-1',800,'Google Pay',1,'2026-04-02 12:00:00');
  insSett.run(uuidv4(),'grp-2','user-1','user-3',433,'Cash',1,'2026-03-29 09:00:00');
  insSett.run(uuidv4(),'grp-1','user-2','user-1',850,'UPI',0,null);

  const insN = db.prepare('INSERT INTO notifications (id,user_id,title,body,type,is_read,is_ai) VALUES (?,?,?,?,?,?,?)');
  insN.run(uuidv4(),'user-1','Payment Received','Bob paid you ₹800 for Goa Trip cab.','success',0,0);
  insN.run(uuidv4(),'user-1','New Expense Added','Alice added Hotel Booking ₹12,000 in Goa Trip.','info',0,0);
  insN.run(uuidv4(),'user-1','Budget Warning','You may exceed your food budget by tomorrow based on spending velocity.','error',0,1);
  insN.run(uuidv4(),'user-1','AI Insight','Your Thursday spending is 2× higher than usual.','ai',0,1);
  insN.run(uuidv4(),'user-1','Gentle Reminder','Charlie owes you ₹400 for lunch — 3 days pending.','warning',1,0);
  insN.run(uuidv4(),'user-1','Badge Earned','You unlocked the Smart Saver badge this week!','success',1,0);

  const insB = db.prepare('INSERT INTO badges (id,user_id,badge_key,title,description,icon) VALUES (?,?,?,?,?,?)');
  insB.run(uuidv4(),'user-1','smart_saver','Smart Saver','Spent 20% below average for 4 weeks','🧠');
  insB.run(uuidv4(),'user-1','top_contributor','Top Contributor','First to settle in 10 group trips','🏆');

  console.log('✅ Database seeded with demo data');
}

try { seed(); } catch(e) { console.warn('Seed skipped:', e.message); }

module.exports = db;
