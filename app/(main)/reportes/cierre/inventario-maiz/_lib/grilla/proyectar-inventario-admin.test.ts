import { describe, expect, it } from "vitest";

import { CsDecimal } from "@/lib/cs-decimal/cs-decimal";

import type { DatoProducto } from "../datos/tipos";
import type { DatoCompraConjunto, DatoVentaConjunto } from "../datos/tipos-insumos";
import { calcularProducto } from "../motor/calcular-producto";
import { proyectarInventarioAdmin } from "./proyectar-inventario-admin";
import type { EntradaGrilla } from "./tipos";

const d = (s: string) => CsDecimal.parse(s);
const emboAnti = { anticipo: d("0"), embo: d("0") };

function producto(overrides: Partial<DatoProducto> = {}): DatoProducto {
  return {
    idProducto: 1,
    idLocal: 1,
    sucursal: "VENTANAS",
    producto: "MAIZ",
    humedadSeco: d("13"),
    mermaAgua: d("0.5"),
    servBasico: d("0.02"),
    precio: d("0"),
    precioMinimo: d("0"),
    precioMaximo: d("0"),
    mmEstado: false,
    mmHumeSeco: d("0"),
    mmMermaAgua: d("0"),
    mmServiBasico: d("0"),
    mmPrecio: d("0"),
    stock: d("100"),
    stockPrecio: d("5"),
    stockInversion: d("500"),
    stockQqUtilidad: d("0"),
    stockTotalUtilidad: d("0"),
    predioDia: d("0"),
    humedad: d("0"),
    impureza: d("0"),
    ...overrides,
  };
}

const compra = (o: Partial<DatoCompraConjunto> = {}): DatoCompraConjunto => ({
  idBoletoDetalle: 1,
  humedad: d("14"),
  impureza: d("1"),
  qqBruto: d("100"),
  qqNeto: d("100"),
  porcen: d("0"),
  merma: d("0"),
  fecha: new Date("2026-10-14T10:00:00.000Z"),
  precio: d("15"),
  vTotal: d("1500"),
  retencion: d("0"),
  efectivo: d("1000"),
  cheque: d("500"),
  transferencia: d("0"),
  anticipo: d("0"),
  comision: d("20"),
  pendiente: d("0"),
  ...o,
});

const venta = (o: Partial<DatoVentaConjunto> = {}): DatoVentaConjunto => ({
  idBoletoDetalle: 1,
  humedad: d("14"),
  impureza: d("1"),
  qqBruto: d("100"),
  qqNeto: d("100"),
  fecha: new Date("2026-10-14T11:00:00.000Z"),
  precio: d("12"),
  vTotal: d("1200"),
  retencion: d("0"),
  efectivo: d("500"),
  cheque: d("100"),
  deposito: d("200"),
  pendiente: d("0"),
  ...o,
});

const conMovimiento: EntradaGrilla = {
  producto: producto(),
  calculo: calcularProducto(producto(), [compra()], [venta()], emboAnti),
};

const sinMovimiento: EntradaGrilla = {
  producto: producto({ idProducto: 2, sucursal: "VINCES" }),
  calculo: calcularProducto(producto({ idProducto: 2 }), [], [], emboAnti),
};

