# Inventario Maíz

## Goal

Read-only report at `/reportes/cierre/inventario-maiz` showing corn stock for every
branch (except `IDLocal = 2`), each branch computed from its own last closing:
three totals (STOCK / PRECIO / INVERSION) plus a grid with six detail rows per
product that moved today and one summary row per product that did not.

## Context discovered during exploration

The spec (`Documentacion-Inventario-Maiz.md`, 2801 lines) is larger and heavier
than the Kardex one. Verified against this repo before planning:

| Check | Result |
| --- | --- |
| `Cierre`, `Producto`, `Local` tables | exist |
| `Cierre_Producto_Operacion_{Compra,Venta}_{Bascula,Romana,General,Bodeguita}` | all six exist |
| `Producto.HumedadSeco / MermaAgua / ServBasico / Precio / PrecioMinimo / PrecioMaximo` | exist, as `NVarChar(50)` |
| `lib/cs-decimal` | **does not exist** — the document requires it in 29 places |
| `/reportes` hub page with the entry card | **does not exist** |
| Distinct SQL queries specified | **14** |

So the database side is compatible: the documented `FillByMaiz` query runs
unchanged. What is missing is our own infrastructure.

### What the module actually contains

- 14 SQL queries (branches, products per branch, closing date per branch, 2
  validations per product, 8 insumo queries per product).
- A calculation engine (§8, ~350 lines): purchase of the day → sale of the day →
  `pasarValoresACV`.
- A grid projection (§10, 199 lines) with two passes, six detail rows and a
  summary row.
- Four test suites as acceptance criteria (§15.2).
- A blocking flow with two states (negative inventory, documents pending) and a
  missing-documents dialog.
- A query cost of `1 + 2L + 2P + 7P + E` per load — roughly 51 queries in the
  documented smoke case, and no cache.

## Decisions

- **Role gate uses `UsuarioRolId === 1`**, not `RolUsuario === "ADMINISTRADOR"` as
  the document does. `RolUsuario` is the display name in this system and is not
  authoritative (same decision already applied to the Kardex and to `(main)`).
- The gate returns a typed error like the document does, and never throws, but it
  also runs on the page (`redirect`) so an unauthorised user never starts the
  query storm.
- **Nothing is written**: no closing save, no signed snapshot, no master key.

## Open decision (blocking the engine)

The document requires `lib/cs-decimal`, a BigInt emulation of .NET
`System.Decimal`, validated against a .NET oracle fixture. Without it the
arithmetic is not bit-identical to the legacy: `number` is exact for additions of
two-decimal values in this range, but division and rounding can differ in the last
cent on edge cases.

## Plan

1. `lib/cs-decimal` (or the accepted alternative) — the arithmetic foundation.
2. Data layer: the 14 queries, typed and mapped.
3. Calculation engine + totals.
4. Grid projection.
5. `/reportes` hub with the entry card, the route and the client screen.
6. Tests for the four suites defined in §15.2.

## Tasks

- [x] Decide arithmetic strategy → exact (`cs-decimal`).
- [x] `lib/cs-decimal` implemented and tested.
- [x] Queries: branches, products, closing date, validations (level 1).
- [x] Insumo queries (7 + conditional 8th).
- [x] Calculation engine and totals.
- [x] Grid projection.
- [ ] `/reportes` hub and route.
- [ ] Client screen (cards, grid, blocks, error).
- [ ] Tests.

## Evidence

### Phase 1 — `lib/cs-decimal` (done)

`lib/cs-decimal/cs-decimal.ts` implements the documented contract: sign + BigInt
mantissa (< 2^96) + scale (≤ 28), `parse` preserving the written scale, `add`/`sub`
aligned to the maximum scale, `mul` with .NET's `VarDecMul` zero rule, long
division to scale 28 with trailing-zero normalisation for inexact quotients,
`cmp`/`eq`/`lt`, `toString` printing every scale digit, `format("N2"|"F"|"0.##"|
"0.####")`, `truncateToScale` and `roundToScale`.

Two distinct rounding rules are kept apart on purpose: mantissa reduction uses
**half-to-even**, formatting uses **half-away-from-zero** over the exact magnitude.

`lib/cs-decimal/cs-decimal.test.ts` — 22 cases, all hand-computed because the
.NET oracle fixture from the reference repo is not available here. `pnpm test`
reports 2 files / 37 tests passing (15 Kardex + 22 here).

`BigInt` requires `"target": "ES2022"` in `tsconfig.json` (it was `ES2017`). The
change is a prerequisite of this library, not a preference.

Note for future work: a stale `.next` keeps serving cached TypeScript
diagnostics. After a `tsconfig.json` change, `rm -rf .next` before believing a
build failure — several errors reported after the fix were never real.

### Phase 2 — level-1 load (done)

`_lib/datos/{contextos,errores,tipos,consultas,mapeadores}.ts` and
`_lib/cargar-vista.ts` implement the documented level-1 pipeline with the SQL
verbatim: branches excluding `IDLocal = 2`, `FillByMaiz` per branch, the closing
date per branch, and the two validation queries per product.

13 tests (`mapeadores.test.ts`) cover the mapper contract: scale preservation,
the forced normal branch (`mmEstado=false`, MM zeros), the legacy `predioDia`
spelling, the uppercase `SUCURSAL` alias that was a real bug in the reference
port, `CargaCierreSinCierrePrevio` deliberately NOT being a `CargaCierreError`,
and the column helpers rejecting NULL and wrong types.

