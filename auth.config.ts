import type { NextAuthConfig } from "next-auth";

// Shared, proxy-safe auth configuration. This file is imported by `proxy.ts`,
// which must stay lightweight, so it MUST NOT import Prisma or anything
// database-related. The Credentials provider lives in `auth.ts` only.
//
// The `authorized` callback decides session PRESENCE only. Role-based
// authorization is enforced server-side in the protected layout, never here.
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  // next-auth v5 rejects requests from hosts it cannot verify (UntrustedHost)
  // unless it runs on Vercel. This app is self-hosted behind PM2 on Windows
  // with a custom server.js, so the host is trusted by deployment contract.
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    // In next-auth 5.0.0-beta.32, `authorized` lives inside `callbacks`.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      const isOnLogin = nextUrl.pathname === "/login";

      if (isOnLogin) {
        if (isLoggedIn) {
          // Already authenticated: send the user to the root, same origin.
          return Response.redirect(new URL("/", nextUrl.origin));
        }
        return true;
      }

      if (!isLoggedIn) {
        // Unauthenticated request to a protected path: bounce to /login and
        // remember where the user was headed.
        const loginUrl = new URL("/login", nextUrl.origin);
        loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
        return Response.redirect(loginUrl);
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
