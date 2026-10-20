import { describe, expect, it } from "vitest";

import { CsDecimal } from "@/lib/cs-decimal/cs-decimal";

import {
  mapearCompraBascula,
  mapearCompraRomana,
  mapearEmboAnti,
  mapearVenta,
} from "./mapeadores-insumos";

const fecha = new Date("2026-10-14T09:00:00.000Z");

const filaCompra = {
  IDBoletoDetalle: 10,
  PRODUCTO: "MAIZ",
  HUMEDAD: "13.5",
  IMPUREZA: "0.5",
  QQBRUTO: "1000.00",
  NETO: "980.0000",
  MERMA: "20.00",
  FECHA: fecha,
  PRECIO: "17.60",
  VTOTAL: "17248.00",
  RETEN: "0.00",
  EFECTIVO: "1000.00",
  CHEQUE: "0",
  TRANSFERENCIA: "0",
  PENDIENTE: "0.00",
  COMISION: "0",
};

describe("mapearCompraBascula", () => {
  it("fuerza anticipo cero porque la consulta no lo trae", () => {
    const c = mapearCompraBascula({ ...filaCompra, PORCEN: "1.20" });
    expect(c.anticipo.eq(CsDecimal.ZERO)).toBe(true);
    expect(c.porcen.toString()).toBe("1.20");
    expect(c.fecha).toBe(fecha);
  });

  it("conserva la escala de los textos", () => {
    expect(mapearCompraBascula({ ...filaCompra, PORCEN: "0" }).qqNeto.toString()).toBe("980.0000");
  });
});

describe("mapearCompraRomana", () => {
  it("lee PORCENTAJE y ANTICIPO, que báscula no trae", () => {
    const c = mapearCompraRomana({
      ...filaCompra,
      PORCENTAJE: "2.50",
      ANTICIPO: "150.00",
    });
    expect(c.porcen.toString()).toBe("2.50");
    expect(c.anticipo.toString()).toBe("150.00");
  });
});

describe("mapearVenta", () => {
  it("mapea DEPOSITO y RETEN", () => {
    const v = mapearVenta({
      IDBoletoDetalle: 99,
      PRODUCTO: "MAIZ",
      HUMEDAD: "13",
      IMPUREZA: "1",
      QQBRUTO: "500.5",
      NETO: "495.0",
      FECHA: fecha,
      PRECIO: "17",
      VTOTAL: "8415",
      RETEN: "12.30",
      EFECTIVO: "100",
      CHEQUE: "200",
      DEPOSITO: "8115.00",
      PENDIENTE: "0",
    });
    expect(v.deposito.toString()).toBe("8115.00");
    expect(v.retencion.toString()).toBe("12.30");
    expect(v.qqNeto.toString()).toBe("495.0");
  });
});

describe("mapearEmboAnti", () => {
  it("sin filas deja ambos en cero", () => {
    const e = mapearEmboAnti([]);
    expect(e.anticipo.eq(CsDecimal.ZERO)).toBe(true);
    expect(e.embo.eq(CsDecimal.ZERO)).toBe(true);
  });

  it("la última fila gana", () => {
    const e = mapearEmboAnti([
      { ANTICIPO: "1.00", EMBO: "2.00" },
      { ANTICIPO: "10.50", EMBO: "0" },
    ]);
    expect(e.anticipo.toString()).toBe("10.50");
    expect(e.embo.toString()).toBe("0");
  });
});
