# Bundl — Group Buying Platform

A full-stack group-buying platform where buyers join purchase groups for products at wholesale prices. If the target is met before the deadline, all buyers are charged and receive a pickup code.

## Tech Stack

- **Frontend**: React 18 + Vite, React Router v6
- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **Auth**: JWT (jsonwebtoken + bcryptjs)
- **Payments**: Mock Tranzila interface (correct API shape, no real calls)
- **QR codes**: qrcode npm package

---

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL running locally (or a connection string)

### 1. Clone & install

```bash
# Backend
cd bundl/backend
npm install

# Frontend
cd bundl/frontend
npm install
```

### 2. Configure environment

```bash
cd bundl/backend
cp .env.example .env
# Edit .env — set DATABASE_URL to your PostgreSQL connection string
# DATABASE_URL=postgresql://postgres:password@localhost:5432/bundl
```

### 3. Create database & migrate

```bash
# Create the database first
psql -U postgres -c "CREATE DATABASE bundl;"

# Run migrations (creates all tables)
cd bundl/backend
npm run migrate

# Seed with demo data
npm run seed
```

### 4. Start the servers

```bash
# Terminal 1 — Backend (port 3001)
cd bundl/backend
npm run dev

# Terminal 2 — Frontend (port 5173)
cd bundl/frontend
npm run dev
```

Open http://localhost:5173

---

## Demo Accounts

| Role   | Email                      | Password     |
|--------|----------------------------|--------------|
| Admin  | admin@bundl.app            | password123  |
| Seller | tech_seller@bundl.app      | password123  |
| Buyer  | buyer1@bundl.app           | password123  |

Or use the quick login buttons on the login page.

---

## Key Features

### Buyer
- Browse groups without login
- Join groups (login required) — card validated via mock Tranzila
- View pickup codes (QR + alphanumeric) for completed purchases
- Rate sellers after pickup
- Request seller status

### Seller
- Create group buys from approved catalog
- Suggest new products (pending admin approval)
- Analytics dashboard (buyers, revenue, group status)
- Handle `PENDING_SELLER_DECISION` — Accept Partial or Reopen

### Admin
- Stats dashboard
- Freeze / unfreeze / delete users
- Approve / reject seller requests
- Approve / reject catalog product suggestions
- Manual refunds

---

## Business Logic Highlights

### Concurrency Lock (No Over-filling)
`groupService.js` uses `SELECT ... FOR UPDATE` row-level locking in a PostgreSQL transaction when a buyer joins. The group can never exceed `target_buyers`.

### Status Machine
```
ACTIVE → PROCESSING_PAYMENT → COMPLETED
                            → PENDING_SELLER_DECISION → COMPLETED (accept partial)
                                                      → ACTIVE (reopen)
ACTIVE → CANCELLED (expired, background job)
```

### No-Escape Rule
A buyer cannot leave if:
1. `current_buyers >= target_buyers` (group target already reached)
2. Group expires within 24 hours

### Data Snapshots
When a group is created, `product_snapshot JSONB` captures the product's name, brand, image, and description at that moment. Future catalog edits don't affect existing groups.

### Background Jobs
`jobService.js` runs a `setInterval` every 60 seconds to:
- Cancel expired active groups and notify all members
- Send 24-hour expiry reminders to group members

---

## API Reference

### Auth
- `POST /api/auth/register` — register
- `POST /api/auth/login` — login
- `GET /api/auth/me` — current user

### Groups
- `GET /api/groups` — browse (params: search, category, section, page)
- `GET /api/groups/:id` — group detail
- `POST /api/groups` — create (seller)
- `POST /api/groups/:id/join` — join
- `DELETE /api/groups/:id/leave` — leave
- `POST /api/groups/:id/decision` — seller decision (accept_partial | reopen)
- `GET /api/groups/:id/members` — member list (seller)
- `GET /api/groups/seller/my` — seller's own groups

### Users
- `GET /api/users/me/memberships` — buyer's groups
- `GET /api/users/me/memberships/:id/qr` — QR code
- `GET/POST/DELETE /api/users/me/payment-methods` — manage cards
- `POST /api/users/me/reviews` — submit review
- `POST /api/users/me/seller-request` — request seller role
- `GET /api/users/me/notifications` — in-app notifications
- `PUT /api/users/me/notifications/read` — mark all read

### Catalog
- `GET /api/catalog` — product list
- `GET /api/catalog/categories` — category list
- `POST /api/catalog/suggest` — suggest product (seller)

### Admin
- `GET /api/admin/stats` — dashboard stats
- `GET /api/admin/users` — all users (with search/filter)
- `PUT /api/admin/users/:id/freeze|unfreeze` — manage users
- `DELETE /api/admin/users/:id` — delete user
- `GET /api/admin/seller-requests` — pending seller requests
- `POST /api/admin/seller-requests/:id/approve|reject`
- `GET /api/admin/catalog-suggestions`
- `POST /api/admin/catalog-suggestions/:id/approve|reject`
- `POST /api/admin/refund/:membershipId` — manual refund

---

## Connecting Real Tranzila

Replace `src/services/paymentService.js` mock functions with real HTTP calls to `https://secure5.tranzila.com/cgi-bin/tranzila71u.cgi`. The interface (validateToken, chargeToken, refundTransaction) stays identical.

## Future-proofing (per PRD §7)
- **Delivery**: Add `delivery_method` field to `purchase_groups`, route pickup codes to shipping APIs
- **Commission**: Add `commission_pct` to groups, deduct in `processGroupPayments`
- **Multiple gateways**: `paymentService.js` is already abstracted — add a `gateway` param to route between providers
