# NeighborLink Viva Guide

## 1. Project Introduction

### 30-second explanation

NeighborLink is a full-stack local services marketplace. Customers use it to find nearby providers, compare services and reviews, create bookings, make a simulated payment, chat and review completed work. Providers manage their profile, services, availability, bookings and earnings. Administrators manage users, verification, bookings, payments and reports. The frontend is React, the backend is Express and permanent data is stored in MySQL.

## 2. Problem Statement

People often need trusted local help but do not know which nearby person is reliable. Small local providers also need an affordable way to present their skills and receive work. NeighborLink solves both problems with provider profiles, community reviews, a controlled booking process and role-based dashboards.

## 3. Technology Stack

- **React:** creates reusable components and dynamic pages without reloading the browser.
- **JavaScript:** runs in both the browser and Node.js, making the project easier to learn.
- **Vite:** starts the development frontend and creates the production build.
- **React Router:** maps browser URLs to React pages.
- **Axios:** sends HTTP requests from React to the Express API.
- **Context API:** shares the signed-in user and authentication functions.
- **Express:** defines REST endpoints and middleware.
- **MySQL:** stores relational application data permanently.
- **mysql2:** connects Node.js to MySQL and supports parameterized queries.
- **JWT:** proves the identity and role of a signed-in user.
- **bcryptjs:** hashes passwords before they are stored.
- **Multer:** receives provider verification files.
- **Recharts:** displays understandable admin charts.
- **CORS:** allows the frontend on port 5173 to call the API on port 4000.

## 4. Architecture

```text
Browser
  → React page or component
  → Axios request
  → Express route
  → authentication and role middleware
  → controller function
  → parameterized mysql2 query
  → MySQL
  → JSON response
  → React state update
  → refreshed UI
```

The application is a monolith: one frontend, one backend and one database. The backend uses `route → middleware → controller → database`, which is easy to trace during a viva.

## 5. Authentication Flow

1. The user enters an email and password in `Auth.jsx`.
2. The controlled form checks basic required fields.
3. Axios sends `POST /api/auth/login`.
4. `authRoutes.js` calls `login` in `authController.js`.
5. MySQL finds the user by email using a `?` parameter.
6. `bcrypt.compare` checks the entered password against the stored hash.
7. The backend signs one JWT containing the user ID and role.
8. React stores the token in `localStorage`.
9. The Axios interceptor adds `Authorization: Bearer <token>`.
10. Protected backend routes use `authenticate` and optional role middleware.
11. Protected frontend pages use `ProtectedRoute`.

Logout removes the token and user state. A token expires after one day.

## 6. Booking Flow

1. A customer opens a provider profile and selects a service, date and time.
2. React sends `POST /api/bookings` with the service and schedule.
3. JWT middleware identifies the customer.
4. The controller loads the service and its provider.
5. It rejects booking your own service.
6. It checks that the chosen day and time are inside provider availability.
7. It checks for an overlapping accepted or in-progress booking.
8. It inserts a `pending` booking using the database service price.
9. It creates a notification for the provider.
10. The provider can accept or reject the request.
11. An accepted booking can be paid, started and completed.
12. The customer can then submit one review.

Allowed status changes are:

```text
pending → accepted
pending → rejected
pending → cancelled
accepted → in_progress
accepted → cancelled
in_progress → completed
```

## 7. Provider Flow

A customer opens `/become-provider` and submits a biography, skills, experience, location and service radius. The backend transaction inserts a `provider_profiles` record and changes the user role from `customer` to `provider`. It returns a new provider JWT. The provider can then add services, define weekly availability, upload a verification document and manage bookings from the dashboard.

## 8. Payment Flow

Payment is simulated because this is an academic project. No card information is accepted.

1. The provider accepts a booking.
2. The customer clicks **Demo Pay**.
3. The backend verifies that the customer owns the accepted booking.
4. It reads the amount from the booking, not from the browser.
5. It calculates `platform fee = amount × 10 / 100`.
6. It calculates `provider amount = amount - platform fee`.
7. It inserts a paid row into `payments`.
8. It updates the booking payment status.
9. It creates customer and provider notifications.

Example: ₹1,000 total, ₹100 fee and ₹900 provider earning.

## 9. Messaging Flow

Messaging uses normal REST endpoints and a `messages` table.

