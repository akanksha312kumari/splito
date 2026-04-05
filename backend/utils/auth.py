"""
Splito — Auth Utilities: JWT generation, decoding, and the @require_auth decorator.
"""

import jwt
import functools
from datetime import datetime, timezone, timedelta
from flask import request, jsonify, current_app
from database import get_conn, row_to_dict


def generate_token(user_id: str) -> str:
    hours = current_app.config.get('JWT_EXPIRATION_HOURS', 24)
    payload = {
        'sub': user_id,
        'iat': datetime.now(timezone.utc),
        'exp': datetime.now(timezone.utc) + timedelta(hours=hours),
    }
    return jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')


def decode_token(token: str):
    try:
        return jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_user_by_id(user_id: str):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
        return row_to_dict(row)


def require_auth(f):
    """Decorator — resolves Bearer JWT → injects current_user dict."""
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing or invalid Authorization header'}), 401
        token   = auth_header.split(' ', 1)[1]
        payload = decode_token(token)
        if not payload:
            return jsonify({'error': 'Token expired or invalid'}), 401
        user = get_user_by_id(payload['sub'])
        if not user:
            return jsonify({'error': 'User not found'}), 401
        return f(*args, current_user=user, **kwargs)
    return wrapper
