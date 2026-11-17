import { createAuthClient } from "better-auth/react";

/**
 * FixMate authentication client.
 *
 * Talks to the existing fixmate-server Better Auth backend, which mounts its
 * handler at `/api/auth` on the configured API origin. The client resolves
 * `${NEXT_PUBLIC_API_URL}/api/auth` automatically and sends cookies with
 * every request (`credentials: "include"`), so the Better Auth session/cookie
 * flow works unchanged — no tokens are stored manually anywhere.
 *
 * `NEXT_PUBLIC_API_URL` is a public, non-secret value (see .env.example).
 * Never put backend secrets in this file or any NEXT_PUBLIC_* variable.
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000",
});

export const { signIn, signUp, signOut, useSession } = authClient;
