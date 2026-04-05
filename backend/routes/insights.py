"""
Splito Smart Insights Engine — pure sqlite3
GET /api/insights              — personal insight cards
GET /api/insights/group/<id>   — group-level insights
"""

from flask import Blueprint, jsonify
from database import get_conn
from utils.auth import require_auth
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta

insights_bp = Blueprint('insights', __name__)


# ── Helpers ────────────────────────────────────────────────────────────────

def _now():
    return datetime.now(timezone.utc)


def _my_group_ids(user_id):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT group_id FROM group_members WHERE user_id=?", (user_id,)
        ).fetchall()
    return [r['group_id'] for r in rows]


def _group_name(group_id):
    with get_conn() as conn:
        r = conn.execute("SELECT name FROM groups_ WHERE id=?", (group_id,)).fetchone()
    return r['name'] if r else group_id


def _group_expenses(group_id, days=30):
    since = (_now() - timedelta(days=days)).isoformat()
    with get_conn() as conn:
        return conn.execute("""
            SELECT e.*, u.username as paid_by_name
            FROM expenses e JOIN users u ON u.id = e.paid_by_id
            WHERE e.group_id=? AND e.created_at >= ?
        """, (group_id, since)).fetchall()


# ── Individual insight generators ─────────────────────────────────────────

def _insight_repeated_payer(group_id, group_name, user_id):
    with get_conn() as conn:
        exps = conn.execute("""
            SELECT paid_by_id FROM expenses
            WHERE group_id=? ORDER BY created_at DESC LIMIT 10
        """, (group_id,)).fetchall()
    if len(exps) < 3:
        return None

    counts = Counter(r['paid_by_id'] for r in exps)
    top_id, top_cnt = counts.most_common(1)[0]
    ratio = top_cnt / len(exps)
    if ratio < 0.6:
        return None

    with get_conn() as conn:
        u = conn.execute("SELECT username FROM users WHERE id=?", (top_id,)).fetchone()
    payer_name = u['username'] if u else 'Someone'

    if top_id == user_id:
        msg    = f"You've paid for {top_cnt} of the last {len(exps)} expenses in {group_name}. It's time for others to chip in! 💸"
        action = "Send a reminder"
    else:
        msg    = f"{payer_name} has covered {top_cnt} of the last {len(exps)} expenses in {group_name}. It might be your turn next!"
        action = "Offer to pay"

    return {
        'type': 'repeated_payer', 'priority': 'high', 'icon': '🔄',
        'title': 'Repeated Payer Detected', 'message': msg, 'action': action,
        'group_id': group_id, 'group_name': group_name,
        'data': {'payer_id': top_id, 'payer_name': payer_name, 'ratio': round(ratio * 100)},
    }


def _insight_overspending(group_id, group_name):
    exps = _group_expenses(group_id, days=30)
    if not exps:
        return None

    total = sum(e['amount'] for e in exps)
    cats  = defaultdict(float)
    for e in exps:
        cats[e['category']] += e['amount']

    for cat, amt in cats.items():
        if total > 0 and amt / total >= 0.40 and amt > 500:
            pct = round(amt / total * 100)
            return {
                'type': 'overspending', 'priority': 'medium', 'icon': '⚠️',
                'title': f'High {cat} Spend',
                'message': f'{pct}% of {group_name}\'s budget went to {cat} this month (₹{amt:,.0f}). Consider setting a limit.',
                'action': 'View breakdown',
                'group_id': group_id, 'group_name': group_name,
                'data': {'category': cat, 'amount': amt, 'percentage': pct},
            }
    return None


def _insight_weekly_summary(group_id, group_name):
    exps = _group_expenses(group_id, days=7)
    if not exps:
        return None
    total   = sum(e['amount'] for e in exps)
    top_cat = Counter(e['category'] for e in exps).most_common(1)[0][0]
    return {
        'type': 'weekly_summary', 'priority': 'low', 'icon': '📊',
        'title': 'Weekly Snapshot',
        'message': f'{group_name} spent ₹{total:,.0f} this week across {len(exps)} expense(s). Top category: {top_cat}.',
        'action': 'See analytics',
        'group_id': group_id, 'group_name': group_name,
        'data': {'total': total, 'count': len(exps), 'top_category': top_cat},
    }


def _insight_balance_warning(group_id, group_name, user_id):
    from routes.groups import compute_balances
    bal    = compute_balances(group_id)
    my_bal = bal.get(user_id, 0)
    if my_bal >= -100:
        return None
    return {
        'type': 'balance_warning', 'priority': 'high', 'icon': '💰',
        'title': 'Unsettled Balance',
        'message': f'You owe ₹{abs(my_bal):,.0f} in {group_name}. Settling up keeps friendships intact! 😊',
        'action': 'Settle now',
        'group_id': group_id, 'group_name': group_name,
        'data': {'balance': my_bal},
    }


