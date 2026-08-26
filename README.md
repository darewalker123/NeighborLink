# NeighborLink

NeighborLink is a production-style local community services marketplace for a third-year full-stack college project. It helps residents discover trusted nearby professionals, request a service, pay securely, chat, and review completed work.

## What is included

- React + TypeScript + Vite frontend with responsive marketplace, profile, booking, messaging, notification, provider, and admin experiences.
- Express + TypeScript REST API with Zod validation, consistent error responses, Helmet, rate limiting, CORS, JWT access/refresh sessions, role-based authorization, ownership checks, and Socket.IO authentication.
- PostgreSQL + Prisma relational model covering users, providers, services, availability, bookings, payments, transactions, reviews, conversations, notifications, favorites, verification, disputes, reports, audit logs, and settings.
- Availability validation and accepted-booking overlap prevention on the server.
- Stripe Checkout integration and a webhook handler. A development-only protected demo payment confirmation is available when Stripe keys are omitted.
- Admin overview powered by real database aggregation and Recharts visualizations.
- Fictional seed data: 30 residents/admin/providers, 10 categories, 20 services, 32 bookings, 22 reviews, payments, conversations, notifications, and a dispute.

## Architecture

```text
client/  React UI, routes, TanStack Query, React Hook Form + Zod
server/  Express API, middleware, services, Socket.IO, Prisma
server/prisma/  PostgreSQL schema and development seed
```

Important API routes are mounted at `/api`:

```text
/auth  /users  /providers  /services  /categories  /bookings
/payments  /reviews  /conversations  /notifications  /favorites
/disputes  /admin
```

Swagger UI is available at `http://localhost:4000/api/docs` while the API runs.

## Local setup

Prerequisites: Node.js 20+, npm, and PostgreSQL 15+.

```bash
npm install
Copy-Item .env.example server/.env
```

Update `server/.env` with a real PostgreSQL `DATABASE_URL` and long local JWT secrets, then create the database tables and development data:

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

The API uses port 4000 and the Vite application uses port 5173. Open `http://localhost:5173`.

## Demo accounts

All seeded accounts use the development-only password `NeighborLink@123`.

| Role | Email |
| --- | --- |
| Admin | `admin@neighborlink.local` |
| Provider | `provider@neighborlink.local` |
| Customer | `customer@neighborlink.local` |

Never use this password or the example JWT secrets in a real deployment.

## Stripe sandbox configuration

Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in `server/.env`, then register this Stripe webhook endpoint:

```text
POST https://your-api.example/api/payments/webhook
```

The webhook, not the browser success screen, changes a payment record to `PAID` and creates its transaction allocation. Configure `PLATFORM_FEE_PERCENT` for the platform commission. With no Stripe key, the customer booking detail page provides a development-only demo confirmation that is disabled in production.

## Tests and builds

```bash
npm run build
npm test
```

The current suite exercises JWT utilities, availability-window validation, appointment-overlap logic, and a React provider-card render. For a deployment, extend it with a disposable PostgreSQL test database and Supertest integration tests for booking authorization, reviews, and Stripe webhook signatures.

## Deployment

- Deploy `client` to Vercel or Netlify, setting `VITE_API_URL` to the deployed API.
- Deploy `server` to Render or Railway, setting `CLIENT_URL` to the deployed frontend and all `server/.env` values.
- Use Neon, Supabase PostgreSQL, or managed PostgreSQL for `DATABASE_URL`.
- In production use secure HTTPS, rotate secrets, and use a durable private object store for verification documents instead of local disk.

## Privacy and security notes

Provider discovery intentionally returns neighborhood-level location and optional approximate distance; it does not return provider latitude/longitude or verification file paths. Verification uploads are stored outside the public static route. The client never controls booking ownership, role, service price, availability, or final payment status.
