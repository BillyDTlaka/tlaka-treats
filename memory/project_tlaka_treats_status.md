---
name: project-tlaka-treats-status
description: Architecture overview, active apps, and what is/isn't being used for launch
metadata:
  type: project
---

The production launch strategy is PWA-only. Mobile code stays but is not worked on.

## The Four Codebases

| Folder | What it is | Status |
|--------|-----------|--------|
| `web/` | **THE** production PWA — 16k-line vanilla JS single-file app, deployed to Vercel | ACTIVE — this is what users see |
| `web-admin/` | A React/Vite admin PWA (less complete, separate deploy) | Secondary — may consolidate into web/ |
| `web-customer/` | A React/Vite customer PWA | Secondary |
| `mobile/` | Expo app (admin + customer + ambassador roles) | NOT being used going forward, code preserved |
| `mobile-customer/` | Expo app (customer + ambassador roles) | NOT being used going forward, code preserved |

**Why:** User confirmed launch will be PWA only. All future feature work goes into `web/`.

## web/ Architecture (the real PWA)

Single `index.html` (~16,000 lines), deployed on Vercel (projectId: prj_lnrtS5NlHjnd9TLFy4kPmYRoC2gx).
Vanilla JS with Tailwind CDN. Service worker in `sw.js`. No build step.

### Admin modules (ADMIN_NAV):
- **Dashboard** — business KPI overview
- **Sales** → tabs: Orders, Customers, Ambassadors (+ Quotes)
- **Catalogue** → tabs: Products, Recipes
- **Operations** → tabs: Production, Inventory, Suppliers
- **Finance** — full financial management (transactions, bank accounts, commissions, payouts)
- **Reports** — analytics (inventory, production, sales)
- **People** — full HR (staff, casual, org chart, contracts, qualifications, timesheets, schedule, leave, payroll)
- **Bohlale** — AI assistant (board meetings, strategy, chat)
- **Settings** — store configuration
- **Users** — user management, roles & permissions

### Customer portal (CustomerHomePage):
- Product browsing/home
- Product detail
- Checkout
- Orders list (needs order detail — currently no expand/drilldown)
- Profile + addresses
- Ambassador apply / status

### Ambassador portal (AmbassadorDashboardPage):
- Dashboard
- Shop + product detail
- Orders
- KYC submission

## API Backend (Railway)
URL: https://tlaka-treats-production.up.railway.app

Key module prefixes: /auth, /products, /orders, /ambassadors, /customers, /addresses,
/suppliers, /inventory, /recipes, /production, /finance, /quotes, /discount-rules,
/packaging, /uom, /reports, /board, /employees, /company, /departments, /tasks,
/strategy, /chat, /pricing, /leads, /users, /dashboard, /payments, /uploads

## Known gaps in web/ PWA to address:
1. Customer order detail — Orders list shows summary, no expandable detail view
2. Any features in web-admin/ or mobile that web/ doesn't have yet

**How to apply:** All new features go in `web/index.html`. Do not add features to web-admin/ or mobile/.
