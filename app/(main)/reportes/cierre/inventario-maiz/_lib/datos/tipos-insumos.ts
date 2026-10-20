import type { CsDecimal } from "@/lib/cs-decimal/cs-decimal";

/** A purchase row, union of the báscula / romana / general shapes. */
export type DatoCompraConjunto = {
  idBoletoDetalle: number;
  humedad: CsDecimal;
  impureza: CsDecimal;
  qqBruto: CsDecimal;
  qqNeto: CsDecimal;
  porcen: CsDecimal;
  merma: CsDecimal;
  fecha: Date;
  precio: CsDecimal;
  vTotal: CsDecimal;
  retencion: CsDecimal;
  efectivo: CsDecimal;
  cheque: CsDecimal;
  transferencia: CsDecimal;
  anticipo: CsDecimal;
  comision: CsDecimal;
  pendiente: CsDecimal;
};

/** A sale row, union of the báscula / bodeguita / general shapes. */
export type DatoVentaConjunto = {
  idBoletoDetalle: number;
  humedad: CsDecimal;
  impureza: CsDecimal;
  qqBruto: CsDecimal;
  qqNeto: CsDecimal;
  fecha: Date;
  precio: CsDecimal;
  vTotal: CsDecimal;
  retencion: CsDecimal;
  efectivo: CsDecimal;
  cheque: CsDecimal;
  deposito: CsDecimal;
  pendiente: CsDecimal;
};

export type EmboAnti = { anticipo: CsDecimal; embo: CsDecimal };

export type IdsPorTipo = {
  compraBascula: number[];
  compraRomana: number[];
  compraGeneral: number[];
  ventaBascula: number[];
  ventaBodeguita: number[];
  ventaGeneral: number[];
};

export type DatoCompraEmbodegado = {
  idBoletoDetalle: number;
  codigo: string;
  comprobante: string;
};

export type CargaInsumosProducto = {
  /** bascula ++ romana ++ general, in that order. */
  compras: DatoCompraConjunto[];
  /** bascula ++ bodeguita ++ general, in that order. */
  ventas: DatoVentaConjunto[];
  emboAnti: EmboAnti;
  embodegadoIds: number[];
  /** Only the closing save consumes these; this report ignores them. */
  idsPorTipo: IdsPorTipo;
};
