import { CsDecimal } from "@/lib/cs-decimal/cs-decimal";

import {
  CargaCierreError,
  CargaCierreSinCierrePrevio,
  decimalDeTexto,
  entero,
  fechaHora,
  texto,
} from "./errores";
import {
  CONSULTA_FECHA_CIERRE,
  CONSULTA_PRODUCTOS,
  CONSULTA_VALIDAR_COMPRA,
  CONSULTA_VALIDAR_VENTA,
} from "./contextos";
import type {
  RawFechaCierre,
  RawProductoFormulaMaiz,
  RawValidacionCompra,
  RawValidacionVenta,
} from "./consultas";
import type { DatoProducto, DatoValidacionCyV } from "./tipos";

const CTX_PRODUCTOS = { consulta: CONSULTA_PRODUCTOS };

export function mapearProductoFormulaMaiz(row: RawProductoFormulaMaiz): DatoProducto {
  return {
    idProducto: entero(row.IDProducto, "IDProducto", CTX_PRODUCTOS),
    idLocal: entero(row.IDLocal, "IDLocal", CTX_PRODUCTOS),
    sucursal: texto(row.Sucursal, "Sucursal", CTX_PRODUCTOS),
    producto: texto(row.PRODUCTO, "PRODUCTO", CTX_PRODUCTOS),
    humedadSeco: decimalDeTexto(row.HUMEDAD_SECO, "HUMEDAD_SECO", CTX_PRODUCTOS),
    mermaAgua: decimalDeTexto(row.MERMA_AGUA, "MERMA_AGUA", CTX_PRODUCTOS),
    servBasico: decimalDeTexto(row.SERV_BASICO, "SERV_BASICO", CTX_PRODUCTOS),
    precio: decimalDeTexto(row.PRECIO, "PRECIO", CTX_PRODUCTOS),
    precioMinimo: decimalDeTexto(row.PRECIO_MINIMO, "PRECIO_MINIMO", CTX_PRODUCTOS),
    precioMaximo: decimalDeTexto(row.PRECIO_MAXIMO, "PRECIO_MAXIMO", CTX_PRODUCTOS),
    // FillByMaiz does not select the MM columns, so the normal branch is forced.
    mmEstado: false,
    mmHumeSeco: CsDecimal.ZERO,
    mmMermaAgua: CsDecimal.ZERO,
    mmServiBasico: CsDecimal.ZERO,
    mmPrecio: CsDecimal.ZERO,
    stock: decimalDeTexto(row.STOCK, "STOCK", CTX_PRODUCTOS),
    stockPrecio: decimalDeTexto(row.STOCK_PRECIO, "STOCK_PRECIO", CTX_PRODUCTOS),
    stockInversion: decimalDeTexto(row.STOCK_INVERSION, "STOCK_INVERSION", CTX_PRODUCTOS),
    stockQqUtilidad: decimalDeTexto(row.UtilidadQQ, "UtilidadQQ", CTX_PRODUCTOS),
    stockTotalUtilidad: decimalDeTexto(row.UtilidadTotal, "UtilidadTotal", CTX_PRODUCTOS),
    predioDia: decimalDeTexto(row.PrecioDia, "PrecioDia", CTX_PRODUCTOS),
    humedad: decimalDeTexto(row.Humedad, "Humedad", CTX_PRODUCTOS),
    impureza: decimalDeTexto(row.Impureza, "Impureza", CTX_PRODUCTOS),
  };
}

/** A branch without a previous closing aborts the whole load, as in the legacy. */
export function mapearFechaCierre(filas: RawFechaCierre[]): Date {
  const fila = filas[0];
  if (fila === undefined) throw new CargaCierreSinCierrePrevio();
  if (fila.Fecha === null || fila.Fecha === undefined) {
    throw new CargaCierreSinCierrePrevio();
  }
  if (!(fila.Fecha instanceof Date)) {
    throw new CargaCierreError(
      "UNEXPECTED_TYPE",
      `Column "Fecha" was expected as datetime but arrived as ${typeof fila.Fecha}.`,
      { columna: "Fecha", consulta: CONSULTA_FECHA_CIERRE },
    );
  }
  return fila.Fecha;
}

const CTX_COMPRA = { consulta: CONSULTA_VALIDAR_COMPRA };
const CTX_VENTA = { consulta: CONSULTA_VALIDAR_VENTA };

export function mapearValidacionCompra(row: RawValidacionCompra): DatoValidacionCyV {
  return {
    idBoletoDetalle: String(entero(row.IDBoletoDetalle, "IDBoletoDetalle", CTX_COMPRA)),
    sucursal: texto(row.Sucursal, "Sucursal", CTX_COMPRA),
    codigo: texto(row.CODIGO, "CODIGO", CTX_COMPRA),
    producto: texto(row.PRODUCTO, "PRODUCTO", CTX_COMPRA),
    cliente: texto(row.CLIENTE, "CLIENTE", CTX_COMPRA),
    fecha: fechaHora(row.FECHA, "FECHA", CTX_COMPRA),
  };
}

export function mapearValidacionVenta(row: RawValidacionVenta): DatoValidacionCyV {
  return {
    idBoletoDetalle: String(entero(row.IDBoletoDetalle, "IDBoletoDetalle", CTX_VENTA)),
    // Reading `Sucursal` here was a real bug in the reference port: this alias is
    // uppercase only in the venta query.
    sucursal: texto(row.SUCURSAL, "SUCURSAL", CTX_VENTA),
    codigo: texto(row.CODIGO, "CODIGO", CTX_VENTA),
    producto: texto(row.PRODUCTO, "PRODUCTO", CTX_VENTA),
    cliente: texto(row.CLIENTE, "CLIENTE", CTX_VENTA),
    fecha: fechaHora(row.FECHA, "FECHA", CTX_VENTA),
  };
}
