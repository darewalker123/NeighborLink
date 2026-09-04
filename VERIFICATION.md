# Local Build Verification

Verified on 3 September 2026 against the local MySQL database. This describes an academic demonstration build, not a production-readiness certification.

## Results

| Check | Result |
| --- | --- |
| `npm run db:setup` with an existing database | Passed; existing application data preserved |
| `npm test` | 4 validation tests passed |
| `npm run build` | Backend entry-point syntax check and frontend production build passed |
| `npm run test:workflows` with the API running | 95 live API checks passed |
| `npm audit` | 0 known vulnerabilities reported at verification time |
| Frontend and `/api/health` | Accessible locally; MySQL health check passed |
| `git diff --check` | No whitespace errors |

The workflow checks cover demo logins, role/ownership restrictions, account registration, provider onboarding, services, availability, search, favorites, bookings, concurrent acceptance/completion, simulated payments/refunds, reviews, messaging, notifications, verification uploads/admin decisions, reports and account suspension. They create uniquely named temporary accounts and remove their own records and uploaded file afterwards.

## Browser checks

- Customer, provider and admin login/dashboard navigation.
- The signed-in customer's “Offer a service” link opens provider onboarding rather than registration.
- Customer booking submission with the date/time controls.
- Provider acceptance, customer simulated payment, service start/completion and customer review submission through the actual interface.
- Admin overview, users, verification requests, bookings, transactions and reports.
- Responsive admin tables, provider service management and mobile chat conversation selection at a 375px viewport.

The single browser-test booking, its payment/review and generated notifications were removed afterwards. Provider totals were recalculated; existing accounts and bookings were not reset.

## Reliability improvements in this build

- Non-destructive database setup, with a separate explicit reset command.
- Current database role and suspension state enforced on every authenticated request.
- Transactional booking transitions, overlap protection and idempotent payment handling.
- Paid cancellation recorded as a simulated refund and excluded from paid earnings.
- Accurate provider rating/review/completed-job totals.
- Stored acceptance timestamps for new booking acceptances. Earlier bookings without this field display an unavailable timestamp instead of a fabricated acceptance time.
- Validation for services, availability, provider details and reviews; protected reports/documents.
- Service reactivation, payment histories, improved error feedback and mobile layouts.
- Lazy-loaded admin charts to reduce the initial frontend bundle.

## Running the verified local build

From the repository folder, with MySQL running and `server/.env` configured:

```powershell
npm run db:setup
npm run build
npm start
```

Open [NeighborLink](http://localhost:5173). Keep the terminal running. The health endpoint is [API health](http://localhost:4000/api/health).

For development outside the managed agent sandbox, use `npm run dev`. The agent environment could build and preview the application, but its filesystem restrictions prevented Vite's development dependency scan from reading ancestor folders. A Vite preview is suitable for this local demonstration, not a public production server.

Do not run `npm run db:reset` during normal startup: that command deliberately erases application data and reloads the demo.

## Intentional academic boundaries

Payments/refunds are simulated; no money moves. Password-reset email delivery is not connected. Verification documents are stored locally. Messaging uses five-second polling. Seed profiles, verification fixtures, testimonials and marketing statistics are illustrative. Production deployment, live payments, email delivery, cloud document storage and production security/operations need a separate implementation and review.

## GitHub workflow

The configured remote is `https://github.com/darewalker123/NeighborLink.git`. Use the normal review workflow before publishing future changes:

```powershell
cd "<project-folder>"
git add -A
git diff --cached --stat
git commit -m "Describe the change"
git push
```

Environment files, node_modules, uploads and temporary test output are ignored and must not be staged.

Suggested repository description: **A neighborhood services marketplace built with React, Express and MySQL, featuring customer/provider/admin dashboards, bookings, messaging, verification and simulated payments.**
