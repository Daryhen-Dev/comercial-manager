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

- **Admin gate is `UsuarioRolId === 1`**, the legacy identifier for
  administrators. `RolUsuario` ("ADMINISTRADOR") is the display name and is NOT
  authoritative.
- **`IDLocal` is implicit: the constant `ID_LOCAL_IMPLICITO = 1`.** The user does
  not choose a branch at login. The lookup still pins `IDLocal` because a
  username can repeat across branches.
- **`Estado !== true` is a rejection.** Because the column is nullable, the check
  is `!== true` (rejects `false` and `null`), not `=== false`.

### Correction: the branch selector was removed, contradicting doc §4.1

The first implementation followed `DOCUMENTACION-CONEXION-SISTEMA-ADMIN.md` §4.1
literally: "match por NombreUsuario + IDLocal (el usuario elige sucursal en el
login)", with a branch picker fed by the `Local` table. The product decision
overrode that: this system serves one branch, so `IDLocal` is a constant and the
form asks only for user and password.

Measured consequences, from live aggregates:

- Only **7 of the 35 administrators** belong to `IDLocal = 1` (VENTANAS).
  Administrators in branches 2-8 cannot log in. This is intended, and changing
  it is a code change plus a redeploy, not a configuration toggle.
- `UsuarioRolId` distributes as `1` → 33 users (all ADMINISTRADOR) and `2` → 81
  users (all CAJERO), but **18 users have `UsuarioRolId = null`**, and 2 of them
  are `ADMINISTRADOR`. The strict `UsuarioRolId === 1` gate **excludes those 2**.
  That trade-off was chosen deliberately over a `RolUsuario` fallback.
- Data anomaly worth knowing: 1 user has `IDLocal = 0`, which does not exist in
  the `Local` table (it starts at 1).

Side effect, and it is a good one: the login page no longer touches the database
at all, so it stays usable when SQL Server is unreachable. The previous version
needed a try/catch to degrade to an empty selector.

### Open contradiction to resolve in the document

`DOCUMENTACION-CONEXION-SISTEMA-ADMIN.md` §4.1 said the user picks the branch,
and §4.5 said the gate uses `session.user.UsuarioRolId/RolUsuario`. Both were
stale once the correction landed.

**Resolved**: the document was rewritten to describe this system as implemented.
It now records the implicit `IDLocal`, the strict `UsuarioRolId === 1` gate, the
Prisma 7 connection chain, the `proxy.ts` convention, and a dedicated §8 table of
divergences from comercial-web, so the two systems are not confused.
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

- [x] Server-side query returning `{ IDLocal, Local }` for the branch selector.
      **Superseded**: the selector was removed and `lib/auth/locales.ts` deleted.
- [x] `app/(auth)/login/page.tsx`.
- [x] Login form: RHF + Zod, `signIn("credentials")` with error handling.
- [x] `app/(main)/layout.tsx` with the server-side administrator check.
- [x] Move the current starter page to `(main)` so `/` is protected.

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

### Cache Components blocked the first build of the UI

Both `/login` and `/` read runtime data (`searchParams`, the session, the branch
list). With `cacheComponents: true` enabled in `next.config.ts`, Next 16 flags
every such route during prerendering and the build fails.

The documented escape hatch is `export const instant = false`, which keeps the
route blocking on the server instead of prerendering a shell. It is real Next 16
API, not a workaround invented on the spot: see
`node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`,
which names this exact situation ("routes that read the session") and recommends
opting out per route and adopting the Cache Components patterns one at a time.

Applied to `app/(auth)/login/page.tsx` and `app/(main)/page.tsx`.

### End-to-end runtime verification

Production build served on a spare port with an ephemeral `AUTH_SECRET`:

| Check | Result |
| --- | --- |
| `GET /login` | `200` |
| Branch names in the rendered HTML | VENTANAS, PILADORA, VINCES, PECHICHE all present |
| Form controls present | `login-usuario`, `login-clave`, `login-idlocal` |
| `GET /` without a session | `302 → /login?callbackUrl=%2F` |
| Server error log | clean |

That single `200` proves the whole chain works: Next 16 runtime → `proxy.ts` →
server component → Prisma 7 → `@prisma/adapter-mssql` → SQL Server. The branch
list is not mocked; those names come from the live `Local` table.

**Not verified: a successful login.** That needs real credentials, which are not
in this session. Everything up to the credentials POST is proven; the happy path
of `authorize` returning a user is not.

### Post-correction verification (implicit IDLocal, UsuarioRolId gate)

| Check | Result |
| --- | --- |
| `GET /login` | `200` |
| Form controls | `login-usuario` and `login-clave` present, `login-idlocal` absent |
| Branch names in HTML | none (VENTANAS / PILADORA / VINCES all absent) |
| `POST /api/auth/callback/credentials` | `302 → /login?error=CredentialsSignin&code=credentials` |
| `GET /api/auth/session` | `200 null` |
| Unexpected server errors | none |