- `GET /api/conversations` finds people connected through bookings or messages.
- `GET /api/conversations/:userId/messages` loads a conversation.
- `POST /api/conversations/:userId/messages` inserts a message.
- The backend checks that the two users share a booking.
- The React page polls every five seconds while chat is open.

This gives a near-real-time demonstration without WebSockets.

## 10. Role-Based Authorization

There are three roles:

- `customer`: finds providers and creates bookings.
- `provider`: manages services and provider bookings.
- `admin`: manages the whole marketplace.

`authenticate` verifies the JWT. `authorizeRole('provider')` or `authorizeRole('admin')` checks the decoded role. A customer cannot call provider or admin endpoints even if they manually enter the URL.

## 11. Database

- **users:** account, password hash, role, contact details and active status.
- **categories:** names such as Tutoring, Plumbing and Cleaning.
- **provider_profiles:** provider information linked one-to-one with a user.
- **services:** provider offerings linked to a provider and category.
- **availability:** a provider's start and end time for a day of the week.
- **bookings:** customer, provider, service, schedule, amount and status.
- **payments:** simulated transaction, platform fee and provider amount.
- **reviews:** customer rating for one completed booking.
- **favorites:** unique saved customer-provider pairs.
- **messages:** sender, receiver, optional booking and message text.
- **notifications:** account updates with read status.
- **verification_requests:** provider file path and admin decision.
- **reports:** simplified dispute information and resolution status.

Primary keys use UUID strings. Foreign keys prevent invalid relationships. Unique constraints prevent duplicate emails, favorites, reviews and booking payments.

## 12. Important SQL Queries

### SELECT

```sql
SELECT * FROM users WHERE email = ?;
```

The `?` receives the email separately and prevents SQL injection.

### INSERT

```sql
INSERT INTO bookings
(id, customer_id, provider_id, service_id, scheduled_start, scheduled_end, total_amount)
VALUES (?, ?, ?, ?, ?, ?, ?);
```

### UPDATE

```sql
UPDATE bookings SET status = ? WHERE id = ?;
```

### JOIN

```sql
SELECT s.title, c.name AS category_name, u.full_name AS provider_name
FROM services s
JOIN categories c ON c.id = s.category_id
JOIN provider_profiles p ON p.id = s.provider_id
JOIN users u ON u.id = p.user_id;
```

### Aggregate query

```sql
SELECT AVG(rating) AS average_rating, COUNT(*) AS review_count
FROM reviews
WHERE provider_id = ?;
```

### Earnings query

```sql
SELECT SUM(provider_amount)
FROM payments
WHERE provider_id = ? AND payment_status = 'paid';
```

### Overlap query

```sql
SELECT id FROM bookings
WHERE provider_id = ?
AND status IN ('accepted', 'in_progress')
AND scheduled_start < ?
AND scheduled_end > ?;
```

Two periods overlap when one begins before the other ends and ends after the other begins.

## 13. Important React Concepts Used

- **Components:** functions that return reusable interface sections.
- **Props:** values passed from a parent component to a child.
- **State:** page data that changes, such as bookings or form fields.
- **useState:** stores form values, loading state, errors and API results.
- **useEffect:** loads API data after a page renders and manages polling cleanup.
- **useCallback:** keeps reusable loading functions stable between renders.
- **Context API:** provides authentication state throughout the component tree.
- **React Router:** renders pages and reads route parameters.
- **Controlled form:** input value comes from state and `onChange` updates it.
- **Conditional rendering:** displays loading, empty, error or content states.

## 14. Important Backend Concepts

- **Express application:** receives HTTP requests.
- **Route:** connects an HTTP method and URL to a controller.
- **Middleware:** code that runs before a controller, such as JWT checking.
- **Controller:** performs one application action and sends a response.
- **REST API:** resources are operated on through predictable URLs and HTTP methods.
- **JWT:** signed token used to identify the current user.
- **bcrypt:** one-way password hashing.
- **Connection pool:** reuses MySQL connections efficiently.
- **Parameterized query:** sends SQL and user values separately.
- **Transaction:** completes related queries together or rolls them all back.
- **Foreign key:** guarantees that related records exist.

## 15. Security

- Passwords are stored as bcrypt hashes.
- Protected endpoints require a valid JWT.
- The middleware also checks the current MySQL account so suspension and role changes take effect immediately.
- Provider and admin endpoints also check roles.
- Ownership checks protect bookings, payments, reviews and messages.
- All user input in SQL uses `?` parameters.
- Service amount is loaded from MySQL instead of trusted from the browser.
- Essential input validation runs on both frontend and backend.
- Secrets and database passwords are read from `.env`.
- CORS permits the configured frontend URL.
- Upload types and file size are limited by Multer.
- Cancelling a paid booking before service begins records a simulated refund, not a real banking operation.

