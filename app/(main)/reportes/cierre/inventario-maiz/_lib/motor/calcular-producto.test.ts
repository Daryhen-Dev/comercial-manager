import { describe, expect, it } from "vitest";

import { CsDecimal } from "@/lib/cs-decimal/cs-decimal";

import type { DatoProducto } from "../datos/tipos";
import type { DatoCompraConjunto, DatoVentaConjunto } from "../datos/tipos-insumos";
import { resumirMaiz } from "../sesion/mapeo-dto";
import { CierreCalculoError } from "./comun";
import { calcularProducto } from "./calcular-producto";

const d = (s: string) => CsDecimal.parse(s);

/** The worked example from §8.7 of the specification. */
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

function compra(overrides: Partial<DatoCompraConjunto> = {}): DatoCompraConjunto {
  return {
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
    ...overrides,
  };
}

function venta(overrides: Partial<DatoVentaConjunto> = {}): DatoVentaConjunto {
  return {
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
    ...overrides,
  };
}

const emboAnti = { anticipo: d("0"), embo: d("0") };

describe("ejemplo trabajado §8.7", () => {
  const r = calcularProducto(producto(), [compra()], [venta()], emboAnti);
  const [anterior, comp, vend, exc, stock, util] = r.inventarioDetalle;

  it("produce las seis filas en orden", () => {
    expect(r.inventarioDetalle.map((f) => f.descripcion)).toEqual([
      "ANTERIOR",
      "COMPRA",
      "VENTA",
      "EXCEDENTE",
      "STOCK",
      "UTILIDAD",
    ]);
  });

  it("ANTERIOR sale del stock previo", () => {
    expect(anterior.qqNeto.toString()).toBe("100");
    expect(anterior.precioPromedio.toString()).toBe("5");
    expect(anterior.inversion.toString()).toBe("500");
  });

  it("COMPRA suma la comisión al efectivo y calcula precioDelDia", () => {
    expect(comp.qqBruto.toString()).toBe("100");
    expect(comp.precioPromedio.toString()).toBe("15");
    expect(comp.efectivo.toString()).toBe("1020"); // 1000 + 20
    expect(comp.inversion.toString()).toBe("1500");
    // ((14 − 13) × 0.5 × 0.02) + 15 = 15.010
    expect(r.inventarioNuevo.precioDia.toString()).toBe("15.010");
    expect(r.inventarioNuevo.humedad.toString()).toBe("14");
    expect(r.inventarioNuevo.impureza.toString()).toBe("1");
  });

  it("VENTA expone el depósito como transferencia", () => {
    expect(vend.precioPromedio.toString()).toBe("12");
    expect(vend.efectivo.toString()).toBe("500");
    expect(vend.cheque.toString()).toBe("100");
    expect(vend.deposito.toString()).toBe("200");
    expect(vend.inversion.toString()).toBe("1200");
  });

  it("EXCEDENTE queda en ceros", () => {
    expect(exc.qqNeto.isZero).toBe(true);
    expect(exc.inversion.isZero).toBe(true);
  });

  it("STOCK y UTILIDAD cuadran con el documento", () => {
    expect(stock.qqNeto.toString()).toBe("100");
    expect(stock.precioPromedio.toString()).toBe("10");
    expect(stock.inversion.toString()).toBe("1000");
    expect(util.precioPromedio.toString()).toBe("2");
    expect(util.inversion.toString()).toBe("200");
  });

  it("inventarioNuevo coincide campo por campo", () => {
    expect(r.inventarioNuevo.stock.toString()).toBe("100");
    expect(r.inventarioNuevo.precio.toString()).toBe("10");
    expect(r.inventarioNuevo.inversion.toString()).toBe("1000");
    expect(r.inventarioNuevo.qqUtilidad.toString()).toBe("2");
    expect(r.inventarioNuevo.totalUtilidad.toString()).toBe("200");
  });

  it("resumirMaiz formatea los tres totales", () => {
    expect(
      resumirMaiz([
        { stock: r.inventarioNuevo.stock, inversion: r.inventarioNuevo.inversion },
      ]),
    ).toEqual({ stock: "100.00", precio: "10.00", inversion: "1,000.00" });
  });
});

describe("resumirMaiz", () => {
  it("sin productos cae a cero en los tres", () => {
    expect(resumirMaiz([])).toEqual({ stock: "0.00", precio: "0.00", inversion: "0.00" });
  });

  it("promedia ponderado por quintales, no por precios", () => {
    const items = [
      { stock: d("1480"), inversion: d("66000") },
      { stock: d("300"), inversion: d("12000") },
    ];
    expect(resumirMaiz(items)).toEqual({
      stock: "1,780.00",
      inversion: "78,000.00",
      precio: "43.82",
    });
  });
});

describe("errores del motor", () => {
  it("compra con merma y qqBruto 0 propaga en compra-del-dia", () => {
    expect(() =>
      calcularProducto(
        producto(),
        [compra({ qqBruto: d("0"), qqNeto: d("0"), merma: d("5") })],
        [],
        emboAnti,
      ),
    ).toThrow(CierreCalculoError);

    try {
      calcularProducto(
        producto(),
        [compra({ qqBruto: d("0"), qqNeto: d("0"), merma: d("5") })],
        [],
        emboAnti,
      );
    } catch (e) {
      expect((e as CierreCalculoError).paso).toBe("compra-del-dia");
    }
  });

  it("venta con una fila de qqBruto 0 falla en venta-del-dia", () => {
    try {
      calcularProducto(producto(), [], [venta({ qqBruto: d("0") })], emboAnti);
      throw new Error("debió lanzar");
    } catch (e) {
      expect(e).toBeInstanceOf(CierreCalculoError);
      expect((e as CierreCalculoError).paso).toBe("venta-del-dia");
    }
  });

  it("sin movimientos el stock se mantiene", () => {
    const r = calcularProducto(producto(), [], [], emboAnti);
    expect(r.inventarioNuevo.stock.toString()).toBe("100");
    expect(r.inventarioNuevo.precio.toString()).toBe("5");
    expect(r.inventarioNuevo.inversion.toString()).toBe("500");
  });
});
