# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: administrators of the commercial system, working on-site at a
branch.** They are standing, moving between the office and the plant or
warehouse, holding a phone in one hand, often with poor signal and daylight on
the screen. They are not desk workers and they are not sitting down.

Secondary: the same administrators when they do sit at a desktop. The desktop is
a real case, not a decorative breakpoint, but it is the second one.

The broader workforce (132 users in the source database) is mostly cashiers
(`UsuarioRolId = 2`). They are **not** users of this product; access is gated to
administrators only.

## Product Purpose

Give the administrators of an agro-industrial company a modern panel over the
sales and operations data that currently only exists inside a legacy WinForms
application, so they can consult it from a phone instead of walking to a
terminal.

Success means an administrator can answer a real operational question — today's
closings, a customer, a product, a branch's numbers — in seconds, without
opening the legacy application.

## Positioning

This is not a replacement for the existing systems and it does not try to be
one. It reads the **same production SQL Server database** that `comercial-web`
reads, treats its legacy schema as read-only, and adds a modern, phone-first
surface on top. A neighbouring product could copy the UI; it could not copy the
privilege of writing a modern read layer over a live legacy schema without
owning the business rules behind it.

## Operating Context

- Spanish-speaking users in Bolivia. UI copy is Spanish, in the same second
  person the existing system uses ("ingresá", "verificá"), not neutral Spanish.
- The data is Spanish and legacy-shaped: branch names (`Local`) are VENTANAS,
  PILADORA, VINCES, PECHICHE, PALENQUE, PALENQUE 2, PEDRO CARBO, LA YOLANDA.
- Sessions are long-lived and the phone is the device that is present, so the
  first screen after login must be useful without hunting.
- Connectivity is not guaranteed in the plant or the warehouse. Assume a slow or
  interrupted network, and never make a control depend on a spinner resolving
  before it is usable.
- Passwords are stored in plaintext in the legacy system and compared exactly.
  This is inherited, not chosen.

## Capabilities and Constraints

**Mobile-first is the project premise.** Every surface is designed for a phone
in portrait first and then adapted upward to desktop. A desktop layout is a
consequence of the phone design, never the starting point. Touch targets,
thumb reach, viewport height (`dvh`, not `vh`), keyboard behaviour and one-handed
reach come before density.

Confirmed constraints:

- **Read-only legacy schema.** `prisma migrate` is forbidden. Schema refresh is
  `db pull` + `generate`. The WinForms system owns the schema.
- **Two applications write to the same database.** Any future write must respect
  the legacy column conventions and be validated server-side.
- **Authentication**: next-auth credentials against the legacy `Usuario` table.
  The branch is implicit (`IDLocal = 1`) and the administrator role is
  `UsuarioRolId = 1`. Exactly 7 accounts satisfy both conditions.
- Six legacy tables have no usable unique identifier and cannot be reached
  through the Prisma Client.
- There is no test runner yet. Verification is typecheck, production build, and
  HTTP checks against a running server.

Explicitly undecided:

- Whether the product will later ship as a native wrapper (Capacitor or similar).
  Assume plain web until the user says otherwise.
- Which sales module comes first after the app shell.

## Brand Commitments

- Name: **Comercial Manager**.
- Language: Spanish, Rioplatense second person. Never English UI copy.
- The product has no logo, brand palette, or marketing site. There is nothing to
  preserve visually — the incumbent shadcn/ui default (Nova preset, neutral base,
  Lucide, Geist) is a starting point, not an identity.
- **Binding direction volunteered by the user for the login surface**: a border
  that illuminates, running from one colour into another, resolving into a
  circumference. Colour choice was delegated to the implementer.

## Evidence on Hand

- Live SQL Server `BDComercial`, introspected into 311 Prisma models.
- Real role distribution: `UsuarioRolId = 1` → 33 administrators, `= 2` → 81
  cashiers, `null` → 18 (2 of them administrators).
- Real branch table: 8 rows, ids 1–8.
- No testimonials, benchmarks, customer logos, screenshots, or marketing claims
  exist. Future work must not fabricate them.

## Product Principles

1. **Phone first, or it is not done.** Any surface judged on desktop alone is
   unfinished.
2. **One-handed and glanceable.** The primary action sits within thumb reach and
   is readable in daylight, standing up.
3. **The legacy schema is law, read-only.** Adapt the UI to the data; never the
   reverse, and never invent fields that do not exist.
4. **Fail visibly, not silently.** A failed query, a dead network, or a rejected
   login must say so in Spanish, in place, without a stack trace.
5. **Access is a business rule, not a toggle.** Role and branch are enforced
   server-side on every request, never only in the interface.

## Accessibility & Inclusion

- Touch targets sized for standing, one-handed use; never a control below the
  44px minimum.
- Sufficient contrast for outdoor use in daylight, where screens are washed out.
- Full keyboard and screen-reader access on desktop, since that is the secondary
  device class and administrators may also be office users.
- Errors announced to assistive technology (`role="alert"`), and every form
  control reachable and labelled.
