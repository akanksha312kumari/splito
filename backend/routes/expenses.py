"""
Splito Expenses Routes
GET    /api/expenses                   — my recent expenses
POST   /api/expenses                   — add expense
GET    /api/expenses/<id>              — detail
DELETE /api/expenses/<id>              — delete
PATCH  /api/expenses/<id>/settle       — settle my split
GET    /api/expenses/group/<group_id>  — expenses for a group
"""

from flask import Blueprint, request, jsonify
from database import get_conn, row_to_dict, rows_to_list, _uuid, _now
from utils.auth import require_auth

expenses_bp = Blueprint('expenses', __name__)


def _is_member(user_id, group_id):
    with get_conn() as conn:
        return conn.execute(
            "SELECT 1 FROM group_members WHERE group_id=? AND user_id=?",
            (group_id, user_id)
        ).fetchone()


def _expense_with_splits(eid):
    with get_conn() as conn:
        e = row_to_dict(conn.execute("""
            SELECT e.*, u.username as paid_by_name
            FROM expenses e JOIN users u ON u.id = e.paid_by_id
            WHERE e.id=?
        """, (eid,)).fetchone())
        if not e:
            return None
        splits = rows_to_list(conn.execute("""
            SELECT es.*, u.username
            FROM expense_splits es JOIN users u ON u.id = es.user_id
            WHERE es.expense_id=?
        """, (eid,)).fetchall())
        e['splits'] = splits
        return e


@expenses_bp.route('', methods=['GET'])
@require_auth
def list_my_expenses(current_user):
    uid = current_user['id']
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT e.*, u.username as paid_by_name
            FROM expenses e
            JOIN users u ON u.id = e.paid_by_id
            JOIN group_members gm ON gm.group_id = e.group_id
            WHERE gm.user_id=?
            ORDER BY e.created_at DESC LIMIT 50
        """, (uid,)).fetchall()
    return jsonify({'expenses': rows_to_list(rows)})


@expenses_bp.route('', methods=['POST'])
@require_auth
def add_expense(current_user):
    data         = request.get_json(silent=True) or {}
    group_id     = data.get('group_id')
    title        = (data.get('title') or '').strip()
    amount       = data.get('amount')
    category     = data.get('category', 'Other')
    split_type   = data.get('split_type', 'equal')
    participants = data.get('participants', [])
    custom_splits= data.get('custom_splits', {})
    notes        = data.get('notes', '')

    if not all([group_id, title, amount, participants]):
        return jsonify({'error': 'group_id, title, amount, participants are required'}), 400
    try:
        amount = float(amount)
        if amount <= 0: raise ValueError
    except (ValueError, TypeError):
        return jsonify({'error': 'amount must be a positive number'}), 400

    if not _is_member(current_user['id'], group_id):
        return jsonify({'error': 'Not a member of this group'}), 403

    # Build split map
    if split_type == 'equal':
        per = round(amount / len(participants), 2)
        splits_map = {uid: per for uid in participants}
    elif split_type == 'unequal':
        if not custom_splits:
            return jsonify({'error': 'custom_splits required for unequal split'}), 400
        total_c = sum(float(v) for v in custom_splits.values())
        if abs(total_c - amount) > 0.10:
            return jsonify({'error': f'custom_splits sum ({total_c:.2f}) must equal amount ({amount:.2f})'}), 400
        splits_map = {uid: float(v) for uid, v in custom_splits.items()}
    else:
        return jsonify({'error': 'split_type must be equal or unequal'}), 400

    eid = _uuid()
    with get_conn() as conn:
        conn.execute("INSERT INTO expenses VALUES (?,?,?,?,?,?,?,?,?,?)",
            (eid, group_id, current_user['id'], title, amount,
             category, split_type, notes, '', _now()))
        for uid, owed in splits_map.items():
            conn.execute("INSERT INTO expense_splits VALUES (?,?,?,?,?,?)",
                (_uuid(), eid, uid, owed, 0, None))
        conn.commit()

    return jsonify({'expense': _expense_with_splits(eid)}), 201


@expenses_bp.route('/group/<group_id>', methods=['GET'])
@require_auth
def group_expenses(current_user, group_id):
    if not _is_member(current_user['id'], group_id):
        return jsonify({'error': 'Not a member'}), 403

    page     = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    offset   = (page - 1) * per_page

    with get_conn() as conn:
        total = conn.execute(
            "SELECT COUNT(*) as c FROM expenses WHERE group_id=?", (group_id,)
        ).fetchone()['c']
        rows = conn.execute("""
            SELECT e.*, u.username as paid_by_name
            FROM expenses e JOIN users u ON u.id = e.paid_by_id
            WHERE e.group_id=? ORDER BY e.created_at DESC
            LIMIT ? OFFSET ?
        """, (group_id, per_page, offset)).fetchall()

    return jsonify({
        'expenses': rows_to_list(rows),
        'total':    total,
        'page':     page,
        'pages':    (total + per_page - 1) // per_page,
    })


@expenses_bp.route('/<expense_id>', methods=['GET'])
@require_auth
def get_expense(current_user, expense_id):
    e = _expense_with_splits(expense_id)
    if not e:
        return jsonify({'error': 'Expense not found'}), 404
    if not _is_member(current_user['id'], e['group_id']):
        return jsonify({'error': 'Not a member'}), 403
    return jsonify({'expense': e})


@expenses_bp.route('/<expense_id>', methods=['DELETE'])
@require_auth
def delete_expense(current_user, expense_id):
    with get_conn() as conn:
        e = row_to_dict(conn.execute("SELECT * FROM expenses WHERE id=?", (expense_id,)).fetchone())
        if not e:
            return jsonify({'error': 'Expense not found'}), 404

        if e['paid_by_id'] != current_user['id']:
            gm = conn.execute(
                "SELECT role FROM group_members WHERE group_id=? AND user_id=?",
                (e['group_id'], current_user['id'])
            ).fetchone()
            if not gm or gm['role'] != 'admin':
                return jsonify({'error': 'Only the payer or group admin can delete this'}), 403

        conn.execute("DELETE FROM expense_splits WHERE expense_id=?", (expense_id,))
        conn.execute("DELETE FROM expenses WHERE id=?", (expense_id,))
        conn.commit()

    return jsonify({'message': 'Expense deleted'})


@expenses_bp.route('/<expense_id>/settle', methods=['PATCH'])
@require_auth
def settle_split(current_user, expense_id):
    with get_conn() as conn:
        split = row_to_dict(conn.execute(
            "SELECT * FROM expense_splits WHERE expense_id=? AND user_id=?",
            (expense_id, current_user['id'])
        ).fetchone())
        if not split:
            return jsonify({'error': 'No split found for this user'}), 404
        conn.execute(
            "UPDATE expense_splits SET is_settled=1, settled_at=? WHERE id=?",
            (_now(), split['id'])
        )
        conn.commit()
        split['is_settled'] = 1
        split['settled_at'] = _now()
    return jsonify({'split': split})
