# Kardex de Venta module + sidebar shell

## Goal

Bring the read-only Kardex de Venta report (`/ventas/operaciones/kardex-venta`)
into this admin, replicating `Documentacion-Kardex-Venta.md`, and give the
workspace its first navigation: a simple sidebar.

## Context discovered during exploration

The document (1978 lines) is a faithful spec of another repo's implementation and
says to copy several shared files. Three of them **do not exist here**:

| Piece | State before this work |
| --- | --- |
| `components/shared/report-table.tsx` | absent |
| `components/shared/use-excel-navigation.ts` | absent |
| `components/shared/virtual-window.ts` | absent |
| `lib/fmt.ts` | absent (trivial, given verbatim) |
| `badge`, `pagination`, `sonner` (shadcn) | absent |
| Vitest | not installed |

`ReportTable` is not a table: sticky header, Excel-style keyboard navigation with
clipboard copy, hand-rolled virtualization with spacer rows, and frozen column
widths measured through a hidden table. The document describes the behaviour in
prose but does not include the source, so **it was reconstructed from the
document, not copied**. That is the main divergence risk in this work.

The document also assumes a shell with a 3rem header and a `p-6` main, plus a tab
bar (`OperacionesNav`) for the Ventas · Operaciones submenu. This repo has none of
that.

## Decisions

- **Access control added, deliberately diverging from 1:1.** The document ships
  both actions with no session, role or branch check and flags it as the place to
  add it (§12.2). Every action now calls `requireAdmin()` (`UsuarioRolId === 1`)
  before touching the database. The report stays **global across branches**
  (BM-5 parity); only the role is enforced. Behaviour visible to an administrator
  is unchanged.
- **Sidebar instead of the tab bar.** The user asked for a simple sidebar, so
  `OperacionesNav` from §1.4 was not implemented; the route path is unchanged and
  the sidebar links straight to it. The module's own chrome (list, history,
  header) follows the document.
- **`ReportTable` reconstructed against the documented behaviour**, including
  `UMBRAL_FILAS_VIRTUALIZACION = 150`, `ALTO_FILA_FALLBACK = 33`,
  `OVERSCAN_FILAS = 4`, `ALTO_CONTENEDOR_FALLBACK = 600`, the pure window
  function, and the `max + 2` width freeze.
- **`asChild` → `render`.** The document's `Button asChild` is Radix's API; this
  project's Button is Base UI, which composes with `render={<Link/>}`.
- **`size="icon-sm"` → `size="icon"` + `size-8`.** The Nova preset has no
  `icon-sm` size.
- **`instant = false` + a server/client split on screen 1.** Route segment config
  cannot be exported from a client component, so `page.tsx` is now a thin server
  component and the interactive list lives in `_components/kardex-venta-lista.tsx`.
- **`<Toaster />` mounted in `(main)`.** `sonner`'s toasts are inert without it.

## Tasks

- [x] Install `sonner`, `vitest`; add `badge`, `pagination`, `sonner` components.
- [x] `lib/fmt.ts` with the fixed `en-US` two-decimal format.
- [x] `virtual-window.ts` (pure window calculation).
- [x] `use-excel-navigation.ts` (arrows, Home/End, PageUp/Down, Ctrl+C copy).
- [x] `report-table.tsx` (sticky header, virtualization, frozen widths, pagination).
- [x] Sidebar shell, mobile drawer + desktop rail, wired to the existing logout action.
- [x] Helpers `escapeLike` / `formatFechaVenta` / `formatFechaMovimiento` + 15 tests.
- [x] Server actions with verbatim SQL, guards, DTOs and mappers.
- [x] Screen 1 (list, debounce 300 ms, latest-wins, age scale, totals cards).
- [x] Screen 2 (server component, empty states, header, 17-column history grid).
- [x] `pnpm test`, `tsc`/`next build`, and a read-only SQL smoke test.

## Evidence

**Tests:** `pnpm test` → 1 file, **15/15 passed**.

**Build:** `next build` green. Routes:
`ƒ /ventas/operaciones/kardex-venta` and
`◐ /ventas/operaciones/kardex-venta/[idCliente]`.

**Access control at the edge:** both routes redirect when unauthenticated:
`302 → /login?callbackUrl=%2Fventas%2Foperaciones%2Fkardex-venta` (and the
`/[idCliente]` variant).

**SQL smoke test against the live database** (temporary script, deleted):

- Screen 1, `soloConSaldo = true`, empty filter → **50 rows**,
  `porCobrar = 417.151,25`, `porEntregar = 300.831,43`.
  First row: `idCliente 37591`, `AA TOAPANTA TEREZA / LUIS MUÑOZ`,
  `idTipo 0`, `1841` days of age → level `alto`. The document's snapshot numbers
  differ because that snapshot included zero-balance clients and was taken on a
  different date.
- Screen 2, client `40116` → the third visible row carries
  `debe 93.50` / `acumulado -13.66`. That is exactly the BG-1 case documented as
  T7: the accumulated balance jumps because the CTE sums movements that the INNER
  JOINs hide. **Parity confirmed against real data**, not just by reading the SQL.

This is the check a typecheck cannot do: every column name, alias and JOIN was
validated against the live schema.

## Open items

- **`ReportTable` is a reconstruction.** It was written against the document's
  prose, not copied from the reference implementation. The behaviours are
  implemented and typecheck, but visual and interaction parity (scroll stability
  with 1000+ rows, column freeze on scroll, cell copy toasts) has **not been
  observed in a browser**; this harness has none. The heaviest client of the
  module is client 8438 with ~1782 movements, per the document.
- **The Ventas · Operaciones tab bar (§1.4) does not exist.** The sidebar is the
  navigation. If the module ever grows siblings (`Operaciones Generales`,
  `Pago de Ventas`, …) the tab bar becomes necessary again.
- **`Pagination` inside `ReportTable` is untested in this app**: both screens pass
  `paginate={false}`, so the pager path never renders here.
- **R1..R15 from the document are inherited as-is**, including the amount search
  that does not accept what the grid displays (`287,092.92` finds nothing),
  stale `data` remaining visible after an error, and `number` instead of decimal
  arithmetic. They are documented as limitations, not fixed.
- No `error.tsx` / `global-error.tsx` exists, so a database failure on screen 2
  still reaches Next's default error page.
