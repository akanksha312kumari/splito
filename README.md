# 🔀 Splito — AI-Powered Expense Splitting App

> **Split smarter. Settle faster.**
> A production-grade fintech web application for shared expense management with smart AI insights.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔐 **Auth** | JWT-based register/login with bcrypt password hashing |
| 👥 **Groups** | Create groups, join via invite codes, manage members |
| 💸 **Expenses** | Add expenses with equal or custom splits across any participants |
| 🤖 **AI Insights** | Smart engine detects repeated payers, overspending, weekly summaries |
| 📊 **Analytics** | Category pie charts, weekly bar trends, per-person breakdowns |
| ✅ **Settlements** | Greedy debt simplification → minimal suggested payments |
| 📱 **Responsive** | Mobile-first design, works on all screen sizes |

---

## 🚀 Quick Start

### 1. Clone / unzip the project
```
splito/
├── backend/          ← Flask API
└── frontend/         ← HTML + CSS + JS (SPA)
```

### 2. Install dependencies
```bash
cd splito/backend
pip install flask PyJWT werkzeug
```
> **That's it.** Only 3 packages needed — no SQLAlchemy, no ORM, no extras.

### 3. Run the server
```bash
cd splito/backend
python app.py
```

### 4. Open the app
```
http://localhost:5000
```

### 5. Login with the demo account
| Field | Value |
|---|---|
| Email | `demo@splito.app` |
| Password | `demo1234` |

Demo data includes **2 groups**, **10 expenses**, and **4 users** pre-seeded.

---

## 🗂️ Project Structure

```
splito/
├── backend/
│   ├── app.py              # Flask app factory, CORS, SPA catch-all
│   ├── database.py         # sqlite3 schema, connection helper, seed data
│   ├── requirements.txt    # flask, PyJWT, werkzeug
│   ├── utils/
│   │   └── auth.py         # JWT encode/decode + @require_auth decorator
│   └── routes/
│       ├── auth.py         # POST /register, POST /login, GET /me
│       ├── groups.py       # CRUD groups + balance engine
│       ├── expenses.py     # CRUD expenses + split logic
│       ├── insights.py     # AI insight generators
│       ├── analytics.py    # Category & trend analytics
│       └── payments.py     # Settlement recording
│
└── frontend/
    ├── templates/
    │   └── index.html      # SPA shell (all views)
    └── static/
        ├── css/app.css     # Full fintech dark theme
        └── js/
            ├── api.js      # API client (Auth, GroupsAPI, ExpensesAPI…)
            └── app.js      # SPA router, rendering, event handling
```

---

## 🔌 REST API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login → JWT |
| GET | `/api/auth/me` | Current user profile |

### Groups
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/groups` | My groups with balances |
| POST | `/api/groups` | Create group |
| GET | `/api/groups/<id>` | Group detail + members |
| POST | `/api/groups/join` | Join via `invite_code` |
| DELETE | `/api/groups/<id>/leave` | Leave group |
| GET | `/api/groups/<id>/balances` | Balances + simplified payments |

### Expenses
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/expenses` | My recent expenses |
| POST | `/api/expenses` | Add expense (equal/unequal) |
| GET | `/api/expenses/group/<id>` | Paginated group expenses |
| DELETE | `/api/expenses/<id>` | Delete expense |
| PATCH | `/api/expenses/<id>/settle` | Settle my split |

### Insights & Analytics
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/insights` | Personal AI insight cards |
| GET | `/api/insights/group/<id>` | Group insights |
| GET | `/api/analytics/overview` | Personal spend summary |
| GET | `/api/analytics/categories` | Category breakdown |
| GET | `/api/analytics/trends` | 12-week weekly trend |

### Payments
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/payments` | Record a settlement |
| GET | `/api/payments/group/<id>` | Payment history |

---

## 🧠 AI Insights Engine

The insights engine runs rule-based analysis that *feels* AI-powered:

| Insight | Trigger |
|---|---|
| **Repeated Payer** | One person paid > 60% of last 10 expenses |
| **Overspending** | Any category > 40% of monthly group spend |
| **Balance Warning** | User owes > ₹100 unsettled |
| **Weekly Summary** | Auto-generated spend digest every 7 days |
| **Big Spender** | Largest single expense flagged |
| **Savings Streak** | This week's spend < 80% of last week's |

---

## 🗄️ Database Schema

```sql
users          — id, username, email, password_hash, avatar_color
groups_        — id, name, description, icon, invite_code, created_by
group_members  — id, group_id, user_id, role
expenses       — id, group_id, paid_by_id, title, amount, category, split_type
expense_splits — id, expense_id, user_id, amount_owed, is_settled
payments       — id, group_id, payer_id, payee_id, amount, note
```

---

## 🎨 Design System

- **Palette**: Deep navy bg (`#0c0f1a`) + neon lime accent (`#b8ff3c`)
- **Typography**: Syne (display/headings) + DM Sans (body)
- **Theme**: Refined fintech dark — geometric precision, editorial feel
- **Charts**: Chart.js 4 with custom dark-mode styling

---

## 🔧 Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | `splito-dev-secret-change-me` | JWT signing key |
| `DATABASE_URL` | `./splito.db` | SQLite path (swap for postgres URI) |

---

## 🐘 Migrating to PostgreSQL

1. Replace `sqlite3` with `psycopg2`
2. Change `?` placeholders to `%s`
3. Set `DATABASE_URL=postgresql://user:pass@host/dbname`
4. The schema is 100% standard SQL — no migration needed

---

## 🏆 Built for Competition

- Clean separation of concerns (MVC-ish)
- Token auth with expiry
- Paginated endpoints
- Greedy debt simplification algorithm
- Zero-dependency frontend (vanilla JS SPA)
- Mobile responsive

---

*Made with ❤️ — Splito v1.0*
