# FixMate

FixMate is a role-based web application that connects customers who need
home appliance and device repairs with independent repair technicians.
Customers can browse and book verified technicians, technicians can publish
services, track bookings through a workflow and get paid through Stripe,
and admins moderate platform activity end-to-end — including a two-tier
Admin / Main Admin privilege model.

- **Project:** FixMate (final year undergraduate project / coursework)
- **Repositories:** `fixmate-client` (this repo) and [`fixmate-server`](https://github.com/mohhammadullah/fixmate-server)
- **Live URL:** **Not deployed yet — see [DEPLOYMENT.md](./DEPLOYMENT.md) for the exact steps required.** No live URL is claimed until one is actually provisioned.

## Main features

- **Public service marketplace** — browse, search, and filter approved,
  available repair services by category, location, price and rating; no
  account required.
- **Role-based authentication** — Better Auth (email + password) with a
  server-managed `role` field; role-based protected dashboards for
  customer, technician, admin and Main Admin.
- **Service details & booking** — service gallery, pricing, technician
  profile and a verified booking-request flow with duplicate-booking
  protection.
- **Customer workflow** — create bookings, cancel requested bookings,
  track live status, see final price, and pay securely via Stripe
  Checkout.
- **Technician workflow** — service CRUD with admin approval gating,
  image upload, accept/reject booking requests, move bookings through
  `accepted → in-progress → completed` and set the final repair charge.
- **Payment & settlement** — Stripe Checkout (hosted, no card data on
  FixMate); verified Stripe webhook marks payments `succeeded`; customer
  payment history and admin payment reconciliation lists.
- **Admin console** — platform statistics, user management with role
  promotion/demotion, technician-application review (approve/reject),
  service moderation, all bookings, all payments — with a Main Admin
  tier for the sole power to demote other admins and transfer ownership.
- **Technician applications** — customers apply with experience, skills
  and a bio; admins review with approve/reject and record reasons.
- **Honest UX everywhere** — Sonner toasts for actions, loading skeletons,
  empty and error states on every screen, accessible dialogs with focus
  rings, keyboard escape/backdrop dismissal and focus restore.
- **Responsive UI** — mobile-first Tailwind v4 layouts throughout (cards,
  drawer navigation, reduced-motion support).

## Technology stack

- **Framework:** Next.js 16 (App Router, `cacheComponents`), React 19
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS v4 (`@tailwindcss/turbopack`), Geist / Geist Mono
- **Auth:** Better Auth client (email + password, session cookie, JWT)
- **Icons/UI:** inline SVG icon set; Sonner for toasts
- **Backend (separate repo):** Node.js + Express 5, MongoDB, Better Auth server
- **Runtime:** Node.js ≥ 20.9

## Prerequisites

- Node.js ≥ 20.9 (Next.js 16 requires it)
- npm ≥ 10
- A running backend — the frontend is a thin client; see
  [Backend connection](#backend-api-connection) below

## Setup

```bash
# 1. clone
git clone https://github.com/mohhammadullah/fixmate-client.git
cd fixmate-client

# 2. install dependencies
npm install

# 3. create your local environment file
cp .env.example .env.local
#    then edit .env.local and point NEXT_PUBLIC_API_URL at the running
#    backend (default http://localhost:5000)

# 4. start the development server
npm run dev
```

Open <http://localhost:3000>.

Only **one** environment variable is required by the app at build time or
runtime: `NEXT_PUBLIC_API_URL`. It is **public, non-secret**, and is embedded
into the client bundle — never put secrets in any `NEXT_PUBLIC_*` variable.

`.env.local` is gitignored and must never be committed. A template is
provided at `.env.example` (copy it, do not edit the original):

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## Backend API connection

The backend is a separate repository
([fixmate-server](https://github.com/mohhammadullah/fixmate-server)) which
must be running before the client can do anything authenticated or stateful.

- Default backend: <http://localhost:5000>
- Override with `NEXT_PUBLIC_API_URL` in `.env.local`
- The client talks to `${NEXT_PUBLIC_API_URL}/api/*` endpoints with a
  session cookie (Better Auth) and a short-lived JWT obtained per request
  cycle for non-auth API routes. The JWT is never stored in `localStorage`
  or `sessionStorage`; it is fetched per request and discarded after use.
- The browser never sees a backend secret. The only backend value that
  ships to the browser is `NEXT_PUBLIC_API_URL`.

## Authentication and role-based dashboards

Auth is handled by Better Auth on the backend. On the client:

- Sign up/sign in at `/sign-up` and `/sign-in`. New accounts are always
  created with role `customer` — privilege escalation is not possible from
  the signup path.
- `src/lib/auth-client.ts` configures the Better Auth client with the
  backend base URL and sends the session cookie automatically.
- `src/components/dashboard/DashboardSidebar.tsx` maps each role to its
  navigation:
  - **Customer** — Overview, My Bookings, Payment History, Notifications, Profile,
    Become a Technician.
  - **Technician** — Overview, My Services, Incoming Bookings, Availability, Payment
    History, Notifications, Profile.
  - **Admin / Main Admin** — Overview, User Management, Payments, Refunds,
    Coupons (Main Admin only for writes), Technician Applications, All Bookings,
    Analytics, Notifications, Service Moderation, Profile.
- The dashboard layout (`src/app/dashboard/layout.tsx`) redirects
  unauthenticated users to `/sign-in` and shows an inline access-denied
  panel for signed-in users whose role cannot access a given page.
- Server-side authorization is always the source of truth — client UI
  restrictions are UX conveniences only.

## Real-time and notifications

- The client connects to the backend's Socket.IO endpoint (`/socket.io`) with
  a short-lived Better Auth JWT from `GET /api/auth/token` (fetched per
  connection attempt — never stored in `localStorage`/`sessionStorage`).
- Live events: `notification`, `chat:message`, `chat:read`. The notification
  bell and chat panel subscribe; everything degrades gracefully to
  request/response loading when the socket is down.
- In-app notifications persist on the backend (embedded on the user
  document, capped at 50 entries) and are paginated on
  `/dashboard/notifications`.

## Image upload and Stripe payments

**Image upload.** Technician service images are uploaded via
`src/components/dashboard/ServiceImageUpload.tsx`. The file is sent to the
backend (`POST /api/uploads/image`), streamed through the server to ImgBB,
and the returned URL is stored on the service. The `IMGBB_API_KEY` lives
on the backend only; the browser never sees it. Accepted formats: JPEG,
PNG, WebP; max 5 MB.

**Stripe payments.** Payments go through Stripe Checkout:

- The customer initiates a checkout from a `completed`, unpaid booking.
- The frontend asks the backend to create a Checkout Session and redirects
  the customer to Stripe's hosted page (`checkout.stripe.com`). No card
  data is collected or stored by FixMate.
- When Stripe confirms payment, its webhook calls the backend, which
  updates the booking and records the payment. The customer payment
  history and the admin Payments list render from the same backend source.
- The success page polls the backend booking status rather than trusting
  the redirect query string, so a closed browser or partial navigation
  never falsely shows "paid".
- The Stripe secret key lives on the backend only; the frontend never
  calls Stripe directly.

## Useful commands

| Command             | Description                                  |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Start the dev server on http://localhost:3000 |
| `npm run build`     | Production build (Next.js)                   |
| `npm start`         | Start the production server                  |
| `npm run lint`      | Run ESLint                                   |
| `npm run type-check` | `tsc --noEmit`                               |

## Examiner / demo access

FixMate is deployed nowhere yet, and no real demonstration accounts exist
in this repository. To exercise every role locally:

1. **Customer** — sign up via the app at `/sign-up`. The account is a
   customer by default.
2. **Technician** — sign up as above, then submit a technician application
   from `/dashboard/become-technician`. An admin (see below) must approve
   the application before the role is changed.
3. **Admin / Main Admin** — the first admin must be created with the
   server-side bootstrap script (`npm run bootstrap:admin` in the backend;
   see the backend README). Subsequent admins and the Main Admin transfer
   flow are performed from the Admin UI by an existing admin.

There are deliberately **no default credentials** committed to this repo
under any circumstances. Any account you create locally belongs to you.
If you need a curated demo dataset for evaluation, generate it in your
own isolated MongoDB database and never commit it.

## Project structure

```
src/
  app/                  # Next.js App Router routes (public + dashboard)
  components/
    auth/               # Sign in / sign up forms
    dashboard/          # Role dashboards (customer / technician / admin)
    home/               # Landing page sections
    layout/             # Shared layout (Navbar / Footer / ThemeToggle)
    services/           # Public services listing & details
  lib/                  # Better Auth client configuration
```

## License

Educational coursework — no commercial license is asserted.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the exact environment variables and
build/deploy steps required for Vercel (recommended) and similar hosts.