describe("producto con movimiento", () => {
  const filas = proyectarInventarioAdmin([conMovimiento]);

  it("emite 9 filas en el orden legacy", () => {
    expect(filas.map((f) => f.kind)).toEqual([
      "inv-vacia",
      "inv-producto",
      "inv-descripcion",
      "inv-detalle",
      "inv-detalle",
      "inv-detalle",
      "inv-detalle",
      "inv-detalle",
      "inv-detalle",
    ]);
  });

  it("todas las filas tienen 18 celdas", () => {
    for (const f of filas) expect(f.celdas).toHaveLength(18);
  });

  it("inv-producto lleva el rótulo y los tres valores del día", () => {
    const f = filas[1];
    expect(f.celdas[3]).toBe("MAIZ VENTANAS");
    expect(f.celdas[4]).toBe("P. DIA :");
    expect(f.celdas[5]).toBe("15.01");
    expect(f.celdas[6]).toBe("HUME :");
    expect(f.celdas[7]).toBe("14.00");
    expect(f.celdas[8]).toBe("IMPU :");
    expect(f.celdas[9]).toBe("1.00");
    expect(f.celdasLegacy).toBe(16);
  });

  it("inv-descripcion rotula las columnas y va en negrita", () => {
    const f = filas[2];
    expect(f.celdas.slice(3, 13)).toEqual([
      "DESCRIPCION",
      "QQ BRUTO",
      "PORCEN",
      "MERMA",
      "QQ NETO",
      "P. PROME",
      "EFECTIVO",
      "CHEQUE",
      "DEPOSITO",
      "INVERSION",
    ]);
    expect(f.estiloFila).toEqual({ bold: true });
  });

  it("ANTERIOR imprime neto, precio e inversión", () => {
    const f = filas[3];
    expect(f.celdas[3]).toBe("ANTERIOR");
    expect(f.celdas[7]).toBe("100.00");
    expect(f.celdas[8]).toBe("5.00");
    expect(f.celdas[12]).toBe("500.00");
  });

  it("COMPRA usa F en el efectivo (sin separador de miles)", () => {
    const f = filas[4];
    expect(f.celdas[3]).toBe("COMPRA");
    expect(f.celdas[9]).toBe("1020.00"); // 1000 + 20 comisión, formato F
    expect(f.celdas[12]).toBe("1,500.00");
  });

  it("VENTA usa N2 en el efectivo", () => {
    const f = filas[5];
    expect(f.celdas[9]).toBe("500.00");
    expect(f.celdas[11]).toBe("200.00");
  });

  it("EXCEDENTE imprime solo el rótulo", () => {
    const f = filas[6];
    expect(f.celdas[3]).toBe("EXCEDENTE");
    expect(f.celdas.slice(4)).toEqual(new Array(14).fill(null));
    expect(f.celdasLegacy).toBe(14);
  });

  it("STOCK y UTILIDAD traen los calculados", () => {
    expect(filas[7].celdas[7]).toBe("100.00");
    expect(filas[7].celdas[8]).toBe("10.00");
    expect(filas[7].celdas[12]).toBe("1,000.00");
    expect(filas[8].celdas[8]).toBe("2.00");
    expect(filas[8].celdas[12]).toBe("200.00");
  });

  it("nadie escribe las celdas 16/17 ni abre modal", () => {
    for (const f of filas) {
      expect(f.celdas[16]).toBeNull();
      expect(f.celdas[17]).toBeNull();
    }
  });
});

describe("producto sin movimiento", () => {
  const filas = proyectarInventarioAdmin([sinMovimiento]);

  it("emite 3 filas", () => {
    expect(filas.map((f) => f.kind)).toEqual([
      "inv-vacia",
      "inv-sin-mov-producto",
      "inv-sin-mov-resumen",
    ]);
  });

  it("el resumen intercala rótulos y valores", () => {
    const f = filas[2];
    expect(f.celdas[3]).toBe("STOCK:");
    expect(f.celdas[4]).toBe("100.00");
    expect(f.celdas[5]).toBe("PRECIO:");
    expect(f.celdas[6]).toBe("5.00");
    expect(f.celdas[7]).toBe("INVERSION:");
    expect(f.celdas[8]).toBe("500.00");
    expect(f.celdas[9]).toBe("UTILIDAD:");
    expect(f.celdas[10]).toBe("0.00");
    expect(f.celdas[11]).toBe("UTI. QQ:");
    // Sin ventas, la utilidad unitaria es 0 − costo promedio = −5 (fórmula legacy).
    expect(f.celdas[12]).toBe("-5.00");
  });
});

describe("dos pasadas", () => {
  it("los productos con movimiento van primero, en orden", () => {
    const a = { ...sinMovimiento, producto: producto({ idProducto: 9, sucursal: "A" }) };
    const b = { ...conMovimiento, producto: producto({ idProducto: 3, sucursal: "B" }) };
    const c = { ...sinMovimiento, producto: producto({ idProducto: 7, sucursal: "C" }) };

    const filas = proyectarInventarioAdmin([a, b, c]);
    const rotulos = filas.filter((f) => f.idProducto !== undefined).map((f) => f.celdas[3]);

    expect(rotulos).toEqual(["MAIZ B", "MAIZ A", "MAIZ C"]);
  });
});
