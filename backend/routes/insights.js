const express = require('express');
const router  = express.Router();
const db   = require('../database');
const auth = require('../middleware/auth');

// GET /api/insights/summary — overall balance totals
router.get('/summary', auth, (req, res) => {
  // Total owed to me
  const owedToMe = db.prepare(`
    SELECT COALESCE(SUM(es.amount), 0) AS total
    FROM expense_splits es
    JOIN expenses e ON e.id = es.expense_id
    JOIN group_members gm ON gm.group_id = e.group_id AND gm.user_id = ?
    WHERE e.paid_by = ? AND es.user_id != ? AND es.is_settled = 0
  `).get(req.userId, req.userId, req.userId).total;

  // Total I owe
  const iOwe = db.prepare(`
    SELECT COALESCE(SUM(es.amount), 0) AS total
    FROM expense_splits es
    JOIN expenses e ON e.id = es.expense_id
    JOIN group_members gm ON gm.group_id = e.group_id AND gm.user_id = ?
    WHERE es.user_id = ? AND e.paid_by != ? AND es.is_settled = 0
  `).get(req.userId, req.userId, req.userId).total;

  // Total spent this month
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const monthlySpend = db.prepare(`
    SELECT COALESCE(SUM(e.amount), 0) AS total
    FROM expenses e
    JOIN group_members gm ON gm.group_id = e.group_id AND gm.user_id = ?
    WHERE e.paid_by = ? AND e.created_at >= ?
  `).get(req.userId, req.userId, monthStart).total;

  // Active groups
  const groupCount = db.prepare('SELECT COUNT(*) AS c FROM group_members WHERE user_id=?').get(req.userId).c;

  // Pending count
  const pendingCount = db.prepare(`
    SELECT COUNT(*) AS c FROM settlements WHERE from_user=? AND is_paid=0
  `).get(req.userId).c;

  res.json({
    owed_to_me: Math.round(owedToMe * 100) / 100,
    i_owe:      Math.round(iOwe * 100) / 100,
    net:        Math.round((owedToMe - iOwe) * 100) / 100,
    monthly_spend: Math.round(monthlySpend * 100) / 100,
    group_count:   groupCount,
    pending_count: pendingCount,
  });
});

// GET /api/insights/categories — spending breakdown by category
router.get('/categories', auth, (req, res) => {
  const { period = 'month' } = req.query;
  const since = getSinceDate(period);

  const rows = db.prepare(`
    SELECT e.category, COALESCE(SUM(es.amount), 0) AS total, COUNT(*) AS count
    FROM expense_splits es
    JOIN expenses e ON e.id = es.expense_id
    JOIN group_members gm ON gm.group_id = e.group_id AND gm.user_id = ?
    WHERE es.user_id = ? AND e.created_at >= ?
    GROUP BY e.category
    ORDER BY total DESC
  `).all(req.userId, req.userId, since);

  const grand = rows.reduce((s, r) => s + r.total, 0);
  res.json(rows.map(r => ({
    category: r.category,
    total:    Math.round(r.total * 100) / 100,
    count:    r.count,
    pct:      grand > 0 ? Math.round((r.total / grand) * 1000) / 10 : 0,
  })));
});

// GET /api/insights/trends — daily spending for graph
router.get('/trends', auth, (req, res) => {
  const { period = 'week' } = req.query;
  const since = getSinceDate(period);
  const fmt   = period === 'year' ? '%Y-%m' : '%Y-%m-%d';

  const rows = db.prepare(`
    SELECT strftime('${fmt}', e.created_at) AS date,
           COALESCE(SUM(es.amount), 0) AS total
    FROM expense_splits es
    JOIN expenses e ON e.id = es.expense_id
    JOIN group_members gm ON gm.group_id = e.group_id AND gm.user_id = ?
    WHERE es.user_id = ? AND e.created_at >= ?
    GROUP BY date
    ORDER BY date ASC
  `).all(req.userId, req.userId, since);

  res.json(rows.map(r => ({
    date:   r.date,
    amount: Math.round(r.total * 100) / 100,
    label:  fmtLabel(r.date, period),
  })));
});

