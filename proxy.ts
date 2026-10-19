import NextAuth from "next-auth";

import { authConfig } from "./auth.config";

// Next.js 16 renamed `middleware.ts` to `proxy.ts` and runs it on the Node.js
// runtime by default. Do NOT add a `runtime` config here; it throws.
export default NextAuth(authConfig).auth;

export const config = {
  // This matcher only decides which requests pass through the auth proxy; it
  // is NOT an authorization boundary. The role is enforced server-side in the
  // protected layout.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
