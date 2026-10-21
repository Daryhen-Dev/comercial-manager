import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * The SQL is the contract here: this report is a read-only window onto data
 * another system writes, so the guard is textual. The file is read instead of
 * imported because `consultas.ts` pulls `@/lib/db`, which needs a live connection
 * string at import time. Comments are stripped first, so the guards test the
 * query and not the prose that explains it.
 */
const fuente = readFileSync(new URL("./consultas.ts", import.meta.url), "utf8");
const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("búsqueda de cierres (A.1)", () => {
  it("filtra por la sucursal y busca sobre dd/mm/yyyy", () => {
    expect(codigo).toContain("WHERE C.IdLocal = ${idLocal}");
    expect(codigo).toContain("CONVERT(NVARCHAR, C.Fecha, 103)");
    expect(codigo).toContain("LIKE '%' + ${query} + '%'");
  });

  it("ordena por fecha descendente y no recorta con TOP", () => {
    expect(codigo).toContain("ORDER BY C.Fecha DESC");
    expect(codigo).not.toMatch(/SELECT TOP \d+ C\.IdCierre, C\.FechaInicial/);
  });
});

describe("cabecera del cierre contable (A.2)", () => {
  it("llega al cierre por IdCierreProducto", () => {
    expect(codigo).toContain("WHERE CCC.IdCierreProducto = ${idCierre}");
  });

  it("resuelve una sola fila de forma determinista", () => {
    expect(codigo).toContain("SELECT TOP 1 U.NombreUsuario");
    expect(codigo).toContain("ORDER BY CCC.IdCierre ASC");
  });

  it("no oculta la cabecera cuando el cierre no tiene usuario (desvío D5)", () => {
    expect(codigo).toContain("LEFT JOIN Usuario U");
    expect(codigo).not.toContain("INNER JOIN Usuario U");
  });
});

describe("inventario de maíz (A.3)", () => {
  it("incluye la sucursal 1 en el último cierre por sucursal (corrección D19)", () => {
    // El legacy excluía la sucursal 1 del CTE: VENTANAS solo aparecía si su
    // propio cierre era el seleccionado (documento, B-3).
    expect(codigo).not.toContain("IdLocal != 1");
    expect(codigo).toContain("WHERE C.Fecha <= ${fechaFinal}");
    expect(codigo).toContain("GROUP BY C.IdLocal");
  });

  it("suma el cierre seleccionado sin condiciones, deduplicando por (IdLocal, Fecha)", () => {
    // `UNION`, no `UNION ALL`: es el arreglo que el documento recomienda para B-1.
    expect(codigo).toContain("\n  UNION\n");
    expect(codigo).not.toContain("UNION ALL");
    expect(codigo).toContain("WHERE C.IdCierre = ${idCierre}");
  });

  it("filtra el producto exacto MAIZ", () => {
    expect(codigo).toContain("WHERE P.Descripcion = 'MAIZ'");
  });

  it("junta por fecha completa, sin normalizar ni sumar la sucursal (riesgo B-2)", () => {
    expect(codigo).toContain("C.Fecha <= ${fechaFinal}");
    expect(codigo).toContain("FROM A INNER JOIN B ON A.Fecha = B.Fecha");
    expect(codigo).not.toContain("A.IdLocal = B.IdLocal");
  });

  it("compone el nombre del producto y ordena alfabéticamente", () => {
    expect(codigo).toContain("P.Descripcion + ' ' + L.[Local] Producto");
    expect(codigo).toContain("ORDER BY B.Producto ASC");
  });

  it("trae las cinco columnas guardadas y ninguna calculada", () => {
    for (const columna of [
      "CP.Cantidad stock",
      "CP.Precio precio",
      "CP.Inversion inversion",
      "CP.UtilidadQQ",
      "CP.UtilidadTotal",
    ]) {
      expect(codigo, columna).toContain(columna);
    }
  });
});