## 16. Likely Viva Questions

1. **What problem does NeighborLink solve?** It connects residents who need help with trusted local service providers.
2. **What is full-stack development?** It combines a user interface, server-side API and database.
3. **Why use React?** It makes the interface component-based, reusable and responsive to state changes.
4. **Why use Vite?** It provides fast development startup and an optimized frontend build.
5. **What is a component?** A reusable JavaScript function that returns part of the React UI.
6. **What are props?** Read-only inputs passed from a parent component to a child.
7. **What is state?** Data owned by a component that can change and trigger a re-render.
8. **What does `useState` do?** It creates a state value and its update function.
9. **What does `useEffect` do?** It runs side effects such as loading API data after rendering.
10. **Why clean up the messaging interval?** To prevent multiple timers and memory leaks after leaving the page.
11. **Why use Context API?** It shares the authenticated user without passing props through every component.
12. **What is React Router?** A library that connects URLs with React pages.
13. **Why use Axios?** It provides a convenient promise-based HTTP client and interceptors.
14. **What is an Axios interceptor?** A function that modifies a request, here by adding the JWT header.
15. **What is a REST API?** An HTTP interface that exposes resources through URLs and methods.
16. **What does GET do?** It reads data without intentionally changing it.
17. **What does POST do?** It creates data or performs an action.
18. **What do PUT and PATCH do?** They update existing data; PUT commonly replaces or sets, while PATCH changes selected fields.
19. **What does DELETE do?** It removes or deactivates a resource.
20. **Why use Express?** It makes Node.js routes and middleware straightforward.
21. **What is middleware?** A function between request arrival and controller execution.
22. **What is authentication?** Proving who the user is.
23. **What is authorization?** Checking what an authenticated user is allowed to do.
24. **What is JWT?** A signed token containing claims such as user ID and role.
25. **Why does the JWT expire?** Expiration limits how long a stolen token remains useful.
26. **What is bcrypt?** A slow one-way hashing algorithm designed for passwords.
27. **Why not store plain passwords?** A database leak would expose every user's password.
28. **Why MySQL?** The data is relational and MySQL provides tables, joins, keys and transactions.
29. **What is a primary key?** A unique identifier for each table row.
30. **What is a foreign key?** A constraint linking one table to a valid row in another.
31. **What is a JOIN?** It combines related rows from multiple tables.
32. **What is an index?** A database structure that speeds up selected searches.
33. **What is a unique constraint?** It prevents duplicate values or combinations.
34. **Why parameterize SQL?** It prevents input from being interpreted as SQL code.
35. **What is SQL injection?** An attack that changes a query by placing SQL in user input.
36. **What is a transaction?** A group of queries that commit together or roll back together.
37. **How is a booking saved?** React sends Axios data, Express authenticates, the controller validates availability and runs an INSERT.
38. **How is double booking reduced?** The controller checks overlapping accepted and in-progress bookings before acceptance or creation.
39. **Who may cancel a booking?** A booking participant may cancel only a pending or accepted booking.
40. **How is provider rating calculated?** MySQL uses `AVG(rating)` and `COUNT(*)` after a new review.
41. **How do you prevent duplicate reviews?** `reviews.booking_id` is unique and the controller checks booking eligibility.
42. **How do favorites work?** A row links a user and provider, with a unique pair constraint.
43. **How does messaging work?** Messages are inserted and selected through REST; React polls every five seconds.
44. **Why remove WebSockets?** Polling is easier to demonstrate and sufficient for this local academic application.
45. **How does payment work?** It creates a simulated payment record and calculates platform and provider amounts.
46. **Why are payments simulated?** A college demonstration should not collect or process real financial information.
47. **What is CORS?** A browser security mechanism controlling requests between different origins.
48. **What is Multer?** Express middleware for receiving multipart file uploads.
49. **How is admin access protected?** Both JWT authentication and `authorizeRole('admin')` run before admin controllers.
50. **What is CRUD?** Create, Read, Update and Delete, the basic persistent-data operations.
51. **What happens when a provider accepts?** The status changes to accepted and the customer receives a notification.
52. **How does a customer become a provider?** One transaction inserts a profile and updates the user role.
53. **Why return a new JWT after provider onboarding?** The token must contain the new provider role.
54. **How do frontend and backend communicate?** Axios sends JSON over HTTP and Express returns JSON.
55. **What would you add for production?** Real payment integration, cloud file storage, email delivery, more tests and deployment monitoring.

