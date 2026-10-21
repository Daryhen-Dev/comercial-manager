# Reporte Maíz por cierre

## Goal

A simple read-only route `/reporte-maiz` with the two pieces specified in
`Documentacion-Cierre-Pdf-Seleccion-Inventario-Maiz.md`:

1. **Cierre selector** — search the inventory closings of the signed-in branch by
   date, pick one, propagate it in the URL as `?idCierre=`.
2. **Inventario de Maíz section** — the corn stock **already stored** in
   `Cierre_Producto` for the closings selected by the legacy CTE, plus a totals
   footer.

The rest of the legacy `cierre-pdf` route (Circulante, Bancos, Estado de Producto,
Producto Embodegado, the general print button) stays out of scope.

## Decisions

| # | Decision | Why |
| --- | --- | --- |
| D1 | Route is `app/(main)/reporte-maiz` (URL `/reporte-maiz`), not the legacy `/reportes/contabilidad/cierre-pdf`. | User's call: "la ruta va a ser sencilla". |
| D2 | ~~**Exact parity with the legacy maíz query**, including `UNION ALL`~~ — **revised the same day to D18.** | User's call before seeing the result. |
| D3 | Role gate `UsuarioRolId === 1`, same as `(main)` and the other reports. | Repo convention; `RolUsuario` is the display name here and is not authoritative. |
| D4 | `idLocal` for the search comes from the session, never from a client parameter. | Doc §4.7.1/§4.7.4. |
| D5 | The header query uses `LEFT JOIN Usuario` (legacy: `INNER JOIN`). | The header exists only to obtain `fechaFinal`; an `IdUser` NULL must not hide the section. Deviation logged. |
| D6 | The header picks `TOP 1 ... ORDER BY CCC.IdCierre ASC` (legacy: unordered, first row). | Deterministic and equivalent to what the legacy reader consumed. |
| D7 | Dates cross to the client as ISO strings; the dialog formats them in UTC with `hourCycle: h23`. | Repo convention: no `Date` crosses a component boundary; doc §5.5.2 pins UTC. |
| D8 | `?idCierre` is accepted only when `Number.isInteger(n) && n > 0`. | The doc's bare `Number()` lets `12.5` and `-3` reach the query. |
| D9 | Grid is mobile-first: stacked label/value rows on the phone, table from `md`. | `AGENTS.md`: every surface starts at 390px. |
| D10 | The search dialog takes no `open` prop: the caller mounts it on open and unmounts it on close. | A fresh instance per opening cannot carry a stale query, list or selection, and unmounting cancels the pending debounce timer. Resetting through a state effect would be a cascading render (the repo's lint rule rejects it). |
| D11 | The hub card lives in the existing "Cierre" section, named "Reporte Maíz por Cierre". | The legacy put it under *Contabilidad*; this hub only has three sections and a fourth would be noise. |
| D12 | The header period is formatted on the server (UTC, `Intl.formatToParts`) and travels as a string. | Same output on both sides, so no hydration mismatch, and the UTC pin of §5.5.2 is kept in one place (`lib/fmt.ts`). |
| D13 | The sidebar entry is **"Maíz por Cierre"** (`FileSpreadsheet`), next to "Inventario Maíz" (the recalculating report). | Two reports about the same grain need distinct labels in a 390px drawer; "Maíz por Cierre" says what makes it different: it belongs to one closing. |
| D14 | The page `h1` is **"Maíz por Cierre"**; the card keeps the documented section title. | The first render showed "Inventario de Maíz" twice, once as the page title and once as the card title (seen in the browser). Now the page names the screen and the card names its section. |
| D15 | The page-level "SALIR" button was removed. | The sidebar already has a "Salir" that logs out; a second "SALIR" that only went back to `/reportes` read as the same action and behaved differently. On a phone it was also a full-width row of dead weight. |
| D16 | The phone layout is one label/value line per metric, not a two-column grid. | The grid left every value floating at the centre of the screen and orphaned the fifth metric; a phone scans a financial summary down the right edge. |
| D17 | `fmt` strips the sign of an all-zero rendering. | `Util. QQ` of `MAIZ PECHICHE` printed `-0.00`, which reads as a defect. The rounding stays `toLocaleString`'s, so `-0.005` is still `-0.01`. |
| D18 | **B-1 is fixed**: `UNION` in the CTE `A` instead of the legacy `UNION ALL`. | The duplicate was reproduced on screen and the user changed the decision: `UNION` dedupes the `(IdLocal, Fecha)` pair, so two branches that closed at the same instant still both enter and only the exact repeated pair disappears. B-2 is left as the legacy has it. |
| D19 | **Branch 1 participates in the "last closing per branch" arm**: the legacy's `C.IdLocal != 1` is gone. | The user rejected it as business behaviour, and the document only lists it as an inherited effect (B-3: "confirmar con negocio si debe participar siempre"). VENTANAS is a branch with **1,712 closings**, the longest history in the table; excluding it meant the report silently omitted the plant unless its own closing was the selected one. |

## Known risks inherited from the legacy

- **B-1 — FIXED (D18).** Was: if the selected closing was the last one of its
  branch, its date entered the CTE `A` twice, the branch row was duplicated and
  the footer counted it twice. Reproduced live on 129220 and 130216, then fixed
  with `UNION`. Verified afterwards in the browser: 129220 dropped from a total
  stock of 32,016.24 to 16,290.11 and from 546,940.60 to 278,299.07 in inversion;
  130216 dropped from 18,432.16 to 17,470.73.
- **B-3 — REVERSED (D19).** Was: `C.IdLocal != 1` excluded VENTANAS from the
  "last closing per branch" arm, so branch 1 only appeared when its own closing
  was the selected one. Now it enters like every other branch. There is no
  business reason on record for the exclusion; the document itself asks for
  confirmation.
- **B-2** — the join is by `Fecha` only, so two branches that closed on the same
  timestamp both enter. Left as the legacy has it.
- **B-6** — `aNumero` parses `"1,234.56"` → `1234.56` but `"1.234,56"` → `1.23456`
  (finite and **wrong**, not `0` as the document says for the single-group case).
  The arithmetic is left exactly as documented; anomalous values are logged
  server-side.
- **B-8** — two `MAIZ` rows in the same closing would collide on `idCierre` as a
  React key; the key includes the index.

## Plan

1. Data layer: the three queries of the source document, verbatim, typed.
2. Mappers: the documented `num()` parser, row mapping, totals, `idCierre` gating.
3. Tests for the parser, the totals and the SQL contract.
4. Server action: role guard + header → section composition.
5. Shared closing-search dialog (350 ms debounce, last-wins).
6. Selector, section and page.
7. Report hub card.
8. Verification: `pnpm test`, `tsc`, `pnpm build`, live-data sanity check.

## Tasks

- [x] Data layer: `consultas.ts` (search, header, maíz) + `tipos.ts`.
- [x] Mappers + `aNumero` + totals + `resolverIdCierre`.
- [x] Tests: parser, totals, gating, SQL contract.
- [x] Server action `cargarReporteMaiz` + `buscarCierres`.
- [x] `BusquedaCierreDialog` shared component.
- [x] `CierreSelector` + `InventarioMaizSection` + `page.tsx`.
- [x] Hub card under "Cierre".
- [x] Verify: tests, tsc, lint (new files), build; sanity check against the live database.

## Evidence

### Browser review (ego-browser, dev server on :3002, signed in as ALFREDO VI / VINCES)

Reviewed live, not reasoned: the sidebar entry, the dialog (real closings, `dd/mm/yyyy hh:mm` in UTC,
newest first), the selection propagating to `?idCierre=129220`, the section with four rows and the
footer, and both breakpoints at 390px and 1280px.

Three defects found only by looking, all fixed and re-verified:

1. the title repeated (D14);
2. `SALIR` competed with the sidebar's log-out (D15);
3. mobile label/value pairs were misaligned and `-0.00` was printed (D16, D17).

**B-1 was plainly visible on screen**: closing 129220 rendered `MAIZ VINCES` twice, with identical
values, and the footer totalled `32,016.24` instead of `16,290.11`. The user then reversed the earlier
parity decision and the query now uses `UNION` (D18). Final browser verification over three closings:

| Closing | Rows | Total stock | Total inversion |
| --- | --- | --- | --- |
| 129220 (VINCES) | 3, no duplicate | 16,290.11 | 278,299.07 |
| 130216 (PECHICHE) | 3, no duplicate | 17,470.73 | 298,438.57 |
| 130217 (VENTANAS) | 4 (local 1 arm untouched) | 28,663.29 | 496,180.09 |

### Live verification of D19 (branch 1 included)

| Closing | Period end | Rows | VENTANAS row | Total stock |
| --- | --- | --- | --- | --- |
| 129220 (VINCES) | 13/10/2026 21:40 | 4 | 13,541.39 · 17.56 · 237,787.52 | 29,831.50 |
| 130216 (PECHICHE) | 14/10/2026 18:10 | 4 | 12,373.18 · 17.61 · 217,881.02 | 29,843.91 |
| 130217 (VENTANAS) | 13/10/2026 23:29 | 4 | 12,373.18 · 17.61 · 217,881.02 | 28,663.29 |

Two things worth keeping: 129220 and 130216 now show **different** VENTANAS figures
(13,541.39 vs 12,373.18), because each report takes branch 1's last closing at or
before its own period end — that is the point of the report, not an inconsistency.
And 130217 did **not** grow a duplicate row, because the selected closing is
already branch 1's last one and `UNION` collapses the identical `(IdLocal, Fecha)`
pair. Including the branch and deduplicating are complementary fixes.

### Totals block (D20)

`components/shared/totales-maiz.tsx` is now the only place that renders the three
figures, and both maize reports use it. Measured in the browser at 390px: the
stacked-cards version occupied **330px**; the compact card occupies **119px** and
keeps stock, price and inversion visible above the table. At 1280px the three
labelled cards are back.

The section's own mobile footer (`dl` with the same three totals) was removed: it
duplicated the cards, so only the desktop `<tfoot>` row remains inside the table.
The card label reads `INVERSIÓN`, matching the table column, instead of the
unaccented `INVERSION` the recalculating report used. Verified in both screens:
`STOCK`, `PRECIO`, `INVERSIÓN` visible.

### Files

```
app/(main)/reporte-maiz/
  page.tsx                                  server component, searchParams gating
  _actions/index.ts                         buscarCierres + cargarReporteMaiz ("use server")
  _components/cierre-selector.tsx           client, ?idCierre= navigation
  _components/inventario-maiz-section.tsx   server, phone blocks + md table + footer
  _lib/tipos.ts                             serializable DTOs
  _lib/datos/consultas.ts                    the three queries, verbatim
  _lib/datos/mapeadores.ts                   aNumero, anomalies, totals, gating
  _lib/datos/mapeadores.test.ts              22 tests
  _lib/datos/consultas.test.ts               10 SQL-contract tests
components/shared/busqueda-cierre-dialog.tsx  350 ms debounce, last-wins
components/shared/totales-maiz.tsx           stock / precio / inversión, shared
lib/fmt.ts                                  + fmtFechaUtc / fmtFechaHoraUtc (UTC)
app/(main)/reportes/page.tsx                + "Reporte Maíz por Cierre" card
```

### Checks

| Check | Result |
| --- | --- |
| `pnpm test` | 12 files, **146 tests** green (33 new) |
| `npx tsc --noEmit` | clean |
| `pnpm lint` | no findings in the new files (the repo was already red on `report-table`, `use-excel-navigation` and `cs-decimal`) |
| `pnpm build` | green, `ƒ /reporte-maiz` in the route table |
| Unauthenticated | `/reporte-maiz` and `/reporte-maiz?idCierre=…` → `302 /login?callbackUrl=…` |
| Authenticated (browser) | full flow green at 390px and 1280px |

### Live database verification (temporary script, deleted)

Real mappers, real queries, production data:

```
búsqueda local 3 (VINCES): 1622 cierres; "09/2025" → 26; primera opción = IdCierre 129220
cabecera 130216: ANAF · 2026-10-13T21:40 → 2026-10-14T18:10 · PECHICHE
maíz: MAIZ PALENQUE 783.17 / MAIZ PECHICHE 961.43 ×2 / MAIZ VINCES 15726.13
totales: stock 18,432.16 · precio 17.08 · inversión 314,769.05
valores en formato no parseable: 0
```

**The duplicate was real and it was B-1, not B-8.** Cierre 130216 has exactly one
`MAIZ` row in `Cierre_Producto`, but the diagnostic query of §6.2 showed the date
`2026-10-14T18:10:28.907Z` **twice** in the CTE `A`, and the section returned that
branch twice. Because the selected closing is usually the last closing of its own
branch, the duplication appeared in nearly every real case. Fixed per D18.

Second live finding: a local has **1622** closings, and the documented search has
no `TOP`, so opening the dialog renders 1622 rows into a `max-h-72` box. Faithful
to the document, but on a 390px phone it is a real cost. Fix is one line
(`TOP 50` or a paged endpoint) and needs a product decision, not silence.

### Not verified

The printed page (`@media print`): the section keeps `print:break-before-page` and
`break-inside-avoid` rows, but no PDF was produced.