def _insight_big_spender(group_id, group_name):
    exps = _group_expenses(group_id, days=7)
    if not exps:
        return None
    biggest = max(exps, key=lambda e: e['amount'])
    if biggest['amount'] < 500:
        return None
    return {
        'type': 'big_spender', 'priority': 'low', 'icon': '🏆',
        'title': 'Biggest Expense This Week',
        'message': f'"{biggest["title"]}" was {group_name}\'s biggest purchase at ₹{biggest["amount"]:,.0f}.',
        'action': 'View expense',
        'group_id': group_id, 'group_name': group_name,
        'data': {'expense_id': biggest['id'], 'amount': biggest['amount']},
    }


def _insight_savings_streak(group_id, group_name):
    """Celebrate if this week's spend is lower than last week's."""
    this_week = sum(e['amount'] for e in _group_expenses(group_id, days=7))
    last_week_exps = []
    with get_conn() as conn:
        since2 = (_now() - timedelta(days=14)).isoformat()
        till   = (_now() - timedelta(days=7)).isoformat()
        last_week_exps = conn.execute("""
            SELECT amount FROM expenses
            WHERE group_id=? AND created_at >= ? AND created_at < ?
        """, (group_id, since2, till)).fetchall()
    last_week = sum(e['amount'] for e in last_week_exps)
    if last_week > 0 and this_week < last_week * 0.8:
        saved = round(last_week - this_week, 2)
        return {
            'type': 'savings_streak', 'priority': 'low', 'icon': '🌱',
            'title': 'Spending Down This Week!',
            'message': f'{group_name} spent ₹{saved:,.0f} less than last week. Great discipline!',
            'action': 'Keep it up',
            'group_id': group_id, 'group_name': group_name,
            'data': {'saved': saved},
        }
    return None


# ── Personal stats ─────────────────────────────────────────────────────────

def _personal_stats(user_id, group_ids):
    since = (_now() - timedelta(days=30)).isoformat()
    with get_conn() as conn:
        paid_total = conn.execute("""
            SELECT COALESCE(SUM(amount),0) as total
            FROM expenses WHERE paid_by_id=? AND created_at >= ?
        """, (user_id, since)).fetchone()['total']

        fav_rows = conn.execute("""
            SELECT category, COUNT(*) as cnt
            FROM expenses WHERE paid_by_id=? AND created_at >= ?
            GROUP BY category ORDER BY cnt DESC LIMIT 1
        """, (user_id, since)).fetchone()

    fav_cat = fav_rows['category'] if fav_rows else 'N/A'

    from routes.groups import compute_balances
    owed_to_me = 0.0
    i_owe      = 0.0
    for gid in group_ids:
        bal = compute_balances(gid)
        b   = bal.get(user_id, 0)
        if b > 0:  owed_to_me += b
        else:      i_owe      += abs(b)

    return {
        'total_paid_30d':   round(paid_total, 2),
        'total_owed_to_me': round(owed_to_me, 2),
        'total_i_owe':      round(i_owe, 2),
        'net_balance':      round(owed_to_me - i_owe, 2),
        'favourite_category': fav_cat,
        'active_groups':    len(group_ids),
    }


# ── Routes ─────────────────────────────────────────────────────────────────

@insights_bp.route('', methods=['GET'])
@require_auth
def get_insights(current_user):
    uid       = current_user['id']
    group_ids = _my_group_ids(uid)
    all_ins   = []

    for gid in group_ids:
        gname = _group_name(gid)
        for fn in (_insight_repeated_payer, _insight_balance_warning):
            try:
                ins = fn(gid, gname, uid)
                if ins: all_ins.append(ins)
            except Exception: pass

        for fn in (_insight_overspending, _insight_weekly_summary,
                   _insight_big_spender, _insight_savings_streak):
            try:
                ins = fn(gid, gname)
                if ins: all_ins.append(ins)
            except Exception: pass

    priority_order = {'high': 0, 'medium': 1, 'low': 2}
    all_ins.sort(key=lambda x: priority_order.get(x['priority'], 3))

    return jsonify({
        'insights':       all_ins[:8],
        'personal_stats': _personal_stats(uid, group_ids),
    })


@insights_bp.route('/group/<group_id>', methods=['GET'])
@require_auth
def group_insights(current_user, group_id):
    with get_conn() as conn:
        if not conn.execute(
            "SELECT 1 FROM group_members WHERE group_id=? AND user_id=?",
            (group_id, current_user['id'])
        ).fetchone():
            return jsonify({'error': 'Not a member'}), 403

    gname  = _group_name(group_id)
    uid    = current_user['id']
    result = []
    for fn in (_insight_overspending, _insight_weekly_summary,
               _insight_big_spender, _insight_savings_streak):
        try:
            ins = fn(group_id, gname)
            if ins: result.append(ins)
        except Exception: pass
    for fn in (_insight_repeated_payer, _insight_balance_warning):
        try:
            ins = fn(group_id, gname, uid)
            if ins: result.append(ins)
        except Exception: pass

    return jsonify({'insights': result})
