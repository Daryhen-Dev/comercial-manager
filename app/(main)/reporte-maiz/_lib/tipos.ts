/**
 * Shapes that cross the Server Component / Client Component boundary.
 *
 * Everything here is JSON-safe on purpose: dates travel as ISO strings and the
 * numbers are already numbers, so no `Date` and no `CsDecimal`-like wrapper ever
 * reaches the client. The presentation layer owns the formatting.
 */

/** One selectable closing, as the search dialog needs it. */
export type CierreOption = {
  idCierre: number;
  fechaInicial: string | null;
  fecha: string | null;
};

/** The header of the accounting closing the selected `idCierre` points to. */
export type CabeceraCierre = {
  usuario: string | null;
  sucursal: string | null;
  fechaInicial: string | null;
  fechaFinal: string | null;
};

/**
 * One `MAIZ` row of one closing. `idCierre` is not unique in this payload: the
 * legacy query can return the same closing twice (documented risk B-1), so the
 * React key must include the position.
 */
export type FilaInventarioMaiz = {
  idCierre: number;
  producto: string;
  stock: number;
  precio: number;
  inversion: number;
  utilidadQQ: number;
  utilidadTotal: number;
};

/**
 * The footer. There is deliberately no total for the two utility columns: the
 * total utility is already an accumulated figure, so summing it across branches
 * is not meaningful.
 */
export type TotalesInventarioMaiz = {
  stock: number;
  precio: number;
  inversion: number;
};

/**
 * `sin-cierre`   → no usable `?idCierre` in the URL.
 * `sin-cabecera` → the `idCierre` exists but `Conta_Cierre_Caja` has no row for it
 *                  (or no `fechaFinal`), so the section cannot be built.
 */
export type ResultadoReporteMaiz =
  | { status: "error"; error: string }
  | { status: "sin-cierre" }
  | { status: "sin-cabecera"; idCierre: number }
  | {
      status: "ok";
      idCierre: number;
      cabecera: CabeceraCierre;
      filas: FilaInventarioMaiz[];
      totales: TotalesInventarioMaiz;
    };
