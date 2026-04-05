"""
Splito Groups Routes
GET    /api/groups                   — list my groups
POST   /api/groups                   — create group
GET    /api/groups/<id>              — detail + members + recent expenses
POST   /api/groups/join              — join via invite code
DELETE /api/groups/<id>/leave        — leave group
GET    /api/groups/<id>/balances     — balances + simplified debt list
"""

import random, string
from flask import Blueprint, request, jsonify
from database import get_conn, row_to_dict, rows_to_list, _uuid, _now
from utils.auth import require_auth

groups_bp = Blueprint('groups', __name__)

ICONS = ['🏠','✈️','🍕','🎉','🏖️','🏋️','🎮','🛒','💼','🎵']


def _make_invite():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


# ── Balance engine ─────────────────────────────────────────────────────────

def compute_balances(group_id: str) -> dict:
    """
    Return {user_id: net_float} where positive = is owed money.
    Algorithm:
      For every unsettled split: payer gains split.amount_owed,
      participant loses split.amount_owed (skip when participant == payer).
    Payments (recorded settlements) adjust the balances directly.
    """
    balances = {}
    with get_conn() as conn:
        members = conn.execute(
            "SELECT user_id FROM group_members WHERE group_id=?", (group_id,)
        ).fetchall()
        for m in members:
            balances[m['user_id']] = 0.0

        rows = conn.execute("""
            SELECT e.paid_by_id, es.user_id, es.amount_owed
            FROM expense_splits es
            JOIN expenses e ON e.id = es.expense_id
            WHERE e.group_id=? AND es.is_settled=0
        """, (group_id,)).fetchall()

        for r in rows:
            if r['user_id'] == r['paid_by_id']:
                continue
            balances[r['paid_by_id']] = balances.get(r['paid_by_id'], 0) + r['amount_owed']
            balances[r['user_id']]    = balances.get(r['user_id'],    0) - r['amount_owed']

        payments = conn.execute(
            "SELECT payer_id, payee_id, amount FROM payments WHERE group_id=?", (group_id,)
        ).fetchall()
        for p in payments:
            balances[p['payer_id']] = balances.get(p['payer_id'], 0) + p['amount']
            balances[p['payee_id']] = balances.get(p['payee_id'], 0) - p['amount']

    return balances


def simplify_debts(balances: dict, group_id: str) -> list:
    """Greedy O(n²) debt simplification → minimal transactions."""
    with get_conn() as conn:
        users = {r['id']: r['username']
                 for r in conn.execute("SELECT id, username FROM users").fetchall()}

    creditors = sorted(
        [[uid, amt] for uid, amt in balances.items() if amt > 0.01], key=lambda x: -x[1])
    debtors   = sorted(
        [[uid, -amt] for uid, amt in balances.items() if amt < -0.01], key=lambda x: -x[1])

    txns = []
    i = j = 0
    while i < len(creditors) and j < len(debtors):
        cid, ca = creditors[i]
        did, da = debtors[j]
        settle   = min(ca, da)
        txns.append({
            'from_id':   did, 'from_name': users.get(did, did),
            'to_id':     cid, 'to_name':   users.get(cid, cid),
            'amount':    round(settle, 2)
        })
        creditors[i][1] -= settle
        debtors[j][1]   -= settle
        if creditors[i][1] < 0.01: i += 1
        if debtors[j][1]   < 0.01: j += 1

    return txns


# ── Route helpers ──────────────────────────────────────────────────────────

def _member_of(user_id, group_id):
    with get_conn() as conn:
        return conn.execute(
            "SELECT * FROM group_members WHERE group_id=? AND user_id=?",
            (group_id, user_id)
        ).fetchone()


def _group_dict(row: dict, member_count: int) -> dict:
    row['member_count'] = member_count
    return row


# ── Routes ─────────────────────────────────────────────────────────────────

@groups_bp.route('', methods=['GET'])
@require_auth
def list_groups(current_user):
    with get_conn() as conn:
        memberships = conn.execute(
            "SELECT group_id, role FROM group_members WHERE user_id=?",
            (current_user['id'],)
        ).fetchall()

    result = []
    for m in memberships:
        gid = m['group_id']
        with get_conn() as conn:
            g = row_to_dict(conn.execute("SELECT * FROM groups_ WHERE id=?", (gid,)).fetchone())
            cnt = conn.execute("SELECT COUNT(*) as c FROM group_members WHERE group_id=?", (gid,)).fetchone()['c']
        if not g:
            continue
        bal = compute_balances(gid)
        g['member_count'] = cnt
        g['my_balance']   = round(bal.get(current_user['id'], 0), 2)
        g['role']         = m['role']
        result.append(g)

    return jsonify({'groups': result})


