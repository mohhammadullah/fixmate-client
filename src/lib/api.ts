/**
 * Shared API origin for the FixMate backend.
 *
 * `NEXT_PUBLIC_API_URL` is a public, non-secret value (see .env.example).
 * Server and client components import this instead of redeclaring the
 * fallback inline. Never put secrets in this module.
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
