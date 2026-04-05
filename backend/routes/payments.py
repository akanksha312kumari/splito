"""
Splito Payments Routes
POST /api/payments             — record settlement payment
GET  /api/payments/group/<id>  — payment history for a group
"""

from flask import Blueprint, request, jsonify
from database import get_conn, row_to_dict, rows_to_list, _uuid, _now
from utils.auth import require_auth

payments_bp = Blueprint('payments', __name__)


@payments_bp.route('', methods=['POST'])
@require_auth
def record_payment(current_user):
    data     = request.get_json(silent=True) or {}
    group_id = data.get('group_id')
    payee_id = data.get('payee_id')
    amount   = data.get('amount')
    note     = data.get('note', '')

    if not all([group_id, payee_id, amount]):
        return jsonify({'error': 'group_id, payee_id, amount are required'}), 400
    try:
        amount = float(amount)
        if amount <= 0: raise ValueError
    except (ValueError, TypeError):
        return jsonify({'error': 'amount must be a positive number'}), 400

    with get_conn() as conn:
        if not conn.execute(
            "SELECT 1 FROM group_members WHERE group_id=? AND user_id=?",
            (group_id, current_user['id'])
        ).fetchone():
            return jsonify({'error': 'Not a member of this group'}), 403

        pid = _uuid()
        conn.execute("INSERT INTO payments VALUES (?,?,?,?,?,?,?)",
            (pid, group_id, current_user['id'], payee_id, amount, note, _now()))
        conn.commit()

        p = row_to_dict(conn.execute("""
            SELECT p.*,
                   pu.username as payer_name,
                   pe.username as payee_name
            FROM payments p
            JOIN users pu ON pu.id = p.payer_id
            JOIN users pe ON pe.id = p.payee_id
            WHERE p.id=?
        """, (pid,)).fetchone())

    return jsonify({'payment': p}), 201


@payments_bp.route('/group/<group_id>', methods=['GET'])
@require_auth
def group_payments(current_user, group_id):
    with get_conn() as conn:
        if not conn.execute(
            "SELECT 1 FROM group_members WHERE group_id=? AND user_id=?",
            (group_id, current_user['id'])
        ).fetchone():
            return jsonify({'error': 'Not a member'}), 403

        rows = conn.execute("""
            SELECT p.*,
                   pu.username as payer_name,
                   pe.username as payee_name
            FROM payments p
            JOIN users pu ON pu.id = p.payer_id
            JOIN users pe ON pe.id = p.payee_id
            WHERE p.group_id=? ORDER BY p.created_at DESC
        """, (group_id,)).fetchall()

    return jsonify({'payments': rows_to_list(rows)})