// GET /api/insights/breakdown — COMBINED categories + trend for the Insights page
router.get('/breakdown', auth, (req, res) => {
  const { period = 'week' } = req.query;
  const since = getSinceDate(period);
  const fmt   = period === 'year' ? '%Y-%m' : '%Y-%m-%d';

  // Categories
  const catRows = db.prepare(`
    SELECT e.category, COALESCE(SUM(es.amount), 0) AS total
    FROM expense_splits es
    JOIN expenses e ON e.id = es.expense_id
    JOIN group_members gm ON gm.group_id = e.group_id AND gm.user_id = ?
    WHERE es.user_id = ? AND e.created_at >= ?
    GROUP BY e.category ORDER BY total DESC
  `).all(req.userId, req.userId, since);

  const grand = catRows.reduce((s, r) => s + r.total, 0);

  // Trend
  const trendRows = db.prepare(`
    SELECT strftime('${fmt}', e.created_at) AS date,
           COALESCE(SUM(es.amount), 0) AS total
    FROM expense_splits es
    JOIN expenses e ON e.id = es.expense_id
    JOIN group_members gm ON gm.group_id = e.group_id AND gm.user_id = ?
    WHERE es.user_id = ? AND e.created_at >= ?
    GROUP BY date ORDER BY date ASC
  `).all(req.userId, req.userId, since);

  // Prev period for comparison
  const prevSince = getSinceDate(period, 2);
  const prevTotal = db.prepare(`
    SELECT COALESCE(SUM(es.amount), 0) AS t
    FROM expense_splits es JOIN expenses e ON e.id=es.expense_id
    JOIN group_members gm ON gm.group_id=e.group_id AND gm.user_id=?
    WHERE es.user_id=? AND e.created_at>=? AND e.created_at<?
  `).get(req.userId, req.userId, prevSince, since).t;

  let comparison = null;
  if (prevTotal > 0) {
    const delta = Math.round(((grand - prevTotal) / prevTotal) * 100);
    comparison = delta < 0
      ? `You spent ${Math.abs(delta)}% less than last ${period}. 🎉 Great job saving!`
      : `You spent ${delta}% more than last ${period}. Consider reviewing ${catRows[0]?.category || 'your top'} expenses.`;
  }

  res.json({
    categories: catRows.map(r => ({
      category: r.category,
      amount:   Math.round(r.total * 100) / 100,
      pct:      grand > 0 ? Math.round((r.total / grand) * 1000) / 10 : 0,
    })),
    trend: trendRows.map(r => ({
      date:   r.date,
      amount: Math.round(r.total * 100) / 100,
      label:  fmtLabel(r.date, period),
    })),
    total: Math.round(grand * 100) / 100,
    comparison,
  });
});

// GET /api/insights/group-comparison — your spend vs group avg by category
router.get('/group-comparison', auth, (req, res) => {
  const { group_id, period = 'month' } = req.query;
  const since = getSinceDate(period);

  const query = (userId) => db.prepare(`
    SELECT e.category, COALESCE(SUM(es.amount), 0) AS total
    FROM expense_splits es
    JOIN expenses e ON e.id = es.expense_id
    ${group_id ? 'WHERE e.group_id=? AND' : 'JOIN group_members gm ON gm.group_id=e.group_id AND gm.user_id=? WHERE'} es.user_id=? AND e.created_at>=?
    GROUP BY e.category
  `).all(...(group_id ? [group_id, userId, since] : [userId, userId, since]));

  const mySpend    = Object.fromEntries(query(req.userId).map(r => [r.category, r.total]));
  const categories = [...new Set(Object.keys(mySpend))];

  res.json(categories.map(cat => ({
    category: cat,
    you:      Math.round((mySpend[cat] || 0) * 100) / 100,
  })));
});

function getSinceDate(period, multiplier = 1) {
  const d = new Date();
  if (period === 'week')  d.setDate(d.getDate() - 7 * multiplier);
  if (period === 'month') d.setMonth(d.getMonth() - 1 * multiplier);
  if (period === 'year')  d.setFullYear(d.getFullYear() - 1 * multiplier);
  return d.toISOString().slice(0, 10);
}

function fmtLabel(dateStr, period) {
  const d = new Date(dateStr + 'T00:00:00');
  if (period === 'year') return d.toLocaleString('en-IN', { month: 'short' });
  if (period === 'month') return d.toLocaleString('en-IN', { day: 'numeric', month: 'short' });
  return d.toLocaleString('en-IN', { weekday: 'short' }).slice(0,2);
}

module.exports = router;
