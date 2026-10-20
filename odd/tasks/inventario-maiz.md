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
- [ ] Insumo queries (7 + conditional 8th).
- [ ] Calculation engine and totals.
- [ ] Grid projection.
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
