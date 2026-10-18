# Authentication: credentials login against the legacy Usuario table

## Goal

An administrator can log in with their legacy credentials, pick their branch,
and reach a protected area. Everything outside the login route requires a
session, and the admin area requires the administrator role, checked
server-side.

## Context discovered during exploration

Conventions come from `DOCUMENTACION-CONEXION-SISTEMA-ADMIN.md` §4 and §7. The
facts below were verified against the installed packages and the live database,
not taken from the document.

- **Next 16 renamed `middleware.ts` to `proxy.ts`.** The file must export a
  function named `proxy` (or default). `middleware.ts` is deprecated.
- **`proxy` runs on the Node.js runtime by default in Next 16**, and setting a
  `runtime` config inside the file throws. So the two-file split is no longer
  required for Edge compatibility — but it is kept for a different reason:
  `auth()` on a JWT-strategy session only verifies the signed cookie, so the
  proxy never needs Prisma.
- **`next-auth@latest` is 4.24.15.** v5 is only available as
  `next-auth@beta` → installed `5.0.0-beta.32`. Its peers accept Next 16 and
  React 19.
- API confirmed from the installed typings: `NextAuth(config)` returns
  `{ handlers, auth, signIn, signOut }`, and `auth()` is callable with no
  arguments.
- `model Usuario` (from `db pull`) matches the doc: `IDUsuario` PK,
  `UsuarioRolId`, `IDLocal`, `NombreUsuario`, `Clave`, `RolUsuario`, `Estado`.
  **Every field except the id is nullable.**
- `Clave` is plaintext `NVarChar(Max)`. This is the legacy design, confirmed by
  the doc.
- `model Local` is `IDLocal Int @id` plus `Local String?`.

### Live database facts (aggregate query, no user rows read)

- `RolUsuario` has exactly two values: `CAJERO` (97 users) and
  `ADMINISTRADOR` (35). No nulls present, though the column allows one.
- `Estado`: 123 `true`, 9 `false`. No nulls present, though the column allows
  one.
- `Local` has 8 rows: VENTANAS, PILADORA, VINCES, PECHICHE, PALENQUE,
  PALENQUE 2, PEDRO CARBO, LA YOLANDA.

## Decisions

- **Admin gate compares `RolUsuario === "ADMINISTRADOR"`**, the real value found
  in the database. Not a guess, not a boolean.
- **Credentials match on `NombreUsuario` + `IDLocal` together**, per the doc: the
  user chooses the branch at login, and the same username can exist per branch.
- **`Estado !== true` is a rejection.** Because the column is nullable, the check
  is `!== true` (rejects `false` and `null`), not `=== false`.
- **`Clave` compared in plaintext on purpose.** This deserves a comment in the
  code explaining it is a compatibility constraint with the WinForms system, so
  a future reader does not "fix" it into a hash and lock everyone out.
- **Split config**: `auth.config.ts` holds pages and callbacks and is imported by
  `proxy.ts`; `auth.ts` adds the Credentials provider with the Prisma lookup.
- **Session strategy JWT**, no database adapter, per doc §4.2.
- **Session carries `IDUsuario`, `IDLocal`, `UsuarioRolId`, `RolUsuario`,
  `NombreUsuario`, `Local`**, all optional in the type because every source
  column is nullable.
- **`(main)` validates the role server-side in its layout**, not only in the
  proxy. Doc §4.5 and the Next proxy docs both warn that a proxy matcher is not
  an authorization boundary.

## Tasks

Work unit A — auth core:

- [x] `auth.config.ts` with `pages.signIn` and the `authorized` callback.
- [x] `auth.ts` wiring the Credentials provider against `db`.
- [x] `app/api/auth/[...nextauth]/route.ts` re-exporting `handlers`.
- [x] `types/next-auth.d.ts` module augmentation for `Session`, `User`, `JWT`.
- [x] `proxy.ts` with the matcher protecting everything except
      `_next/static`, `_next/image`, `favicon.ico` and `api/auth`.

Work unit B — login and gate:

- [ ] Server-side query returning `{ IDLocal, Local }` for the branch selector.
- [ ] `app/(auth)/login/page.tsx`.
- [ ] Login form: RHF + Zod, three-generic `useForm`, branch select,
      `signIn("credentials")` with error handling.
- [ ] `app/(main)/layout.tsx` with the server-side administrator check.
- [ ] Move the current starter page to `(main)` so `/` is protected.

## Evidence

### `authorized` lives under `callbacks`, not at the root

Verified in `next-auth/lib/index.d.ts:42` and `next-auth/index.d.ts:116`.
A root-level `authorized` fails to typecheck on 5.0.0-beta.32.

### JWT augmentation does not survive the star re-export

`next-auth/jwt` re-exports `@auth/core/jwt` with `export *`, and TypeScript
module augmentation does not merge through a star re-export. The token inside
the callbacks therefore keeps an `unknown` index signature regardless of the
augmentation. `types/next-auth.d.ts` still declares the fields so downstream
imports of `JWT` are typed, and the `session` callback narrows explicitly with
`typeof` guards instead of casting.

### Build failure that typecheck did not catch

`next build` first failed with:

```
Path C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe could not be resolved
- [project]/node_modules/.pnpm/powershell-utils@0.2.1/... [app-route] (ecmascript)
```

Dependency chain, from `pnpm why powershell-utils`:

```
@prisma/adapter-mssql → mssql@12.7.10 → tedious@20.3.8
  → @azure/identity@4.14.0 → open@11.0.4 → powershell-utils@0.2.1
```

Next externalizes `@prisma/client` and `prisma` by default but **not** the
driver adapter, so Turbopack tried to bundle the Azure-identity browser-opening
chain into the auth route. Fixed in `next.config.ts`:

```ts
serverExternalPackages: ["@prisma/adapter-mssql", "mssql", "tedious"],
```

### Runtime verification (production build, ephemeral AUTH_SECRET)

Server started with `next start` and a throwaway secret so nothing had to be
written to `.env`.

| Request | Result |
| --- | --- |
| `GET /` | `302 → /login?callbackUrl=%2F` |
| `GET /api/auth/session` | `200 null` |
| `POST /api/auth/callback/credentials` | `302`, `MissingCSRF` logged |

The CSRF rejection is correct behaviour: a real sign-in goes through `signIn()`,
which fetches the token first. A raw POST must fail.

The first run of the same test returned `500 UntrustedHost`, because next-auth v5
rejects unverifiable hosts off Vercel. Since this app is self-hosted behind PM2
with a custom `server.js`, the shared config now sets `trustHost: true` with a
comment explaining why.

`next build` reports `ƒ Proxy (Middleware)` and `ƒ /api/auth/[...nextauth]`,
confirming both are compiled as server entries.

## Open items

- **`AUTH_SECRET` is not set yet.** next-auth fails closed without it. The user
  generates one (never share it in chat) and adds it to `.env`.
- No test runner is installed, so verification is typecheck plus production
  build, plus a manual login attempt against the local database.
- Legacy passwords are plaintext, which is a real security exposure inherited
  from the source system. Out of scope here, but it should be recorded as a
  known accepted risk rather than silently ignored.
