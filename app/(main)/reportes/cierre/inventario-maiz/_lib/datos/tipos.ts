import type { CsDecimal } from "@/lib/cs-decimal/cs-decimal";

/** One `Cierre_Producto` row joined to its `Producto`, for a single branch. */
export type DatoProducto = {
  idProducto: number;
  idLocal: number;
  sucursal: string;
  producto: string;
  humedadSeco: CsDecimal;
  mermaAgua: CsDecimal;
  servBasico: CsDecimal;
  precio: CsDecimal;
  precioMinimo: CsDecimal;
  precioMaximo: CsDecimal;
  /** Always false on this path: FillByMaiz does not select the MM columns. */
  mmEstado: boolean;
  mmHumeSeco: CsDecimal;
  mmMermaAgua: CsDecimal;
  mmServiBasico: CsDecimal;
  mmPrecio: CsDecimal;
  stock: CsDecimal;
  stockPrecio: CsDecimal;
  stockInversion: CsDecimal;
  stockQqUtilidad: CsDecimal;
  stockTotalUtilidad: CsDecimal;
  /** Name kept from the legacy mapper, which spelled it `predioDia`. Unused. */
  predioDia: CsDecimal;
  humedad: CsDecimal;
  impureza: CsDecimal;
};

/** A purchase or sale that is still pending liquidation. */
export type DatoValidacionCyV = {
  /** The C# did `.ToString()`, so it travels as text. */
  idBoletoDetalle: string;
  sucursal: string;
  codigo: string;
  producto: string;
  cliente: string;
  fecha: Date;
};

export type ProductoCierreMaiz = {
  producto: DatoProducto;
  /** The closing date of the product's own local. */
  fechaCierre: Date;
};

export type CargaVistaInventarioMaiz = {
  productos: ProductoCierreMaiz[];
  faltantes: { compras: DatoValidacionCyV[]; ventas: DatoValidacionCyV[] };
  estadoInventario: boolean;
  estadoFaltantes: boolean;
};
