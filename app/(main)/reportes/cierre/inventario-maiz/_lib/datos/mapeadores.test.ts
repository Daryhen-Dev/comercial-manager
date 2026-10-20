import { describe, expect, it } from "vitest";

import { CsDecimal } from "@/lib/cs-decimal/cs-decimal";

import {
  CargaCierreError,
  CargaCierreSinCierrePrevio,
  decimalDeTexto,
  entero,
  texto,
} from "./errores";
import { mapearFechaCierre, mapearProductoFormulaMaiz, mapearValidacionVenta } from "./mapeadores";

const CTX = { consulta: "test" };

const filaProducto = {
  IDProducto: 1,
  IDLocal: 3,
  Sucursal: "VENTANAS",
  PRODUCTO: "MAIZ",
  HUMEDAD_SECO: "13",
  MERMA_AGUA: "1.1",
  SERV_BASICO: "0.21",
  PRECIO: "17.60",
  PRECIO_MINIMO: "0",
  PRECIO_MAXIMO: "0",
  STOCK: "12373.17750800",
  STOCK_PRECIO: "17.609140281041731473053831229",
  STOCK_INVERSION: "217881.01846060235067176537264",
  UtilidadQQ: "0",
  UtilidadTotal: "0",
  PrecioDia: "0",
  Humedad: "0",
  Impureza: "0",
};

describe("mapearProductoFormulaMaiz", () => {
  it("convierte a CsDecimal conservando la escala del texto", () => {
    const p = mapearProductoFormulaMaiz(filaProducto);
    expect(p.stock.toString()).toBe("12373.17750800");
    expect(p.humedadSeco.toString()).toBe("13");
    expect(p.mermaAgua.toString()).toBe("1.1");
  });

  it("fuerza la rama normal: mmEstado false y MM en cero", () => {
    const p = mapearProductoFormulaMaiz(filaProducto);
    expect(p.mmEstado).toBe(false);
    expect(p.mmHumeSeco.eq(CsDecimal.ZERO)).toBe(true);
    expect(p.mmPrecio.eq(CsDecimal.ZERO)).toBe(true);
  });

  it("conserva el nombre legacy predioDia", () => {
    expect(mapearProductoFormulaMaiz(filaProducto).predioDia).toBeInstanceOf(CsDecimal);
  });

  it("falla si una columna numérica de texto viene NULL", () => {
    expect(() => mapearProductoFormulaMaiz({ ...filaProducto, UtilidadQQ: null })).toThrow(
      CargaCierreError,
    );
  });
});

describe("mapearFechaCierre", () => {
  it("devuelve la fecha tal cual", () => {
    const fecha = new Date("2026-10-13T23:29:57.000Z");
    expect(mapearFechaCierre([{ Fecha: fecha }])).toBe(fecha);
  });

  it("sin filas lanza CargaCierreSinCierrePrevio", () => {
    expect(() => mapearFechaCierre([])).toThrow(CargaCierreSinCierrePrevio);
  });

  it("con Fecha NULL lanza CargaCierreSinCierrePrevio", () => {
    expect(() => mapearFechaCierre([{ Fecha: null }])).toThrow(CargaCierreSinCierrePrevio);
  });

  it("no es un CargaCierreError: el legacy se caía acá", () => {
    expect(new CargaCierreSinCierrePrevio()).not.toBeInstanceOf(CargaCierreError);
  });
});

describe("mapearValidacionVenta", () => {
  it("lee el alias en mayúsculas SUCURSAL", () => {
    const fecha = new Date("2026-10-14T09:53:04.493Z");
    const v = mapearValidacionVenta({
      IDBoletoDetalle: 185325,
      SUCURSAL: "VENTANAS",
      CODIGO: "4532-1",
      PRODUCTO: "MAIZ",
      CLIENTE: "CHUQUICONDOR",
      FECHA: fecha,
    });
    expect(v.sucursal).toBe("VENTANAS");
    expect(v.idBoletoDetalle).toBe("185325");
    expect(v.fecha).toBe(fecha);
  });
});

describe("helpers de columna", () => {
  it("entero rechaza NULL y tipos inesperados", () => {
    expect(() => entero(null, "IDLocal", CTX)).toThrow(/came back NULL/);
    expect(() => entero("3", "IDLocal", CTX)).toThrow(/expected as int/);
    expect(entero(3, "IDLocal", CTX)).toBe(3);
  });

  it("texto rechaza no-strings", () => {
    expect(() => texto(3, "Sucursal", CTX)).toThrow(/expected as string/);
  });

  it("decimalDeTexto rechaza texto no parseable", () => {
    expect(() => decimalDeTexto("abc", "STOCK", CTX)).toThrow(/Convert\.ToDecimal would reject/);
  });

  it("decimalDeTexto conserva la escala de 8 decimales", () => {
    expect(decimalDeTexto("12373.17750800", "STOCK", CTX).toString()).toBe("12373.17750800");
  });
});
