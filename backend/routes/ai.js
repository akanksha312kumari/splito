const express = require('express');
const router  = express.Router();
const db   = require('../database');
const auth = require('../middleware/auth');

// Middleware to check if user has AI enabled
const checkAiEnabled = (req, res, next) => {
  const settings = db.prepare('SELECT ai_enabled FROM user_settings WHERE user_id = ?').get(req.userId);
  if (settings && settings.ai_enabled === 0) {
    return res.status(403).json({ error: 'AI features are disabled by the user', ai_disabled: true });
  }
  next();
};

router.use(checkAiEnabled);

// Pure logic — compute AI spending score 0–100
function computeSpendingScore(userId) {
  const weekAgo   = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo  = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);

  const weekSpend = db.prepare(`
    SELECT COALESCE(SUM(es.amount), 0) AS t FROM expense_splits es
    JOIN expenses e ON e.id=es.expense_id
    JOIN group_members gm ON gm.group_id=e.group_id AND gm.user_id=?
    WHERE es.user_id=? AND e.created_at>=?
  `).get(userId, userId, weekAgo.toISOString().slice(0,10)).t;

  const monthSpend = db.prepare(`
    SELECT COALESCE(SUM(es.amount), 0) AS t FROM expense_splits es
    JOIN expenses e ON e.id=es.expense_id
    JOIN group_members gm ON gm.group_id=e.group_id AND gm.user_id=?
    WHERE es.user_id=? AND e.created_at>=?
  `).get(userId, userId, monthAgo.toISOString().slice(0,10)).t;

  const avg_per_week = monthSpend / 4.33;
  const ratio = avg_per_week > 0 ? weekSpend / avg_per_week : 1;

  // Settled balances on time
  const settledOnTime = db.prepare('SELECT COUNT(*) AS c FROM settlements WHERE from_user=? AND is_paid=1').get(userId).c;
  const totalSettlements = db.prepare('SELECT COUNT(*) AS c FROM settlements WHERE from_user=?').get(userId).c;
  const settlePct = totalSettlements > 0 ? settledOnTime / totalSettlements : 0;

  // Score formula
  let score = 50;
  if (ratio < 0.8) score += 20;
  else if (ratio < 1.0) score += 10;
  else if (ratio > 1.3) score -= 15;
  else if (ratio > 1.5) score -= 25;
  score += Math.round(settlePct * 30);

  return Math.min(100, Math.max(0, Math.round(score)));
}

// GET /api/ai/score
router.get('/score', auth, (req, res) => {
  const score = computeSpendingScore(req.userId);

  const trend_label = score >= 80 ? '📈 Trending Up' : score >= 60 ? '→ Stable' : '📉 Needs Work';
  const badge_tag   = score >= 90 ? '⭐ Gold Saver' : score >= 80 ? '🌟 Smart Splitter' : null;

  const summary = score >= 80
    ? 'You\'re splitting expenses efficiently and settling on time. Keep it up!'
    : score >= 60
      ? 'Decent performance. Try settling balances faster to boost your score.'
      : 'Several pending balances are dragging your score. Settle up to improve.';

  res.json({ score, summary, trend_label, badge_tag });
});