## 17. Important Files to Learn

1. `client/src/App.jsx` — frontend routes and protected pages.
2. `client/src/context/AuthContext.jsx` — login state, token storage and session loading.
3. `client/src/api/client.js` — Axios base URL and Bearer-token interceptor.
4. `client/src/pages/Auth.jsx` — controlled login and registration forms.
5. `client/src/pages/Services.jsx` — provider search, filters and API loading.
6. `client/src/pages/Provider.jsx` — provider details and booking form.
7. `client/src/pages/Dashboard.jsx` — customer/provider statistics and provider management.
8. `client/src/pages/BookingDetail.jsx` — booking workflow, payment and review actions.
9. `client/src/pages/Messages.jsx` — REST messaging and five-second polling.
10. `client/src/pages/Admin.jsx` — admin charts and management screens.
11. `server/server.js` — Express setup and route mounting.
12. `server/config/db.js` — MySQL connection pool.
13. `server/middleware/authMiddleware.js` — JWT verification.
14. `server/middleware/roleMiddleware.js` — provider/admin authorization.
15. `server/controllers/authController.js` — registration, bcrypt login and JWT creation.
16. `server/controllers/marketplaceController.js` — search, provider, service, availability and favorites SQL.
17. `server/controllers/bookingController.js` — complete booking workflow and overlap checks.
18. `server/controllers/paymentController.js` — simulated payment and fee calculation.
19. `server/controllers/communicationController.js` — messages, notifications and reports.
20. `server/controllers/adminController.js` — admin aggregates and management actions.
21. `database/schema.sql` — tables, keys, relationships and indexes.
22. `server/scripts/seedData.js` — readable demonstration records.

## 18. Five-Minute Full Project Explanation

“My project is NeighborLink, a local community services marketplace. The problem is that residents often need trustworthy nearby help, while skilled local people need a simple way to offer services. NeighborLink connects these two groups through provider profiles, services, bookings, messaging, payments and reviews.

The project has three roles. A customer can register, search providers, save favorites, request a booking, make a simulated payment, message the provider and review completed work. A provider can manage a profile, services and weekly availability, accept or reject booking requests, start and complete work, upload a verification document and view earnings. An admin can view platform statistics, manage users, review provider verification, monitor bookings, inspect payments and resolve reports.

The frontend uses React with JavaScript and Vite. React Router controls pages such as `/services`, `/bookings` and `/admin`. I use normal controlled forms with `useState`. I use `useEffect` when a page must fetch data. Authentication state is shared through Context API. Axios sends requests to the backend and an interceptor adds the JWT to the Authorization header.

The backend uses Node.js, Express and JavaScript. Routes define the URL and HTTP method, middleware checks authentication and roles, controllers perform validation and SQL, and mysql2 connects to MySQL. This gives a clear route-to-controller-to-database flow.

During login, Express finds the email with a parameterized query and bcrypt compares the password with the stored hash. If correct, the server signs one JWT containing the user ID and role. Protected requests send that token as a Bearer token. Provider and admin routes have an additional role check.

The database contains users, categories, provider profiles, services, availability, bookings, payments, reviews, favorites, messages, notifications, verification requests and reports. Foreign keys maintain relationships. Unique keys prevent duplicate email, payment, favorite and review records.

For booking, React sends the selected service and time. The backend reads the service and price from MySQL, checks provider availability and checks overlapping accepted jobs. It then inserts a pending booking. The provider can accept or reject it. The customer can make a simulated payment. The provider can start a paid accepted booking and complete an active booking. Invalid backwards status changes are rejected.

Payments are intentionally simulated because this is an academic system. The backend marks the booking paid and calculates the platform fee and provider earning. Messaging also uses a college-friendly design: messages are stored in MySQL and React polls the REST API every five seconds.

Security includes bcrypt hashes, JWT authentication, role and ownership checks, parameterized SQL, environment variables, CORS and limited file uploads. The most important design choice is balance: the user interface remains polished and the workflows are substantial, but the implementation is conventional enough to explain from the React form, through Axios and Express, to the exact SQL query and MySQL table.”
