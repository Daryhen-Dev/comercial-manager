# Tooling baseline: state, validation, forms, data access

## Goal

Establish the application tooling stack before any feature code is written, so
modules are built on decided foundations rather than retrofitted ones.

## Context discovered during exploration

- Target database is **SQL Server `BDComercial`**, shared with `comercial-web`.
  Schema is legacy and **read-only**: `prisma migrate` is forbidden by
  `DOCUMENTACION-CONEXION-SISTEMA-ADMIN.md` §1. Prisma is for queries only;
  schema refresh is `db pull` + `generate`.
- That document's Prisma section describes **Prisma 5/6**: `PrismaClient`
  imported from `"@prisma/client"`, `url` inside `schema.prisma`, singleton
  copied verbatim. Prisma 7 changed all three.
- Next 16 already lists `@prisma/client` and `prisma` in the default
  `serverExternalPackages` set, so no `next.config.ts` change is needed.
- `server-only` is not installed, but Next resolves `import "server-only"`
  natively; no extra dependency required (build proves it).

## Decisions

### Versions pinned by compatibility, not by `latest`

| Package | Installed | Why this one |
| --- | --- | --- |
| zustand | 5.0.15 | peer `react >=18`, satisfied by 19.3.0 |
| zod | 4.6.7 | `@hookform/resolvers` peer allows `^4.0.0` |
| react-hook-form | 7.90.0 | peer `react ^19` |
| @hookform/resolvers | 5.9.2 | peer `react-hook-form ^7.55` |
| prisma / @prisma/client | 7.10.1 (exact) | current major; see trap below |
| @prisma/adapter-mssql | 7.10.1 | SQL Server driver adapter |

**Do not use `latest` for Prisma.** Verified on this machine:
`prisma@latest` resolves to `8.0.0-rc.23` while `@prisma/client@latest` is
`7.10.1` — a release-candidate CLI paired with a stable client one major
behind. `prisma@7.10.1` and `@prisma/client@7.10.1` are pinned exactly (no
caret) so this cannot drift. The CLI itself nags `npm i prisma@latest`; ignore
that until 8.0.0 goes stable and `@prisma/client` follows.

### Zod 4 breaks the obvious `useForm` typing

`z.coerce.number()` (and `z.preprocess`) has **input type `unknown`** while its
output is `number`. `z.infer` yields the output type, so this fails:

```ts
// TS2322: Resolver<{ monto: unknown }, ...> not assignable to
// Resolver<{ monto: number }, ...>
useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) })
```

The working pattern needs all three generics:

```ts
useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
  resolver: zodResolver(schema),
})
```

Every form must use the three-generic form whenever the schema coerces or
preprocesses a field.

