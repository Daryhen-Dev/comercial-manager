import { CsDecimal } from "@/lib/cs-decimal/cs-decimal";

import { decimalDeTexto, entero, fechaHora, texto } from "./errores";
import type {
  RawCompraBascula,
  RawCompraEmbodegado,
  RawCompraGeneral,
  RawCompraRomana,
  RawEmboAnti,
  RawVenta,
} from "./consultas-insumos";
import type { DatoCompraConjunto, DatoCompraEmbodegado, DatoVentaConjunto, EmboAnti } from "./tipos-insumos";

const ctx = (consulta: string) => ({ consulta });

const CTX_BASCULA = ctx("DatoCompraBasculaTableAdapter.GetData (Anexo A §A.C)");
const CTX_ROMANA = ctx("DatoCompraRomanaTableAdapter.GetData");
const CTX_GENERAL = ctx("DatoCompraGeneralTableAdapter.GetData");
const CTX_VENTA = ctx("DatoVenta*TableAdapter.GetData");
const CTX_EMBO = ctx("DatoComisionAnticipoTableAdapter.GetData");
const CTX_EMBODEGADO = ctx("DatoCompraEmbodegadoTableAdapter.GetData");

export function mapearCompraBascula(row: RawCompraBascula): DatoCompraConjunto {
  return {
    idBoletoDetalle: entero(row.IDBoletoDetalle, "IDBoletoDetalle", CTX_BASCULA),
    humedad: decimalDeTexto(row.HUMEDAD, "HUMEDAD", CTX_BASCULA),
    impureza: decimalDeTexto(row.IMPUREZA, "IMPUREZA", CTX_BASCULA),
    qqBruto: decimalDeTexto(row.QQBRUTO, "QQBRUTO", CTX_BASCULA),
    qqNeto: decimalDeTexto(row.NETO, "NETO", CTX_BASCULA),
    porcen: decimalDeTexto(row.PORCEN, "PORCEN", CTX_BASCULA),
    merma: decimalDeTexto(row.MERMA, "MERMA", CTX_BASCULA),
    fecha: fechaHora(row.FECHA, "FECHA", CTX_BASCULA),
    precio: decimalDeTexto(row.PRECIO, "PRECIO", CTX_BASCULA),
    vTotal: decimalDeTexto(row.VTOTAL, "VTOTAL", CTX_BASCULA),
    retencion: decimalDeTexto(row.RETEN, "RETEN", CTX_BASCULA),
    efectivo: decimalDeTexto(row.EFECTIVO, "EFECTIVO", CTX_BASCULA),
    cheque: decimalDeTexto(row.CHEQUE, "CHEQUE", CTX_BASCULA),
    transferencia: decimalDeTexto(row.TRANSFERENCIA, "TRANSFERENCIA", CTX_BASCULA),
    // La consulta de báscula no trae anticipo.
    anticipo: CsDecimal.ZERO,
    comision: decimalDeTexto(row.COMISION, "COMISION", CTX_BASCULA),
    pendiente: decimalDeTexto(row.PENDIENTE, "PENDIENTE", CTX_BASCULA),
  };
}

function mapearCompraConAnticipo(
  row: RawCompraRomana | RawCompraGeneral,
  contexto: { consulta: string },
): DatoCompraConjunto {
  return {
    idBoletoDetalle: entero(row.IDBoletoDetalle, "IDBoletoDetalle", contexto),
    humedad: decimalDeTexto(row.HUMEDAD, "HUMEDAD", contexto),
    impureza: decimalDeTexto(row.IMPUREZA, "IMPUREZA", contexto),
    qqBruto: decimalDeTexto(row.QQBRUTO, "QQBRUTO", contexto),
    qqNeto: decimalDeTexto(row.NETO, "NETO", contexto),
    porcen: decimalDeTexto(row.PORCENTAJE, "PORCENTAJE", contexto),
    merma: decimalDeTexto(row.MERMA, "MERMA", contexto),
    fecha: fechaHora(row.FECHA, "FECHA", contexto),
    precio: decimalDeTexto(row.PRECIO, "PRECIO", contexto),
    vTotal: decimalDeTexto(row.VTOTAL, "VTOTAL", contexto),
    retencion: decimalDeTexto(row.RETEN, "RETEN", contexto),
    efectivo: decimalDeTexto(row.EFECTIVO, "EFECTIVO", contexto),
    cheque: decimalDeTexto(row.CHEQUE, "CHEQUE", contexto),
    transferencia: decimalDeTexto(row.TRANSFERENCIA, "TRANSFERENCIA", contexto),
    anticipo: decimalDeTexto(row.ANTICIPO, "ANTICIPO", contexto),
    comision: decimalDeTexto(row.COMISION, "COMISION", contexto),
    pendiente: decimalDeTexto(row.PENDIENTE, "PENDIENTE", contexto),
  };
}

export const mapearCompraRomana = (row: RawCompraRomana) =>
  mapearCompraConAnticipo(row, CTX_ROMANA);

export const mapearCompraGeneral = (row: RawCompraGeneral) =>
  mapearCompraConAnticipo(row, CTX_GENERAL);

export function mapearVenta(row: RawVenta): DatoVentaConjunto {
  return {
    idBoletoDetalle: entero(row.IDBoletoDetalle, "IDBoletoDetalle", CTX_VENTA),
    humedad: decimalDeTexto(row.HUMEDAD, "HUMEDAD", CTX_VENTA),
    impureza: decimalDeTexto(row.IMPUREZA, "IMPUREZA", CTX_VENTA),
    qqBruto: decimalDeTexto(row.QQBRUTO, "QQBRUTO", CTX_VENTA),
    qqNeto: decimalDeTexto(row.NETO, "NETO", CTX_VENTA),
    fecha: fechaHora(row.FECHA, "FECHA", CTX_VENTA),
    precio: decimalDeTexto(row.PRECIO, "PRECIO", CTX_VENTA),
    vTotal: decimalDeTexto(row.VTOTAL, "VTOTAL", CTX_VENTA),
    retencion: decimalDeTexto(row.RETEN, "RETEN", CTX_VENTA),
    efectivo: decimalDeTexto(row.EFECTIVO, "EFECTIVO", CTX_VENTA),
    cheque: decimalDeTexto(row.CHEQUE, "CHEQUE", CTX_VENTA),
    deposito: decimalDeTexto(row.DEPOSITO, "DEPOSITO", CTX_VENTA),
    pendiente: decimalDeTexto(row.PENDIENTE, "PENDIENTE", CTX_VENTA),
  };
}

/** The loop keeps "last row wins" for fidelity; no rows means both zero. */
export function mapearEmboAnti(filas: RawEmboAnti[]): EmboAnti {
  let anticipo = CsDecimal.ZERO;
  let embo = CsDecimal.ZERO;
  for (const fila of filas) {
    anticipo = decimalDeTexto(fila.ANTICIPO, "ANTICIPO", CTX_EMBO);
    embo = decimalDeTexto(fila.EMBO, "EMBO", CTX_EMBO);
  }
  return { anticipo, embo };
}

export function mapearCompraEmbodegado(row: RawCompraEmbodegado): DatoCompraEmbodegado {
  return {
    idBoletoDetalle: entero(row.IDBoletoDetalle, "IDBoletoDetalle", CTX_EMBODEGADO),
    codigo: String(entero(row.Codigo, "Codigo", CTX_EMBODEGADO)),
    comprobante: texto(row.CodComprobante, "CodComprobante", CTX_EMBODEGADO),
  };
}
