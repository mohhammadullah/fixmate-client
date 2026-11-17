import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";

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
  plugins: [
    // Mirror the backend's Better Auth `user.additionalFields` (see
    // fixmate-server/src/config/auth.ts) so `signUp.email()` is typed for
    // the fields this app is allowed to set. `role` is intentionally NOT
    // listed: the server marks it `input: false` and defaults it to
    // "customer" — it can never be submitted from the client.
    inferAdditionalFields({
      user: {
        phone: { type: "string", required: false },
        area: { type: "string", required: false },
      },
    }),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
