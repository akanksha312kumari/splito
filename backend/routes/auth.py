"""
Splito Auth Routes
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
"""

import random
from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from database import get_conn, row_to_dict, _uuid, _now
from utils.auth import generate_token, require_auth

auth_bp = Blueprint('auth', __name__)

AVATAR_COLORS = ['#6366f1','#ec4899','#14b8a6','#f59e0b','#8b5cf6',
                 '#ef4444','#10b981','#3b82f6','#f97316','#06b6d4']


def _user_dict(row: dict) -> dict:
    row.pop('password_hash', None)
    return row


@auth_bp.route('/register', methods=['POST'])
def register():
    data     = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    email    = (data.get('email')    or '').strip().lower()
    password = (data.get('password') or '').strip()

    if not all([username, email, password]):
        return jsonify({'error': 'username, email and password are required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    with get_conn() as conn:
        if conn.execute("SELECT 1 FROM users WHERE email=?",   (email,)).fetchone():
            return jsonify({'error': 'Email already registered'}), 409
        if conn.execute("SELECT 1 FROM users WHERE username=?", (username,)).fetchone():
            return jsonify({'error': 'Username already taken'}), 409

        uid = _uuid()
        conn.execute(
            "INSERT INTO users VALUES (?,?,?,?,?,?)",
            (uid, username, email, generate_password_hash(password),
             random.choice(AVATAR_COLORS), _now())
        )
        conn.commit()
        user = row_to_dict(conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone())

    token = generate_token(uid)
    return jsonify({'token': token, 'user': _user_dict(user)}), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data     = request.get_json(silent=True) or {}
    email    = (data.get('email')    or '').strip().lower()
    password = (data.get('password') or '').strip()

    if not email or not password:
        return jsonify({'error': 'email and password are required'}), 400

    with get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()

    if not row or not check_password_hash(row['password_hash'], password):
        return jsonify({'error': 'Invalid credentials'}), 401

    user  = row_to_dict(row)
    token = generate_token(user['id'])
    return jsonify({'token': token, 'user': _user_dict(user)})


@auth_bp.route('/me', methods=['GET'])
@require_auth
def me(current_user):
    return jsonify({'user': _user_dict(current_user)})
