# Client Deployment Guide

This document lists every environment variable, build setting and external
dependency required to deploy the FixMate client (this repository) to Vercel
or any equivalent Next.js-compatible host. None of the values below are
committed to the repository; fill them in at the host's dashboard or in a
local `.env.local` that is gitignored.

## Required environment variables

| Variable              | Scope        | Example value                                  | Notes                                                                 |
| --------------------- | ------------ | ---------------------------------------------- | --------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | public (yes) | `http://localhost:5000` (dev) / `https://<backend-domain>` (prod) | Base URL of the backend API. **Public & non-secret** — embedded in the browser bundle. Has no leading slash and must not point to any private/internal host that you do not want revealed. |

No server-only variable is read by this project. Anything prefixed with
`NEXT_PUBLIC_` is **visible to the browser**; never put secrets behind that
prefix. For example: no `NEXT_PUBLIC_STRIPE_SECRET_KEY`, no
`NEXT_PUBLIC_IMGBB_API_KEY`, no auth secret. The client only ever uses
`NEXT_PUBLIC_API_URL`.

### `.env.local` (local development)

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

This is exactly what `.env.example` contains. `.env.example` is committed so
fresh clones have a template; `.env.local` must stay ignored.

## Backend dependency

The client cannot function without the backend (`fixmate-server`) running and
reachable over HTTPS. The backend is documented in its own repository.
The two most important integration points:

- **Better Auth JWKS endpoint** — the backend serves the JSON Web Key Set at
  `{NEXT_PUBLIC_API_URL}/api/auth/jwks`. The client does not fetch it
  directly; the backend's own `/api/auth/jwks` is the token authority.
- **CORS / trusted origins** — the backend must accept the public client
  origin in `CLIENT_URL` (see backend `DEPLOYMENT.md`), or every cross-origin
  browser request will be rejected by CORS.

## Hosting on Vercel (recommended)

1. Import the repository at <https://vercel.com/new>.
2. Framework preset: **Next.js** (auto-detected).
3. Build command: `npm run build` (default).
4. Output directory: `.next` (default).
5. Install command: `npm install` (default).
6. Node version: **20.x** or newer (Next.js 16 requires Node.js ≥ 20.9;
   set it in Project → Settings → General if the default differs).
7. Add the single environment variable `NEXT_PUBLIC_API_URL` pointing at the
   deployed backend URL (a placeholder until then — e.g.
   `https://your-backend.onrender.com`).
8. Deploy.

Vercel will happily build the app as long as the backend is already deployed
(or at least the build does not hit the backend — it does not; data fetching
is at request time).

## Hosting elsewhere (Netlify / Cloudflare / self-hosted Node)

Any host capable of running `next start` after `next build` works.

```bash
npm ci
npm run build
npm start
```

Set the same single env var in the host's configuration (or in a gitignored
file). Ensure the host serves the Next.js routes at their original paths
(this project does not use `basePath`).

## What NOT to do

- Do not commit any file matching `.env*` — even a “sample” file with real
  values in it. `.env.example` is intentionally the only non-gitignored entry.
- Do not deploy to a production domain before the backend is live and
  publicly reachable over HTTPS (HTTP-only APIs will be blocked by mixed
  content policy in production browsers).
- Do not point `NEXT_PUBLIC_API_URL` at a localhost URL in production — the
  browser will fail to connect.
- Do not add `output: "standalone"` to `next.config.ts` for Vercel; it is
  only needed for Docker/self-hosted Node comparison.

## Build resource note

`next build` on very low-memory machines (< 4 GB free RAM, single worker) can
fail with a JavaScript heap out-of-memory error. The sandbox used during
development triggered it consistently on the pre-existing `ServiceDetails`
route. It is not a project defect; if it happens on your machine:

```bash
NODE_OPTIONS=--max-old-space-size=4096 npm run build
```

or upgrade RAM before building for production.
