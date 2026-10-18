# Tooling baseline: state, validation, forms, data access

## Goal

Establish the application tooling stack before any feature code is written, so
that modules are built on decided foundations rather than retrofitted ones.
Prisma is tracked here but blocked on a version decision (see Open items).

## Context discovered during exploration

- Target database is **SQL Server `BDComercial`**, shared with `comercial-web`.
  Schema is legacy and **read-only**: `prisma migrate` is forbidden by
  `DOCUMENTACION-CONEXION-SISTEMA-ADMIN.md` §1. Prisma is for queries only;
  schema refresh is `prisma db pull` + `prisma generate`.
- That document specifies `lib/db.ts` exporting `db`, importing `PrismaClient`
  from `"@prisma/client"`, with `DATABASE_URL` in `prisma/schema.prisma`.
  **That shape is Prisma 5/6.** Prisma 7 changed it (see Decisions).
- Next 16 already lists `@prisma/client` and `prisma` in the default
  `serverExternalPackages` set, so no `next.config.ts` change is needed.

## Decisions

### Versions pinned by compatibility, not by `latest`

| Package | Installed | Why this one |
| --- | --- | --- |
| zustand | 5.0.15 | peer `react >=18`, satisfied by 19.3.0 |
| zod | 4.6.7 | `@hookform/resolvers` peer allows `^4.0.0` |
| react-hook-form | 7.90.0 | peer `react ^19` |
| @hookform/resolvers | 5.9.2 | peer `react-hook-form ^7.55` |

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

Every form in this project must use the three-generic form whenever the schema
coerces or preprocesses a field.

## Tasks

- [x] Branch `chore/tooling-baseline`.
- [x] Install zustand, zod, react-hook-form, @hookform/resolvers.
- [x] Verify Zod 4 + resolvers v5 typecheck together (scratch file, deleted).
- [x] Production build green.
- [ ] Prisma: decide major version, then install.

## Evidence

Install output: `+ @hookform/resolvers 5.9.2`, `+ react-hook-form 7.90.0`,
`+ zod 4.6.7`, `+ zustand 5.0.15` via pnpm 10.34.5.

Verification approach: a temporary `lib/__scratch-check.ts` exercising
`zodResolver` + `useForm` + a zustand store, run through `tsc --noEmit`.

- First run failed with `TS2322` on the `resolver` prop — the input/output
  mismatch described above. This is the defect the verification was for.
- Second run with `<z.input<S>, unknown, z.output<S>>` typechecked with zero
  errors.
- Scratch file deleted; `next build` green afterwards.

## Open items

### Prisma version is undecided (blocking)

Two viable paths, with different consequences:

**Prisma 7.10.1 (current major)**
- Needs `@prisma/adapter-mssql@7.10.1` (pulls `mssql@12`, no separate tedious).
- `generator client { provider = "prisma-client", output = "./generated/prisma" }`.
- `datasource db { provider = "sqlserver" }` with **no `url`**; the URL moves to
  `prisma.config.ts` via `defineConfig({ datasource: { url: env("DATABASE_URL") } })`.
- Client imported from the generated output, **not** `@prisma/client`.
- Deviates from the connection doc's `lib/db.ts` snippet, which must be updated.

**Prisma 6.19.3 (previous major, `prev` dist-tag)**
- Matches the connection doc and `comercial-web` exactly: `@prisma/client`
  import, `url` in `schema.prisma`, no adapter.
- Stays on a superseded major.

Trap worth remembering: `prisma@latest` currently resolves to `8.0.0-rc.23`
while `@prisma/client@latest` is `7.10.1`. Installing `prisma@latest` yields an
RC CLI paired with a stable client of the previous major. Never use bare
`latest` for this package; pin it.

### Other notes

- `pnpm add` warned that `eslint@9.39.5` is deprecated ("no longer supported"),
  meaning ESLint 10 is out. Not in scope here; worth a separate upgrade.
- No test runner is installed, so verification is currently typecheck + build.
  If forms grow logic, that gap matters.
