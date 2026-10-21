import { db } from "@/lib/db";

/**
 * The three queries of `Documentacion-Cierre-Pdf-Seleccion-Inventario-Maiz.md`
 * (§4.3, §4.7.3, §5.3), kept verbatim **except** for two deliberate corrections
 * to the CTE of `traerInventarioMaiz`: `UNION` instead of the legacy
 * `UNION ALL`, and branch 1 participates like every other branch.
 *
 * `UNION` — the fix the document recommends for B-1. When the selected closing
 * is the last closing of its own branch (the normal case) its date entered `A`
 * twice, the join produced the branch row twice and the footer counted it twice.
 * Verified live on closing 129220 (`MAIZ VINCES` twice, total 32,016.24 instead
 * of 16,290.11). `UNION` dedupes the `(IdLocal, Fecha)` pair, so two branches
 * that closed at the same instant still both enter.
 *
 * Branch 1 — the legacy hardcodes `C.IdLocal != 1` in the "last closing per
 * branch" arm, so VENTANAS only appeared when its own closing was the selected
 * one (document, B-3: "confirmar con negocio si debe participar siempre"). It
 * participates: the report is a per-branch inventory and branch 1 is a branch
 * with 1,712 closings, the longest history in the table.
 *
 * B-2 (join by date only, not by branch) is left as the legacy has it.
 */

export type RawCierreBusqueda = {
  IdCierre: number;
  FechaInicial: Date | null;
  Fecha: Date | null;
};

/** `A.1` — closings of one branch, filtered by the `dd/mm/yyyy` rendering. */
export async function buscarCierresPorSucursal(
  idLocal: number,
  query: string,
): Promise<RawCierreBusqueda[]> {
  return db.$queryRaw<RawCierreBusqueda[]>`
SELECT C.IdCierre, C.FechaInicial, C.Fecha
FROM Cierre C
WHERE C.IdLocal = ${idLocal}
  AND CONVERT(NVARCHAR, C.Fecha, 103) LIKE '%' + ${query} + '%'
ORDER BY C.Fecha DESC`;
}

export type RawCabeceraCierre = {
  USUARIO: string | null;
  fechaInicial: Date | null;
  fechaFinal: Date | null;
  saldoAnterior: unknown;
  saldoNuevo: unknown;
  sucursal: string | null;
};

/**
 * `A.2` — the accounting header of the selected `idCierre`
 * (`= Conta_Cierre_Caja.IdCierreProducto`).
 *
 * Deviation from the legacy (decision D5): `Usuario` is a `LEFT JOIN`, because
 * this row is only needed for `fechaFinal` and a closing saved with `IdUser`
 * NULL must not hide the section. `TOP 1 ... ORDER BY IdCierre ASC` (D6) makes
 * the arbitrary "first row" of the legacy reader deterministic.
 */
export async function traerCabeceraCierre(
  idCierre: number,
): Promise<RawCabeceraCierre | null> {
  const filas = await db.$queryRaw<RawCabeceraCierre[]>`
SELECT TOP 1 U.NombreUsuario AS USUARIO,
       CCC.fechaInicial,
       CCC.fechaFinal,
       CCC.saldoAnterior,
       CCC.saldoNuevo,
       L.[Local] AS sucursal
FROM Conta_Cierre_Caja CCC
LEFT JOIN Usuario U ON CCC.IdUser  = U.IDUsuario
LEFT  JOIN [Local]  L ON CCC.IdLocal = L.IDLocal
WHERE CCC.IdCierreProducto = ${idCierre}
ORDER BY CCC.IdCierre ASC`;

  return filas[0] ?? null;
}

export type RawInventarioMaiz = {
  IdCierre: number;
  Producto: string | null;
  stock: string | null;
  precio: string | null;
  inversion: string | null;
  UtilidadQQ: string | null;
  UtilidadTotal: string | null;
  Fecha: Date | null;
};

/**
 * `A.3` — the section query. `B.Fecha` is selected but never mapped or shown,
 * exactly as in the legacy.
 *
 * `@fechaFinal` is bound untruncated: `C.Fecha <= @fechaFinal` and
 * `A.Fecha = B.Fecha` compare date and time at full precision, and normalising
 * here would change the result set (documented edge case B-5).
 */
export async function traerInventarioMaiz(
  fechaFinal: Date,
  idCierre: number,
): Promise<RawInventarioMaiz[]> {
  return db.$queryRaw<RawInventarioMaiz[]>`
WITH A AS (
  SELECT C.IdLocal, MAX(C.Fecha) Fecha
  FROM Cierre C
  WHERE C.Fecha <= ${fechaFinal}
  GROUP BY C.IdLocal
  UNION
  SELECT C.IdLocal, C.Fecha
  FROM Cierre C
  WHERE C.IdCierre = ${idCierre}
), B AS (
  SELECT CP.IdCierre, P.Descripcion + ' ' + L.[Local] Producto,
         CP.Cantidad stock, CP.Precio precio, CP.Inversion inversion,
         CP.UtilidadQQ, CP.UtilidadTotal, C.Fecha
  FROM Cierre_Producto CP
  INNER JOIN Producto P ON CP.IDProducto = P.IDProducto
  INNER JOIN Cierre C ON CP.IdCierre = C.IdCierre
  INNER JOIN [Local] L ON P.IDLocal = L.IDLocal
  WHERE P.Descripcion = 'MAIZ'
)
SELECT B.IdCierre, B.Producto, B.stock, B.precio, B.inversion,
       B.UtilidadQQ, B.UtilidadTotal, B.Fecha
FROM A INNER JOIN B ON A.Fecha = B.Fecha
ORDER BY B.Producto ASC`;
}
