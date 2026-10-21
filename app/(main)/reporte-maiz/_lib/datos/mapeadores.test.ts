import { describe, expect, it } from "vitest";

import {
  aNumero,
  calcularTotales,
  esNumeracionAnomala,
  mapearCabecera,
  mapearCierreBusqueda,
  mapearFilaMaiz,
  mapearInventarioMaiz,
  resolverIdCierre,
} from "./mapeadores";
import type { RawInventarioMaiz } from "./consultas";

const fila = (extra: Partial<RawInventarioMaiz> = {}): RawInventarioMaiz => ({
  IdCierre: 1234,
  Producto: "MAIZ VENTANAS",
  stock: "100",
  precio: "10",
  inversion: "1000",
  UtilidadQQ: "0.5",
  UtilidadTotal: "50",
  Fecha: new Date("2025-09-30T18:30:00.000Z"),
  ...extra,
});

describe("aNumero — el parser documentado (§5.4)", () => {
  it("trata null, undefined y vacío como cero", () => {
    expect(aNumero(null)).toBe(0);
    expect(aNumero(undefined)).toBe(0);
    expect(aNumero("")).toBe(0);
  });

  it("lee el formato inglés con coma de miles y punto decimal", () => {
    expect(aNumero("1,234.56")).toBe(1234.56);
    expect(aNumero("1 234.56")).toBe(1234.56);
    expect(aNumero("1234.56")).toBe(1234.56);
    expect(aNumero("12,345,678.90")).toBe(12345678.9);
  });

  it("convierte basura en cero en silencio, como el legacy", () => {
    expect(aNumero("abc")).toBe(0);
    expect(aNumero("1.234.567,89")).toBe(0);
  });

  it("reproduce la trampa de la coma decimal, que NO es cero", () => {
    // El documento afirma que "1.234,56" cae en 0. No cae: queda finito y mal.
    expect(aNumero("1.234,56")).toBeCloseTo(1.23456, 10);
    expect(aNumero("1234,56")).toBe(123456);
  });

  it("acepta un número ya numérico sin tocarlo", () => {
    expect(aNumero(1234.5)).toBe(1234.5);
  });
});

describe("esNumeracionAnomala — la red que el documento pide agregar", () => {
  it("no marca el formato esperado", () => {
    for (const valor of ["1234.56", "1,234.56", "12,345,678.90", "1 234.56", "0", "-12.5"]) {
      expect(esNumeracionAnomala(valor), valor).toBe(false);
    }
    expect(esNumeracionAnomala(null)).toBe(false);
    expect(esNumeracionAnomala("")).toBe(false);
  });

  it("marca la coma decimal y el texto que no es número", () => {
    for (const valor of ["1234,56", "1.234,56", "1.234.567,89", "abc"]) {
      expect(esNumeracionAnomala(valor), valor).toBe(true);
    }
  });
});

describe("mapearFilaMaiz", () => {
  it("convierte los cinco campos de texto a número", () => {
    expect(mapearFilaMaiz(fila())).toEqual({
      idCierre: 1234,
      producto: "MAIZ VENTANAS",
      stock: 100,
      precio: 10,
      inversion: 1000,
      utilidadQQ: 0.5,
      utilidadTotal: 50,
    });
  });

  it("deja el producto vacío cuando el Local es NULL (riesgo B-7)", () => {
    expect(mapearFilaMaiz(fila({ Producto: null })).producto).toBe("");
  });

  it("cae en cero con los campos NULL", () => {
    const mapeada = mapearFilaMaiz(
      fila({
        stock: null,
        precio: null,
        inversion: null,
        UtilidadQQ: null,
        UtilidadTotal: null,
      }),
    );
    expect([mapeada.stock, mapeada.precio, mapeada.inversion]).toEqual([0, 0, 0]);
    expect([mapeada.utilidadQQ, mapeada.utilidadTotal]).toEqual([0, 0]);
  });

  it("no arrastra la fecha: el DTO no la expone", () => {
    expect(Object.keys(mapearFilaMaiz(fila()))).not.toContain("fecha");
  });
});

describe("mapearInventarioMaiz — anomalías registradas", () => {
  it("no reporta nada cuando todas las filas están en formato inglés", () => {
    expect(mapearInventarioMaiz([fila(), fila({ IdCierre: 99 })]).anomalias).toEqual([]);
  });

  it("nombra el campo, el valor, el cierre y el producto", () => {
    const { anomalias } = mapearInventarioMaiz([fila({ stock: "1.234,56" })]);
    expect(anomalias).toEqual([
      'Cantidad="1.234,56" en el cierre 1234 (MAIZ VENTANAS)',
    ]);
  });

  it("acumula varias anomalías de la misma fila", () => {
    const { anomalias } = mapearInventarioMaiz([
      fila({ stock: "1.234,56", UtilidadTotal: "1.234.567,89" }),
    ]);
    expect(anomalias).toHaveLength(2);
    expect(anomalias[1]).toContain('UtilidadTotal="1.234.567,89"');
  });

  it("conserva el valor mapeado aunque esté en formato raro", () => {
    const { filas } = mapearInventarioMaiz([fila({ stock: "1234,56" })]);
    expect(filas[0].stock).toBe(123456);
  });
});

