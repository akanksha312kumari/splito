"""
Splito Analytics Routes — pure sqlite3
GET /api/analytics/overview     — personal overview (category + weekly trend)
GET /api/analytics/group/<id>   — group-level breakdown
GET /api/analytics/categories   — categories across all groups
GET /api/analytics/trends       — 12-week personal trend
"""

from flask import Blueprint, request, jsonify
from database import get_conn
from utils.auth import require_auth
from collections import defaultdict
from datetime import datetime, timezone, timedelta

analytics_bp = Blueprint('analytics', __name__)


def _now():
    return datetime.now(timezone.utc)


def _week_label(iso_str):
    try:
        dt = datetime.fromisoformat(iso_str.replace('Z', '+00:00'))
        return dt.strftime('%Y-W%V')
    except Exception:
        return iso_str[:10]


def _month_label(iso_str):
    try:
        dt = datetime.fromisoformat(iso_str.replace('Z', '+00:00'))
        return dt.strftime('%b %Y')
    except Exception:
        return iso_str[:7]


@analytics_bp.route('/overview', methods=['GET'])
@require_auth
def overview(current_user):
    days  = int(request.args.get('days', 30))
    since = (_now() - timedelta(days=days)).isoformat()
    uid   = current_user['id']

    with get_conn() as conn:
        # Amounts I owe (my splits, unsettled)
        splits = conn.execute("""
            SELECT es.amount_owed, e.category, e.created_at, e.amount, e.paid_by_id
            FROM expense_splits es
            JOIN expenses e ON e.id = es.expense_id
            JOIN group_members gm ON gm.group_id = e.group_id
            WHERE es.user_id=? AND es.is_settled=0 AND e.created_at >= ? AND gm.user_id=?
        """, (uid, since, uid)).fetchall()

        # Amounts I paid out
        paid = conn.execute("""
            SELECT amount, created_at FROM expenses
            WHERE paid_by_id=? AND created_at >= ?
        """, (uid, since)).fetchall()

    cat_totals = defaultdict(float)
    for s in splits:
        cat_totals[s['category']] += s['amount_owed']

    weekly = defaultdict(float)
    for e in paid:
        weekly[_week_label(e['created_at'])] += e['amount']

    total_paid = sum(e['amount'] for e in paid)
    total_owed = sum(s['amount_owed'] for s in splits)

    return jsonify({
        'category_breakdown': [
            {'category': cat, 'amount': round(amt, 2)}
            for cat, amt in sorted(cat_totals.items(), key=lambda x: -x[1])
        ],
        'weekly_trend': [
            {'week': w, 'amount': round(a, 2)} for w, a in sorted(weekly.items())
        ],
        'summary': {
            'total_paid': round(total_paid, 2),
            'total_owed': round(total_owed, 2),
            'expense_count': len(paid),
        },
    })


@analytics_bp.route('/group/<group_id>', methods=['GET'])
@require_auth
def group_analytics(current_user, group_id):
    with get_conn() as conn:
        if not conn.execute(
            "SELECT 1 FROM group_members WHERE group_id=? AND user_id=?",
            (group_id, current_user['id'])
        ).fetchone():
            return jsonify({'error': 'Not a member'}), 403

    days  = int(request.args.get('days', 30))
    since = (_now() - timedelta(days=days)).isoformat()

    with get_conn() as conn:
        exps = conn.execute("""
            SELECT e.*, u.username as paid_by_name
            FROM expenses e JOIN users u ON u.id = e.paid_by_id
            WHERE e.group_id=? AND e.created_at >= ?
        """, (group_id, since)).fetchall()

    cat_totals   = defaultdict(float)
    person_paid  = defaultdict(float)
    monthly      = defaultdict(float)

    for e in exps:
        cat_totals[e['category']]      += e['amount']
        person_paid[e['paid_by_name']] += e['amount']
        monthly[_month_label(e['created_at'])] += e['amount']

    total = sum(e['amount'] for e in exps)

    return jsonify({
        'category_breakdown': [
            {'category': cat, 'amount': round(amt, 2),
             'percentage': round(amt / max(total, 1) * 100, 1)}
            for cat, amt in sorted(cat_totals.items(), key=lambda x: -x[1])
        ],
        'per_person': [
            {'name': n, 'amount': round(a, 2)}
            for n, a in sorted(person_paid.items(), key=lambda x: -x[1])
        ],
        'monthly_trend': [
            {'month': m, 'amount': round(a, 2)} for m, a in sorted(monthly.items())
        ],
        'total':         round(total, 2),
        'expense_count': len(exps),
    })


@analytics_bp.route('/categories', methods=['GET'])
@require_auth
def categories_overview(current_user):
    days  = int(request.args.get('days', 30))
    since = (_now() - timedelta(days=days)).isoformat()
    uid   = current_user['id']

    with get_conn() as conn:
        splits = conn.execute("""
            SELECT es.amount_owed, e.category
            FROM expense_splits es
            JOIN expenses e ON e.id = es.expense_id
            JOIN group_members gm ON gm.group_id = e.group_id AND gm.user_id=?
            WHERE es.user_id=? AND e.created_at >= ?
        """, (uid, uid, since)).fetchall()

    cats  = defaultdict(float)
    for s in splits:
        cats[s['category']] += s['amount_owed']

    total = sum(cats.values()) or 1
    result = [
        {'category': cat, 'amount': round(amt, 2),
         'percentage': round(amt / total * 100, 1)}
        for cat, amt in sorted(cats.items(), key=lambda x: -x[1])
    ]
    return jsonify({'categories': result, 'total': round(total, 2)})


@analytics_bp.route('/trends', methods=['GET'])
@require_auth
def trends(current_user):
    since = (_now() - timedelta(weeks=12)).isoformat()
    uid   = current_user['id']

    with get_conn() as conn:
        splits = conn.execute("""
            SELECT es.amount_owed, e.created_at
            FROM expense_splits es
            JOIN expenses e ON e.id = es.expense_id
            JOIN group_members gm ON gm.group_id = e.group_id AND gm.user_id=?
            WHERE es.user_id=? AND e.created_at >= ?
        """, (uid, uid, since)).fetchall()

    weekly = defaultdict(float)
    for s in splits:
        weekly[_week_label(s['created_at'])] += s['amount_owed']

    return jsonify({
        'weekly': [{'week': w, 'amount': round(a, 2)} for w, a in sorted(weekly.items())]
    })