@groups_bp.route('', methods=['POST'])
@require_auth
def create_group(current_user):
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Group name is required'}), 400

    gid = _uuid()
    icon = data.get('icon', random.choice(ICONS))

    with get_conn() as conn:
        conn.execute("INSERT INTO groups_ VALUES (?,?,?,?,?,?,?)",
            (gid, name, data.get('description',''), icon, _make_invite(),
             current_user['id'], _now()))
        conn.execute("INSERT INTO group_members VALUES (?,?,?,?,?)",
            (_uuid(), gid, current_user['id'], 'admin', _now()))
        conn.commit()
        g = row_to_dict(conn.execute("SELECT * FROM groups_ WHERE id=?", (gid,)).fetchone())
        g['member_count'] = 1

    return jsonify({'group': g}), 201


@groups_bp.route('/join', methods=['POST'])
@require_auth
def join_group(current_user):
    data = request.get_json(silent=True) or {}
    code = (data.get('invite_code') or '').strip().upper()
    if not code:
        return jsonify({'error': 'invite_code is required'}), 400

    with get_conn() as conn:
        g = row_to_dict(conn.execute("SELECT * FROM groups_ WHERE invite_code=?", (code,)).fetchone())
        if not g:
            return jsonify({'error': 'Invalid invite code'}), 404
        if conn.execute("SELECT 1 FROM group_members WHERE group_id=? AND user_id=?",
                        (g['id'], current_user['id'])).fetchone():
            return jsonify({'error': 'Already a member'}), 409
        conn.execute("INSERT INTO group_members VALUES (?,?,?,?,?)",
            (_uuid(), g['id'], current_user['id'], 'member', _now()))
        conn.commit()
        cnt = conn.execute("SELECT COUNT(*) as c FROM group_members WHERE group_id=?",
                           (g['id'],)).fetchone()['c']
        g['member_count'] = cnt

    return jsonify({'group': g}), 201


@groups_bp.route('/<group_id>', methods=['GET'])
@require_auth
def get_group(current_user, group_id):
    if not _member_of(current_user['id'], group_id):
        return jsonify({'error': 'Not a member of this group'}), 403

    with get_conn() as conn:
        g = row_to_dict(conn.execute("SELECT * FROM groups_ WHERE id=?", (group_id,)).fetchone())
        if not g:
            return jsonify({'error': 'Group not found'}), 404

        members_rows = conn.execute("""
            SELECT u.id, u.username, u.email, u.avatar_color, gm.role
            FROM group_members gm JOIN users u ON u.id = gm.user_id
            WHERE gm.group_id=?
        """, (group_id,)).fetchall()

        expenses_rows = conn.execute("""
            SELECT e.*, u.username as paid_by_name
            FROM expenses e JOIN users u ON u.id = e.paid_by_id
            WHERE e.group_id=? ORDER BY e.created_at DESC LIMIT 10
        """, (group_id,)).fetchall()

    bal = compute_balances(group_id)
    members = []
    for r in members_rows:
        d = dict(r)
        d['balance'] = round(bal.get(d['id'], 0), 2)
        members.append(d)

    g['member_count'] = len(members)

    return jsonify({
        'group':           g,
        'members':         members,
        'recent_expenses': rows_to_list(expenses_rows),
        'balances':        bal,
    })


@groups_bp.route('/<group_id>/leave', methods=['DELETE'])
@require_auth
def leave_group(current_user, group_id):
    gm = _member_of(current_user['id'], group_id)
    if not gm:
        return jsonify({'error': 'Not a member'}), 404
    with get_conn() as conn:
        conn.execute("DELETE FROM group_members WHERE group_id=? AND user_id=?",
                     (group_id, current_user['id']))
        conn.commit()
    return jsonify({'message': 'Left group'})


@groups_bp.route('/<group_id>/balances', methods=['GET'])
@require_auth
def group_balances(current_user, group_id):
    if not _member_of(current_user['id'], group_id):
        return jsonify({'error': 'Not a member'}), 403

    balances = compute_balances(group_id)
    txns     = simplify_debts(balances, group_id)

    with get_conn() as conn:
        users = {r['id']: r['username']
                 for r in conn.execute("SELECT id, username FROM users").fetchall()}

    bal_list = [
        {'user_id': uid, 'username': users.get(uid, uid), 'balance': round(amt, 2)}
        for uid, amt in balances.items()
    ]
    return jsonify({'balances': bal_list, 'suggested_payments': txns})