// GET /api/ai/report — full weekly AI report
router.get('/report', auth, (req, res) => {
  const score = computeSpendingScore(req.userId);
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const thisWeek = db.prepare(`
    SELECT COALESCE(SUM(es.amount), 0) AS t FROM expense_splits es
    JOIN expenses e ON e.id=es.expense_id
    JOIN group_members gm ON gm.group_id=e.group_id AND gm.user_id=?
    WHERE es.user_id=? AND e.created_at>=?
  `).get(req.userId, req.userId, weekAgo.toISOString().slice(0,10)).t;

  const lastWeek = db.prepare(`
    SELECT COALESCE(SUM(es.amount), 0) AS t FROM expense_splits es
    JOIN expenses e ON e.id=es.expense_id
    JOIN group_members gm ON gm.group_id=e.group_id AND gm.user_id=?
    WHERE es.user_id=? AND e.created_at>=? AND e.created_at<?
  `).get(req.userId, req.userId, twoWeeksAgo.toISOString().slice(0,10), weekAgo.toISOString().slice(0,10)).t;

  const saved    = Math.max(0, lastWeek - thisWeek);
  const trend    = thisWeek < lastWeek ? 'improving' : 'declining';
  const pctDelta = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : 0;

  // Top category this week
  const topCat = db.prepare(`
    SELECT e.category, SUM(es.amount) AS t FROM expense_splits es
    JOIN expenses e ON e.id=es.expense_id
    JOIN group_members gm ON gm.group_id=e.group_id AND gm.user_id=?
    WHERE es.user_id=? AND e.created_at>=?
    GROUP BY e.category ORDER BY t DESC LIMIT 1
  `).get(req.userId, req.userId, weekAgo.toISOString().slice(0,10));

  // Category breakdown for AIReport card analysis
  const catRows = db.prepare(`
    SELECT e.category, COALESCE(SUM(es.amount), 0) AS total
    FROM expense_splits es
    JOIN expenses e ON e.id=es.expense_id
    JOIN group_members gm ON gm.group_id=e.group_id AND gm.user_id=?
    WHERE es.user_id=? AND e.created_at>=?
    GROUP BY e.category ORDER BY total DESC
  `).all(req.userId, req.userId, weekAgo.toISOString().slice(0,10));

  const grand = catRows.reduce((s, r) => s + r.total, 0);
  const CAT_EMOJI = { food:'🍕', travel:'🚕', accommodation:'🏨', home:'🏠', fun:'🎉', shop:'🛒', flight:'✈️', other:'💸' };

  const categories = catRows.map(r => {
    const pct = grand > 0 ? Math.round((r.total / grand) * 100) : 0;
    return {
      name:   r.category[0].toUpperCase() + r.category.slice(1),
      emoji:  CAT_EMOJI[r.category] || '💸',
      amount: Math.round(r.total * 100) / 100,
      pct,
      status: pct > 40 ? 'bad' : pct > 25 ? 'warn' : 'good',
    };
  });

  // Restructure recommendations with title/message/action
  const recs = [];
  if (topCat?.category === 'food') {
    recs.push({ title: 'High Food Spend', message: `Food is your top category this week (₹${Math.round(topCat.t)}). Reducing dining out by 2 meals could save ~₹${Math.round(topCat.t * 0.3)}.`, action: 'View Food Expenses' });
  }
  if (score < 70) {
    recs.push({ title: 'Score Alert', message: 'Your expense score dropped. Try setting a ₹500/day budget for the next 7 days.', action: 'Set Budget' });
  }
  const pendingS = db.prepare('SELECT COUNT(*) AS c, SUM(amount) AS s FROM settlements WHERE from_user=? AND is_paid=0').get(req.userId);
  if (pendingS.c > 0) {
    recs.push({ title: 'Pending Settlements', message: `You have ${pendingS.c} pending settlement(s) totalling ₹${Math.round(pendingS.s || 0)}. Settling now boosts your XP by ${pendingS.c * 50} points.`, action: 'Settle Up Now' });
  }
  recs.push({ title: 'Track & Improve', message: `Keep it up! A score of ${score >= 85 ? '90+' : 85} will unlock the Gold Saver badge.`, action: null });

  res.json({
    score,
    trend,
    pct_delta: pctDelta,
    this_week_total: Math.round(thisWeek * 100) / 100,
    last_week_total: Math.round(lastWeek * 100) / 100,
    saved: Math.round(saved * 100) / 100,
    top_category: topCat?.category || null,
    categories,
    recommendations: recs,
  });
});

// GET /api/ai/suggestions — contextual AI tips
router.get('/suggestions', auth, (req, res) => {
  const suggestions = [];

  // Check for repeated payer in any group
  const repeatedPayers = db.prepare(`
    SELECT e.group_id, e.paid_by, COUNT(*) AS c, u.name AS payer_name, g.name AS group_name
    FROM expenses e
    JOIN users u ON u.id=e.paid_by
    JOIN groups g ON g.id=e.group_id
    JOIN group_members gm ON gm.group_id=e.group_id AND gm.user_id=?
    WHERE e.paid_by != ? AND e.created_at >= date('now','-30 days')
    GROUP BY e.group_id, e.paid_by
    HAVING c >= 3
    LIMIT 3
  `).all(req.userId, req.userId);

  repeatedPayers.forEach(r => {
    suggestions.push({
      type: 'repeated_payer',
      group_id: r.group_id,
      group_name: r.group_name,
      message: `${r.payer_name} has paid ${r.c} times in "${r.group_name}". Consider offering to cover the next expense.`,
    });
  });

  // Overspending on food?
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const topCat = db.prepare(`
    SELECT e.category, SUM(es.amount) AS t FROM expense_splits es
    JOIN expenses e ON e.id=es.expense_id
    JOIN group_members gm ON gm.group_id=e.group_id AND gm.user_id=?
    WHERE es.user_id=? AND e.created_at>=?
    GROUP BY e.category ORDER BY t DESC LIMIT 1
  `).get(req.userId, req.userId, weekAgo.toISOString().slice(0,10));

  if (topCat) {
    suggestions.push({
      type: 'overspend',
      message: `You are spending the most on ${topCat.category} this week (₹${Math.round(topCat.t)}).`,
    });
  }

  res.json(suggestions);
});

module.exports = router;
