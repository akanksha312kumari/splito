"""
Splito — Database Layer (pure sqlite3, no SQLAlchemy)
Designed for easy migration to PostgreSQL via psycopg2.
"""

import sqlite3
import os
import uuid
from datetime import datetime, timezone, timedelta
from werkzeug.security import generate_password_hash
import random
import string

DB_PATH = os.path.join(os.path.dirname(__file__), 'splito.db')


def get_conn():
    """Return a sqlite3 connection with row_factory set."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def _uuid():
    return str(uuid.uuid4())


def _now():
    return datetime.now(timezone.utc).isoformat()


# ─────────────────────────────────────────────────────────────────────────────
# Schema
# ─────────────────────────────────────────────────────────────────────────────

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    avatar_color  TEXT DEFAULT '#6366f1',
    created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS groups_ (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT DEFAULT '',
    icon        TEXT DEFAULT '🏠',
    invite_code TEXT UNIQUE,
    created_by  TEXT NOT NULL,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS group_members (
    id        TEXT PRIMARY KEY,
    group_id  TEXT NOT NULL,
    user_id   TEXT NOT NULL,
    role      TEXT DEFAULT 'member',
    joined_at TEXT NOT NULL,
    UNIQUE(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS expenses (
    id          TEXT PRIMARY KEY,
    group_id    TEXT NOT NULL,
    paid_by_id  TEXT NOT NULL,
    title       TEXT NOT NULL,
    amount      REAL NOT NULL,
    category    TEXT DEFAULT 'Other',
    split_type  TEXT DEFAULT 'equal',
    notes       TEXT DEFAULT '',
    receipt_url TEXT DEFAULT '',
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expense_splits (
    id          TEXT PRIMARY KEY,
    expense_id  TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    amount_owed REAL NOT NULL,
    is_settled  INTEGER DEFAULT 0,
    settled_at  TEXT
);

CREATE TABLE IF NOT EXISTS payments (
    id         TEXT PRIMARY KEY,
    group_id   TEXT NOT NULL,
    payer_id   TEXT NOT NULL,
    payee_id   TEXT NOT NULL,
    amount     REAL NOT NULL,
    note       TEXT DEFAULT '',
    created_at TEXT NOT NULL
);
"""


def init_db():
    """Create tables and seed demo data."""
    with get_conn() as conn:
        conn.executescript(SCHEMA)
    _seed_demo()


def _make_invite():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


def _seed_demo():
    """Idempotent seed — only runs if demo user doesn't exist."""
    with get_conn() as conn:
        if conn.execute("SELECT 1 FROM users WHERE email='demo@splito.app'").fetchone():
            return

        colors = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6']
        members_raw = [
            ('Alex Demo',  'demo@splito.app',   colors[0]),
            ('Jordan Lee', 'jordan@splito.app',  colors[1]),
            ('Sam Chen',   'sam@splito.app',     colors[2]),
            ('Priya Nair', 'priya@splito.app',   colors[3]),
        ]
        member_ids = []
        for uname, email, color in members_raw:
            uid = _uuid()
            member_ids.append(uid)
            conn.execute(
                "INSERT INTO users VALUES (?,?,?,?,?,?)",
                (uid, uname, email, generate_password_hash('demo1234'), color, _now())
            )

        # Group 1 — Goa trip
        gid = _uuid()
        conn.execute("INSERT INTO groups_ VALUES (?,?,?,?,?,?,?)",
            (gid, 'Weekend Getaway 🏖️', 'Goa trip expenses', '🏖️',
             _make_invite(), member_ids[0], _now()))
        for i, uid in enumerate(member_ids):
            conn.execute("INSERT INTO group_members VALUES (?,?,?,?,?)",
                (_uuid(), gid, uid, 'admin' if i == 0 else 'member', _now()))

        # Group 2 — Flat
        gid2 = _uuid()
        conn.execute("INSERT INTO groups_ VALUES (?,?,?,?,?,?,?)",
            (gid2, 'Flat Expenses 🏠', 'Monthly shared costs', '🏠',
             _make_invite(), member_ids[0], _now()))
        for i, uid in enumerate(member_ids[:3]):
            conn.execute("INSERT INTO group_members VALUES (?,?,?,?,?)",
                (_uuid(), gid2, uid, 'admin' if i == 0 else 'member', _now()))

        expenses_seed = [
            ('Hotel Stay',           8400, 'Housing',       0, [0,1,2,3], gid,  18),
            ('Dinner at Beach Shack',2200, 'Food & Dining', 1, [0,1,2,3], gid,  16),
            ('Cab to Airport',       1200, 'Transport',     2, [0,1,2],   gid,  14),
            ('Snorkeling Trip',      3600, 'Entertainment', 0, [0,1,2,3], gid,  12),
            ('Groceries',             950, 'Food & Dining', 3, [0,1,2,3], gid,  10),
            ('Club Night',           4800, 'Entertainment', 1, [0,1,2,3], gid,   8),
            ('Monthly Rent',        15000, 'Housing',       0, [0,1,2],   gid2, 20),
            ('Electricity Bill',     1800, 'Utilities',     1, [0,1,2],   gid2, 15),
            ('Internet Plan',         999, 'Utilities',     2, [0,1,2],   gid2,  7),
            ('Groceries Run',        2400, 'Food & Dining', 0, [0,1,2],   gid2,  3),
        ]

        for title, amt, cat, payer_i, parts_i, grp_id, days_ago in expenses_seed:
            eid = _uuid()
            ts  = (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()
            payer_uid = member_ids[payer_i]
            conn.execute("INSERT INTO expenses VALUES (?,?,?,?,?,?,?,?,?,?)",
                (eid, grp_id, payer_uid, title, float(amt), cat, 'equal', '', '', ts))
            participants = [member_ids[j] for j in parts_i]
            per = round(amt / len(participants), 2)
            for uid in participants:
                conn.execute("INSERT INTO expense_splits VALUES (?,?,?,?,?,?)",
                    (_uuid(), eid, uid, per, 0, None))

        conn.commit()


def row_to_dict(row):
    return dict(row) if row else None


def rows_to_list(rows):
    return [dict(r) for r in rows]
