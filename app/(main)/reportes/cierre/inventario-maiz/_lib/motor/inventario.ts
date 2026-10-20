import { CsDecimal } from "@/lib/cs-decimal/cs-decimal";

import type { DatoProducto } from "../datos/tipos";
import { CIEN, divOCero, oCero } from "./comun";
import type { DatosCompraDelDia } from "./compra-del-dia";
import type { DatosVentaDelDia } from "./venta-del-dia";

export type FilaInventario = {
  descripcion: "ANTERIOR" | "COMPRA" | "VENTA" | "EXCEDENTE" | "STOCK" | "UTILIDAD";
  qqBruto: CsDecimal;
  porcen: CsDecimal;
  merma: CsDecimal;
  qqNeto: CsDecimal;
  precioPromedio: CsDecimal;
  efectivo: CsDecimal;
  cheque: CsDecimal;
  deposito: CsDecimal;
  inversion: CsDecimal;
};

export type InventarioNuevo = {
  stock: CsDecimal;
  precio: CsDecimal;
  inversion: CsDecimal;
  qqUtilidad: CsDecimal;
  totalUtilidad: CsDecimal;
  precioDia: CsDecimal;
  humedad: CsDecimal;
  impureza: CsDecimal;
};

export type ResultadoInventario = {
  /** Always six rows, read positionally: 0 ANTERIOR … 5 UTILIDAD. */
  inventarioDetalle: FilaInventario[];
  inventarioNuevo: InventarioNuevo;
};

const z = () => CsDecimal.ZERO;

function fila(descripcion: FilaInventario["descripcion"]): FilaInventario {
  return {
    descripcion,
    qqBruto: z(),
    porcen: z(),
    merma: z(),
    qqNeto: z(),
    precioPromedio: z(),
    efectivo: z(),
    cheque: z(),
    deposito: z(),
    inversion: z(),
  };
}

export function pasarValoresACV(
  producto: DatoProducto,
  compra: DatosCompraDelDia,
  venta: DatosVentaDelDia,
): ResultadoInventario {
  const anterior = fila("ANTERIOR");
  anterior.qqNeto = producto.stock;
  anterior.precioPromedio = producto.stockPrecio;
  anterior.inversion = producto.stockInversion;

  const fCompra = fila("COMPRA");
  fCompra.qqBruto = compra.qqBrutoTotal;
  fCompra.porcen = compra.porcentajeTotal;
  fCompra.merma = compra.mermaTotal;
  fCompra.qqNeto = compra.qqNetoTotal;
  fCompra.precioPromedio = compra.precio;
  // La comisión se suma al efectivo de la compra.
  fCompra.efectivo = compra.efectivoTotal.add(compra.comisionTotal);
  fCompra.cheque = compra.chequeTotal;
  fCompra.deposito = z();
  fCompra.inversion = compra.vTotalTotal;

  const mermaVenta = venta.qqBrutoTotal.sub(venta.qqNetoTotal);

  const fVenta = fila("VENTA");
  fVenta.qqBruto = venta.qqBrutoTotal;
  fVenta.porcen = divOCero(mermaVenta.mul(CIEN), venta.qqBrutoTotal);
  fVenta.merma = mermaVenta;
  fVenta.qqNeto = venta.qqNetoTotal;
  fVenta.precioPromedio = venta.precio;
  fVenta.efectivo = venta.efectivoTotal;
  fVenta.cheque = venta.chequeTotal;
  fVenta.deposito = venta.transferencia;
  fVenta.inversion = venta.vTotalTotal;

  const excedente = fila("EXCEDENTE");

  const stock = fila("STOCK");
  const utilidad = fila("UTILIDAD");

  // Order matters: each value feeds the next.
  const stockQQ = anterior.qqNeto.add(fCompra.qqNeto).sub(fVenta.qqNeto);

  const costoVenta = divOCero(
    anterior.inversion.add(fCompra.inversion),
    anterior.qqNeto.add(fCompra.qqNeto),
  );
  const utilidadQQ = fVenta.precioPromedio.sub(costoVenta);

  // Outside the legacy try: a huge inversion can overflow here.
  const utilidadTotal = fVenta.qqNeto.mul(utilidadQQ);

  const stockInversion = anterior.inversion
    .add(fCompra.inversion)
    .sub(fVenta.inversion)
    .add(utilidadTotal);

  const stockPrecio = divOCero(stockInversion, stockQQ);

  stock.qqNeto = stockQQ;
  stock.precioPromedio = stockPrecio;
  stock.inversion = stockInversion;

  utilidad.precioPromedio = utilidadQQ;
  utilidad.inversion = utilidadTotal;

  return {
    inventarioDetalle: [anterior, fCompra, fVenta, excedente, stock, utilidad],
    inventarioNuevo: {
      stock: stockQQ,
      precio: stockPrecio,
      inversion: stockInversion,
      qqUtilidad: utilidadQQ,
      totalUtilidad: utilidadTotal,
      precioDia: compra.precioDelDia,
      humedad: compra.humedadTotal,
      impureza: compra.impurezaTotal,
    },
  };
}

export { oCero };