describe("calcularTotales — el pie (§5.5.1)", () => {
  const a = mapearFilaMaiz(fila({ stock: "100", inversion: "1000" }));
  const b = mapearFilaMaiz(fila({ IdCierre: 77, stock: "100", inversion: "3000" }));

  it("suma stock e inversión y promedia el precio ponderado", () => {
    expect(calcularTotales([a, b])).toEqual({ stock: 200, precio: 20, inversion: 4000 });
  });

  it("usa el promedio ponderado, no el promedio simple de precios", () => {
    const barato = mapearFilaMaiz(fila({ stock: "900", precio: "1", inversion: "900" }));
    const caro = mapearFilaMaiz(fila({ stock: "100", precio: "50", inversion: "5000" }));
    // (900+5000)/(900+100) = 5.90, no (1+50)/2 = 25.5
    expect(calcularTotales([barato, caro]).precio).toBeCloseTo(5.9, 10);
  });

  it("devuelve precio 0 cuando no hay stock", () => {
    const sinStock = mapearFilaMaiz(fila({ stock: "0", inversion: "0" }));
    expect(calcularTotales([sinStock])).toEqual({ stock: 0, precio: 0, inversion: 0 });
  });

  it("devuelve precio 0 cuando el stock neto es 0 aunque haya inversión", () => {
    const raro = mapearFilaMaiz(fila({ stock: "0", inversion: "500" }));
    expect(calcularTotales([raro])).toEqual({ stock: 0, precio: 0, inversion: 500 });
  });

  it("no totaliza utilidades: las claves del pie son tres", () => {
    expect(Object.keys(calcularTotales([a, b]))).toEqual(["stock", "precio", "inversion"]);
  });

  it("con la lista vacía devuelve ceros", () => {
    expect(calcularTotales([])).toEqual({ stock: 0, precio: 0, inversion: 0 });
  });

  it("suma las filas que recibe, sin deduplicar por su cuenta", () => {
    // La consulta ya deduplica (UNION); si alguna vez llega una fila repetida
    // —riesgo B-8, dos MAIZ en el mismo cierre— el pie la suma y no la esconde.
    expect(calcularTotales([a, a])).toEqual({ stock: 200, precio: 10, inversion: 2000 });
  });
});

describe("resolverIdCierre — el gating de ?idCierre", () => {
  it("acepta un entero positivo", () => {
    expect(resolverIdCierre("1234")).toBe(1234);
    expect(resolverIdCierre(" 7 ")).toBe(7);
  });

  it("rechaza los degenerados del documento", () => {
    expect(resolverIdCierre(undefined)).toBeNull();
    expect(resolverIdCierre("abc")).toBeNull();
    expect(resolverIdCierre("0")).toBeNull();
  });

  it("rechaza decimales y negativos, que el Number() del legacy dejaba pasar", () => {
    expect(resolverIdCierre("12.5")).toBeNull();
    expect(resolverIdCierre("-3")).toBeNull();
  });

  it("rechaza un parámetro repetido en la URL", () => {
    expect(resolverIdCierre(["1", "2"])).toBeNull();
  });
});

describe("mapeadores de la cabecera y del buscador", () => {
  it("serializa las fechas a ISO y conserva los NULL", () => {
    expect(
      mapearCierreBusqueda({
        IdCierre: 9,
        FechaInicial: new Date("2025-09-01T08:00:00.000Z"),
        Fecha: null,
      }),
    ).toEqual({
      idCierre: 9,
      fechaInicial: "2025-09-01T08:00:00.000Z",
      fecha: null,
    });
  });

  it("mapea la cabecera sin inventar valores", () => {
    expect(
      mapearCabecera({
        USUARIO: null,
        fechaInicial: new Date("2025-09-01T08:00:00.000Z"),
        fechaFinal: new Date("2025-09-30T18:30:00.000Z"),
        saldoAnterior: null,
        saldoNuevo: null,
        sucursal: "VENTANAS",
      }),
    ).toEqual({
      usuario: null,
      sucursal: "VENTANAS",
      fechaInicial: "2025-09-01T08:00:00.000Z",
      fechaFinal: "2025-09-30T18:30:00.000Z",
    });
  });
});