**Verified against the live database** with a temporary script (deleted): 7
branches (all but 2), 4 of them with MAIZ, closing date for local 1
`2026-10-13`, and a product row carrying `stock = "12373.17750800"` and
`stockPrecio` with 27 decimals — which is exactly why `CsDecimal.parse` is
required: Prisma would have returned those as `decimal.js` and lost the scale.

**Real finding:** local 1 currently has **1 pending sale**, so
`estadoFaltantes` is true and the report would be blocked with "ERROR, Compras o
ventas por liquidar." That is inherited behaviour, not a bug.

### Phase 5 — grid projection (done)

`_lib/grilla/` holds the 18-column metadata, the style constants and
`proyectarInventarioAdmin`: two passes over all products, first those with
movement (`COMPRA.qqBruto != 0 || VENTA.qqBruto != 0`, the gross quintales), then
the rest. A product with movement renders 9 rows, one without renders 3. Every
row always carries 18 cells, `celdasLegacy` records how many values the legacy
passed, and no row writes cells 16/17.

The legacy formatting quirk is preserved: the purchase's `efectivo` uses `F` (no
thousands separator) while every other numeric cell uses `N2`. 13 tests.

`_lib/tipos-dto.ts` defines the serializable `ResultadoInventarioMaiz` and
`aFilaFaltante`, which turns the pending documents' `Date` into ISO strings; no
`CsDecimal` and no `Date` crosses to the client.

### End-to-end run against the live database

The real mappers, engine and projection were run over the production data, with
the SQL extracted from the source files (no query duplicated):

```
sucursales 7 · productos MAIZ 4
estadoInventario false · estadoFaltantes TRUE (compras 0, ventas 1)
filas de grilla 24   (2 con movimiento × 9 + 2 sin movimiento × 3)

MAIZ VENTANAS  ANTERIOR 12,373.18 / 17.61 / 217,881.02
               COMPRA   573.93 · 449.60 · 13.41 · 8.97 · 656.60 · 7,693.71
               VENTA    202.82 · 202.82 · 18.00 · 3,650.76
               STOCK    12,619.96 / 17.59 / 222,006.78
               UTILIDAD 0.41 / 82.81
MAIZ PECHICHE  STOCK: 961.43 · PRECIO: 16.99 · INVERSION: 16,330.48
RESUMEN        stock 32,251.96 · precio 17.29 · inversion 557,790.68
```

That is exactly what the report would display once the pending sale is
liquidated; today the block wins, as designed.

### Phase 3 — calculation engine and totals (done)

`_lib/motor/` reproduces the three documented steps with `CsDecimal`:
`comun.ts` (`oCero` / `divOCero` / `CierreCalculoError` / `envolver`),
`compra-del-dia.ts`, `venta-del-dia.ts`, `inventario.ts` (the six rows and
`inventarioNuevo`) and `calcular-producto.ts` wrapping each step so a failure
names the product and the step. `sesion/mapeo-dto.ts` holds `resumirMaiz`, and
`calcular-vista.ts` applies the block precedence.

The legacy quirks are copied on purpose: the purchase's `porcentajeTotal` only
short-circuits when BOTH merma and qqBruto are zero, so a division by zero
propagates (B-9); sales use the fixed humidity literal `13`, not
`Producto.HumedadSeco` (B-20); `utilidadTotal` is computed outside the legacy
try, so it can overflow; and `resumirMaiz` catches any error into a zero price.

**Verified against the specification's own worked example (§8.7)**: precioDelDia
`15.010`, COMPRA efectivo `1020` (1000 + 20 commission), STOCK `100 / 10 / 1000`,
UTILIDAD `2 / 200`, and the summary `"100.00" / "10.00" / "1,000.00"`. The
two-product example gives `1,780.00 / 78,000.00 / 43.82`. The three documented
error cases are covered too, including which step fails.

13 tests. Total: 5 files, 69 tests.

### Phase 4 — level-2 insumos (done)

`_lib/datos/consultas-insumos.ts` holds the eight queries verbatim (báscula,
romana and general purchases; embo/anticipo; embodegado; báscula, bodeguita and
general sales), every numeric output wrapped in `CONVERT(NVARCHAR(100), ...)` so
the scale survives. `cargar-insumos.ts` reproduces the two `Promise.all` batches
and the conditional eighth query, and concatenates
báscula ++ romana ++ general and báscula ++ bodeguita ++ general.

`mapeadores-insumos.ts` maps them; the báscula purchase forces `anticipo = 0`
because that query does not select it, and the embo/anticipo mapper keeps
last-row-wins.

**All eight verified against the live database** by extracting the templates from
the source file and running them (temporary script, deleted) for product 1 since
its closing date: 6 báscula purchases, 1 romana, 0 general, 0 embodegado, 1
báscula sale, 0 bodeguita, 0 general. That validated every table, column and
alias without duplicating a line of SQL in the test harness.

7 more mapper tests. Total: 4 files, 56 tests.

### Phase 0 — schema compatibility (done)

Verified by reading `prisma/schema.prisma` against the SQL in §5.2: `Cierre`,
`Producto` (with `HumedadSeco`, `MermaAgua`, `ServBasico`, `Precio`,
`PrecioMinimo`, `PrecioMaximo` as `NVarChar`) and the six
`Cierre_Producto_Operacion_*` tables all exist, so the documented queries are
runnable here.

## Open items

- The document's `a confirmar` list (§16) is inherited.
- The calculation engine is financial: a wrong number is worse than a missing
  screen, so it is implemented and verified against the live database before the
  UI is wired, not after.
