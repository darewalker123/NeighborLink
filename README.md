# NeighborLink

NeighborLink is a local community services marketplace built as a third-year Full Stack Development project. It connects residents with trusted nearby providers for tutoring, home repairs, cleaning, cooking, computer support and other everyday services.

The project keeps a polished marketplace interface while using a conventional architecture that can be explained file-by-file in a college viva.

## Features

### Customer

- Register, log in and log out with JWT authentication
- Browse categories and search providers by name, service or location
- View provider profiles, services, weekly availability and reviews
- Save and remove favorite providers
- Request a booking with a date, time, address and notes
- Track pending, accepted, active, completed and cancelled bookings
- Make a clearly labelled simulated payment
- Message providers through database-backed REST endpoints
- Receive and mark notifications as read
- Review a provider after a completed booking
- Use `/become-provider` to create a provider profile

### Provider

- View booking requests and dashboard statistics
- Accept, reject, start and complete bookings
- Edit provider biography, skills and experience
- Add, edit and deactivate services
- Set simple weekly availability
- Upload a verification document using Multer
- Message customers
- View paid earnings and rating summary

### Admin

- View totals and Recharts dashboard charts
- Search users and activate or suspend accounts
- Approve or reject provider verification requests
- Monitor all marketplace bookings
- View simulated transactions and platform fees
- Resolve or reject reports and disputes

## Technology Stack

### Frontend

- React and JavaScript
- Vite
- React Router DOM
- Axios
- Context API, `useState` and `useEffect`
- Tailwind CSS and the existing custom responsive CSS
- Lucide React icons
- Recharts

### Backend

- Node.js and Express.js
- JavaScript ES modules
- MySQL and `mysql2`
- JSON Web Tokens
- `bcryptjs` password hashing
- Multer file uploads
- dotenv and CORS

## Architecture

```text
Browser
   ↓
React pages and components
   ↓ Axios HTTP requests
Express routes
   ↓ authentication / role middleware
Controller functions
   ↓ parameterized mysql2 queries
MySQL database
```

The backend intentionally uses the easy-to-follow flow `route → middleware → controller → database`. It does not use an ORM, repository layer, dependency injection, refresh-token system or external payment service.

## Database Tables

| Table | Purpose |
| --- | --- |
| `users` | Customer, provider and admin accounts |
| `categories` | Marketplace service categories |
| `provider_profiles` | Provider biography, skills, rating and verification state |
| `services` | Services and prices published by providers |
| `availability` | Simple weekly provider time ranges |
| `bookings` | Customer requests and booking status workflow |
| `payments` | Simulated payment, fee and provider-earning records |
| `reviews` | One customer review per completed booking |
| `favorites` | Saved customer-provider relationships |
| `messages` | Direct database-backed booking messages |
| `notifications` | Booking, payment, message and verification updates |
| `verification_requests` | Locally uploaded provider documents and admin decisions |
| `reports` | Simplified disputes and reports |

## Project Structure

```text
NeighborLink/
├── client/
│   ├── src/
│   │   ├── api/              Axios configuration
│   │   ├── components/       Shared visual components
│   │   ├── context/          Authentication Context API
│   │   ├── pages/            Customer, provider and admin pages
│   │   └── utils/            Simple frontend validation
│   └── tests/                Small validation tests
├── server/
│   ├── config/               MySQL connection pool
│   ├── controllers/          SQL-backed application actions
│   ├── middleware/           JWT, role, upload and error middleware
│   ├── routes/               Express endpoint definitions
│   ├── scripts/              Database setup and seed scripts
│   ├── tests/                Service and availability validation tests
│   └── server.js             Express application entry point
├── database/
│   └── schema.sql            Readable MySQL schema
└── VIVA_GUIDE.md             Project explanation and viva preparation
```

## Installation

Prerequisites:

- Node.js 20 or newer
- npm
- MySQL 8 or newer
- MySQL Workbench is optional but helpful

### 1. Configure the backend

From the project folder in PowerShell:

```powershell
Copy-Item .\server\.env.example .\server\.env
notepad .\server\.env
```

Enter the correct MySQL root password in `DB_PASSWORD`. Do not commit `server/.env`.

### 2. Install packages and create sample data

```powershell
npm install
npm run db:setup
```

`db:setup` creates the `neighborlink` database when needed, runs `database/schema.sql`, and then loads the readable JavaScript seed data. You do not need to enter `CREATE DATABASE` manually.

If tables already exist, setup keeps your data. `npm run db:reset` intentionally deletes all application data and restores demo accounts; do not use it for normal startup. `db:seed` also preserves existing accounts unless explicitly run with `--reset`.

### 3. Run the application

```powershell
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The API runs at [http://localhost:4000](http://localhost:4000).

Keep that terminal open. Closing it stops the site. For a built local demo (without hot reload), use `npm run build` followed by `npm start`. This also serves the frontend on port 5173.

With the API running, `npm run test:workflows` checks the MySQL-backed workflows using temporary accounts and removes only its own test data. Run `npm test` for the small validation tests.

The frontend and backend can also be started separately:

```powershell
cd client
npm run dev
```

```powershell
cd server
npm run dev
```

## Demo Accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@neighborlink.local` | `NeighborLink@123` |
| Provider | `provider@neighborlink.local` | `NeighborLink@123` |
| Customer | `customer@neighborlink.local` | `NeighborLink@123` |

The seed script stores bcrypt hashes, never these plain-text passwords.

## Main Workflows

### Authentication

The React form sends credentials to Express. The backend finds the user using a parameterized SQL query, compares the bcrypt hash and returns one JWT. The browser stores the token in `localStorage`, and Axios adds it as `Authorization: Bearer <token>` on protected requests.

### Booking

A customer selects a provider service and time. Express checks the service, provider availability and overlapping accepted bookings before inserting a pending booking. The provider can accept or reject it, start a paid accepted booking, and complete an active booking.

### Provider onboarding

A signed-in customer submits the `/become-provider` form. A transaction creates the provider profile and updates the account role. A new JWT containing the provider role is returned immediately.

### Simulated payment

No card or real money is processed. An accepted booking can be marked paid for demonstration. The backend records the total amount, a configurable 10% platform fee and the provider amount in the `payments` table.

Cancelling an accepted, paid booking before work starts records a simulated refund. Refunded payments remain in transaction history but are excluded from paid earnings and platform revenue. Booking updates use short SQL transactions and status checks to prevent duplicate acceptance/completion.

### Messaging

Messages are stored in MySQL. React sends and reads messages through REST endpoints and polls every five seconds while the messaging page is open.

### Reviews

The backend permits a review only when the signed-in user owns a completed booking and that booking has not already been reviewed. It then recalculates the provider's average rating with SQL `AVG` and `COUNT`.

## Build and Tests

```powershell
npm run build
npm test
```

The small tests cover frontend forms and backend service/availability validation. `npm run test:workflows` exercises the real booking rules and other HTTP workflows against MySQL, including concurrent acceptance/completion and demo refunds. It creates temporary accounts and removes only its own test records afterwards.

See [VERIFICATION.md](./VERIFICATION.md) for the tested build, browser checks, intentional boundaries and pending GitHub handoff.

## Important Academic Note

Payments are simulated solely for project demonstration. NeighborLink does not collect card details and performs no real financial transaction. Verification uploads are stored locally for the same academic purpose.

Password-reset email delivery is intentionally not connected. Demo profiles, sample documents, testimonials and landing-page marketing statistics are illustrative, not claims of real marketplace activity. This is a local academic application, not a production service.

For viva preparation, read [VIVA_GUIDE.md](./VIVA_GUIDE.md).