The absent branch names prove the login page no longer queries `Local`, while
the `CredentialsSignin` redirect proves `authorize` still executes the pinned
lookup against SQL Server. `npx tsc --noEmit` and `next build` both clean.

## Open items

- **`AUTH_SECRET` is not set yet.** next-auth fails closed without it. The user
  generates one (never share it in chat) and adds it to `.env`. Runtime tests so
  far used an ephemeral secret passed inline to the process.
- **A real login has never been attempted.** Needs a genuine legacy credential
  and an `ADMINISTRADOR` account. Until then, the `authorize` happy path,
  the `jwt`/`session` callbacks populating real values, and the sign-out action
  are unproven at runtime.
- `export const instant = false` is a deliberate opt-out from Cache Components
  prerendering, not an oversight. Revisit when adopting the Cache Components
  authentication patterns.
- No test runner is installed, so verification is typecheck plus production
  build, plus manual HTTP checks against a running server.
- Legacy passwords are plaintext, which is a real security exposure inherited
  from the source system. Out of scope here, but it should be recorded as a
  known accepted risk rather than silently ignored.

---

## Follow-up: only administrators of branch 1 can sign in

### What was wrong

`authorize` pinned the branch (`IDLocal = 1`) but never checked the role. So any
active **cashier** of VENTANAS exchanged credentials for a valid session and was
only bounced later by `app/(main)/layout.tsx` (`redirect("/login?error=forbidden")`)
— after next-auth had already minted the JWT cookie. The gate existed, but in the
wrong layer: a session should never be issued to an account that cannot use the
system.

### The rule, in one place

`lib/acceso.ts` now owns it: `puedeIngresar` (enabled **and** branch 1 **and**
`UsuarioRolId === 1`) and `esAdminDeVentanas` (branch + role, for a session that
already exists). Two enforcement points consume the same function:

| Point | Uses | Effect |
| --- | --- | --- |
| `auth.ts` → `authorize` | `puedeIngresar` | no session is issued; the answer is the generic `CredentialsSignin`, identical to a wrong password |
| `app/(main)/layout.tsx` | `esAdminDeVentanas` | re-checks every request, so a token minted before this rule stops working immediately |

The product decision was **one message for every rejection** (wrong password,
wrong branch, wrong role). Nothing in the login screen changed: a role rejection
returns `null` exactly like a bad password, and the existing `CREDENTIALS_ERROR`
copy already covers it. The screen cannot be used to discover which accounts exist.

### A second defect, found while wiring it

`NombreUsuario` is **not unique inside a branch**. `MARIELA` exists twice in
`IDLocal = 1`: `#20` (administrator) and `#7111` (`UsuarioRolId` null). The old
`findFirst` took whichever row the database returned first — if it returned the
row without a role, the real administrator would have been refused once the role
check landed. `authorize` now reads every candidate of the branch, filters by the
password, and then picks the one the rule authorises.

### Live verification against the production data

The rule was evaluated over all 132 rows of `Usuario` (no password ever read or
printed):

| Account | Branch | Role | Enters |
| --- | --- | --- | --- |
| DARYHEN #1 | 1 | 1 | yes |
| ALFREDO #5 | 1 | 1 | yes |
| ROSARIO #7 | 1 | 1 | yes |
| JULIA #12 | 1 | 1 | yes |
| ROSARIOAD #15 | 1 | 1 | yes |
| MARIELA #20 | 1 | 1 | yes (the row `#7111` no longer shadows her) |
| a cashier of branch 1 | 1 | 2 | no |
| ALFREDO VI, administrator of another branch | ≠1 | 1 | no |

That is exactly **6** accounts, all administrators of VENTANAS. The user expected
5, so one of the six should probably be disabled; `Usuario.Estado = 0` in the
legacy system is enough, because the rule treats anything but `true` as a
rejection — no deploy involved.

In the browser, an existing session of DARYHEN (administrator, branch 1) still
reaches `/reporte-maiz` unchanged, which is the no-regression check: the rule
removes cashiers, not administrators.

### Checks

| Check | Result |
| --- | --- |
| `lib/acceso.test.ts` | 9 cases — branch, role, `Estado` `false`/`null`/absent, role 10 vs 1, session-side predicate |
| `pnpm test` | 13 files, **155 tests** |
| `npx tsc --noEmit` | clean |
| `pnpm lint` | no findings in the touched files |

### Still open

- A **real cashier login** has not been attempted: it needs a genuine password,
  which this harness must not read. The unit tests and the row-level evaluation
  above cover the rule; the end-to-end rejection is unconfirmed.
- The 6-vs-5 count is a data decision, not a code one.