### Prisma 7 wiring (deviates from the connection doc)

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "sqlserver"
}
```

- No `url` in `schema.prisma`; it lives in `prisma.config.ts`.
- Client imported from `@/generated/prisma/client`, **not** `@prisma/client`.
- SQL Server reached through `@prisma/adapter-mssql` (`mssql@12`), not the
  removed Rust query engine.
- `generated/` is gitignored; run `pnpm db:generate` after clone and before
  build (the connection doc already mandates this step).

### `process.env` instead of Prisma's `env()` helper

`env("DATABASE_URL")` throws while loading `prisma.config.ts` when the variable
is missing. That made `prisma validate` **and** `prisma generate` fail with
`PrismaConfigEnvError` on a machine without `.env`, which in turn makes
`next build` impossible because `lib/db.ts` imports the generated client.

`datasource.url` is typed `string | undefined`, so the config uses
`process.env.DATABASE_URL`. Commands that actually connect still fail, but at
connection time, with a message that points at the missing variable.

## Tasks

- [x] Branch `chore/tooling-baseline`.
- [x] Install zustand, zod, react-hook-form, @hookform/resolvers.
- [x] Verify Zod 4 + resolvers v5 typecheck together (scratch file, deleted).
- [x] Production build green.
- [x] Decide Prisma major → **7.10.1**.
- [x] Install prisma, @prisma/client, @prisma/adapter-mssql (exact 7.10.1).
- [x] Allow Prisma build scripts in `pnpm-workspace.yaml`.
- [x] `prisma/schema.prisma`, `prisma.config.ts`, `lib/db.ts`, db scripts.
- [x] `prisma validate` + `db:generate` + typecheck + build green.
- [x] `db:pull` against the real SQL Server.
- [x] Regenerate the client against the introspected schema.

## Evidence

Install: `+ @hookform/resolvers 5.9.2`, `+ react-hook-form 7.90.0`,
`+ zod 4.6.7`, `+ zustand 5.0.15`, `+ @prisma/adapter-mssql 7.10.1`,
`+ @prisma/client 7.10.1`, `+ prisma 7.10.1` (pnpm 10.34.5).

Zod verification: temporary `lib/__scratch-check.ts` with `zodResolver` +
`useForm` + a zustand store, run through `tsc --noEmit`.
- Run 1: `TS2322` on the `resolver` prop (the input/output mismatch above).
- Run 2 with `<z.input<S>, unknown, z.output<S>>`: zero errors.
- Scratch deleted; `next build` green afterwards.

pnpm build scripts: install warned `Ignored build scripts:
@prisma/engines@7.10.1, prisma@7.10.1`. Added `onlyBuiltDependencies` to
`pnpm-workspace.yaml`; `pnpm install` then ran both postinstall hooks ("Done").

Prisma:
- `prisma validate` → "The schema at prisma\schema.prisma is valid".
- `pnpm db:generate` → "Generated Prisma Client (7.10.1) to .\generated\prisma".
- Adapter API read from `node_modules/@prisma/adapter-mssql/dist/index.d.ts`
  rather than guessed: `constructor(configOrString: sql.config | string, ...)`.
- Adapter accepts the doc's connection string. Source: `parseConnectionString`
  does `connectionString.replace(/^sqlserver:\/\//, "")`. Runtime check with
  `sqlserver://DARYHEN-PC;port=1433;database=BDComercial;...` printed
  `PARSE OK -> PrismaMssqlAdapterFactory`, `provider: sqlserver`.
  **The existing `DATABASE_URL` format needs no change.**
- `tsc --noEmit` clean; `next build` green.

### Introspection against the real database

`pnpm db:pull` against `BDComercial` succeeded:

```
Datasource "db": SQL Server database
✔ Introspected 311 models and wrote them into prisma\schema.prisma in 997ms
```

Six tables were skipped because they lack a usable unique identifier:
`CierreInventarioExcedente`, `Conta_Asiento_Detalle_Tipo`,
`Conta_Cuenta_Banco_Enlace`, `Conta_Gasto_Factura_Pasivo`, `FechaMeses`,
`Venta_TipoPago_Conector`. They get no Prisma model, so any access to them must
be raw SQL (`$queryRaw`).

`schema.prisma` is now 3087 lines and `db pull` added
`previewFeatures = ["partialIndexes"]` to the generator on its own.
`pnpm db:generate` produced a 17 MB client (gitignored). TypeScript check went
from ~2.3s to ~6.9s; `next build` still green.

### Connection doc cross-checked against reality

`model Usuario` matches `DOCUMENTACION-CONEXION-SISTEMA-ADMIN.md` §4 exactly:
`IDUsuario` (PK), `UsuarioRolId`, `IDLocal`, `NombreUsuario`, `Clave`,
`RolUsuario`, `Estado`.

Two consequences the doc does not state:

1. Every credential field is **nullable** — `NombreUsuario`, `Clave`,
   `UsuarioRolId`, `IDLocal`, `Estado` are all `?`. Prisma types them
   `string | null` / `boolean | null`, so the login flow must handle nulls
   explicitly instead of assuming presence.
2. `Clave` is a plaintext `NVarChar(Max)` column, consistent with the doc's
   warning that the legacy compares passwords in text. It is a deliberate
   compatibility constraint, not an oversight, and deserves a comment when the
   auth code lands.

There is no single `Venta` model; the sales data is spread across a family of
tables (`CierreVentaDelDia`, `ComisionVenta`, `ComprobanteDepositoVenta`,
`Conta_Asiento_Detalle_Venta`, and others). Any sales module starts by mapping
that family, not by assuming one table.

## Open items

- **`.env` does not exist yet.** Writing `.env.example` was blocked by the
  local safety policy (flagged as a sensitive path), so the variables are
  documented here instead:
  - `DATABASE_URL` — `sqlserver://HOST;port=1433;database=BDComercial;user=…;password=…;encrypt=false;trustServerCertificate=true`
  - `AUTH_SECRET` — JWT signing secret, must differ from comercial-web's.
  The user creates `.env` locally; it is gitignored.
- `lib/db.ts` follows the doc's `db` export convention but with the Prisma 7
  client and adapter. Section 2.3 of
  `DOCUMENTACION-CONEXION-SISTEMA-ADMIN.md` is now stale and should be updated
  (not done — the doc is the user's artifact describing comercial-web).
- `prisma/schema.prisma` is committed so schema drift is visible in diffs and
  CI can generate without database access. The 17 MB generated client is not.
- The six identifier-less tables cannot be reached through the Prisma Client.
  Decide per case whether raw SQL is acceptable or the legacy table needs a
  key (the latter is the WinForms system's call, not ours).
- `pnpm add` warned that `eslint@9.39.5` is deprecated ("no longer supported"),
  meaning ESLint 10 is out. Separate upgrade, not in scope.
- No test runner installed; verification is typecheck + build. That gap matters
  once form or money-rounding logic lands (doc §6.6).
