import { CsDecimal } from "@/lib/cs-decimal/cs-decimal";

import {
  ESTILO_CABECERA_DETALLE,
  ESTILO_FILA_DETALLE,
  ESTILO_FILA_PRODUCTO,
  ESTILO_FILA_RESUMEN,
  ESTILO_FILA_SIN_MOV,
} from "./estilos-inventario";
import {
  CELDAS_TOTALES,
  type CeldaGrilla,
  type EntradaGrilla,
  type FilaGrilla,
  type KindFilaGrillaInvetario,
} from "./tipos";

const n2 = (v: CsDecimal) => v.format("N2");

/** Builds one row with the 18 cells, placing only the given indices. */
function fila(
  kind: KindFilaGrillaInvetario,
  valores: Record<number, CeldaGrilla>,
  celdasLegacy: number,
  extras: Pick<FilaGrilla, "idProducto" | "estiloFila" | "estiloCeldas"> = {},
): FilaGrilla {
  const celdas: CeldaGrilla[] = new Array(CELDAS_TOTALES).fill(null);
  for (const [indice, valor] of Object.entries(valores)) {
    celdas[Number(indice)] = valor;
  }
  return { kind, celdas, celdasLegacy, ...extras };
}

const filaVacia = () => fila("inv-vacia", {}, 15);

/** `COMPRA.qqBruto != 0 || VENTA.qqBruto != 0` — the gross quintales decide. */
function tieneMovimiento(e: EntradaGrilla): boolean {
  const compra = e.calculo.inventarioDetalle[1].qqBruto;
  const venta = e.calculo.inventarioDetalle[2].qqBruto;
  return !compra.isZero || !venta.isZero;
}

const rotulo = (e: EntradaGrilla) => `${e.producto.producto} ${e.producto.sucursal}`;

function filasConMovimiento(e: EntradaGrilla): FilaGrilla[] {
  const [anterior, compra, venta, , stock, utilidad] = e.calculo.inventarioDetalle;
  const nuevo = e.calculo.inventarioNuevo;

  return [
    filaVacia(),

    fila(
      "inv-producto",
      {
        3: rotulo(e),
        4: "P. DIA :",
        5: n2(nuevo.precioDia),
        6: "HUME :",
        7: n2(nuevo.humedad),
        8: "IMPU :",
        9: n2(nuevo.impureza),
      },
      16,
      { idProducto: e.producto.idProducto, estiloCeldas: ESTILO_FILA_PRODUCTO },
    ),

    fila(
      "inv-descripcion",
      {
        3: "DESCRIPCION",
        4: "QQ BRUTO",
        5: "PORCEN",
        6: "MERMA",
        7: "QQ NETO",
        8: "P. PROME",
        9: "EFECTIVO",
        10: "CHEQUE",
        11: "DEPOSITO",
        12: "INVERSION",
      },
      15,
      // The only difference from the closing grid: the whole row is bold here.
      { estiloCeldas: ESTILO_CABECERA_DETALLE, estiloFila: { bold: true } },
    ),

    fila(
      "inv-detalle",
      {
        3: anterior.descripcion,
        7: n2(anterior.qqNeto),
        8: n2(anterior.precioPromedio),
        12: n2(anterior.inversion),
      },
      15,
      { estiloCeldas: ESTILO_FILA_DETALLE },
    ),

    fila(
      "inv-detalle",
      {
        3: compra.descripcion,
        4: n2(compra.qqBruto),
        5: n2(compra.porcen),
        6: n2(compra.merma),
        7: n2(compra.qqNeto),
        8: n2(compra.precioPromedio),
        // Legacy quirk: the purchase's cash is formatted with "F", no thousands
        // separator. The sale's cash uses N2.
        9: compra.efectivo.format("F"),
        10: n2(compra.cheque),
        11: n2(compra.deposito),
        12: n2(compra.inversion),
      },
      15,
      { estiloCeldas: ESTILO_FILA_DETALLE },
    ),

    fila(
      "inv-detalle",
      {
        3: venta.descripcion,
        4: n2(venta.qqBruto),
        5: n2(venta.porcen),
        6: n2(venta.merma),
        7: n2(venta.qqNeto),
        8: n2(venta.precioPromedio),
        9: n2(venta.efectivo),
        10: n2(venta.cheque),
        11: n2(venta.deposito),
        12: n2(venta.inversion),
      },
      15,
      { estiloCeldas: ESTILO_FILA_DETALLE },
    ),

    // EXCEDENTE prints only its label; its values are always zero.
    fila("inv-detalle", { 3: e.calculo.inventarioDetalle[3].descripcion }, 14, {
      estiloCeldas: ESTILO_FILA_DETALLE,
    }),

    fila(
      "inv-detalle",
      {
        3: stock.descripcion,
        7: n2(stock.qqNeto),
        8: n2(stock.precioPromedio),
        12: n2(stock.inversion),
      },
      15,
      { estiloCeldas: ESTILO_FILA_DETALLE },
    ),

    fila(
      "inv-detalle",
      {
        3: utilidad.descripcion,
        8: n2(utilidad.precioPromedio),
        12: n2(utilidad.inversion),
      },
      15,
      { estiloCeldas: ESTILO_FILA_DETALLE },
    ),
  ];
}

function filasSinMovimiento(e: EntradaGrilla): FilaGrilla[] {
  const nuevo = e.calculo.inventarioNuevo;

  return [
    filaVacia(),

    fila("inv-sin-mov-producto", { 3: rotulo(e) }, 15, {
      idProducto: e.producto.idProducto,
      estiloCeldas: ESTILO_FILA_SIN_MOV,
    }),

    fila(
      "inv-sin-mov-resumen",
      {
        3: "STOCK:",
        4: n2(nuevo.stock),
        5: "PRECIO:",
        6: n2(nuevo.precio),
        7: "INVERSION:",
        8: n2(nuevo.inversion),
        9: "UTILIDAD:",
        10: n2(nuevo.totalUtilidad),
        11: "UTI. QQ:",
        12: n2(nuevo.qqUtilidad),
      },
      15,
      { estiloCeldas: ESTILO_FILA_RESUMEN },
    ),
  ];
}

/**
 * Port of `InsertDgvInvProductoParaAdministrador`: two passes over ALL products,
 * first those with movement, then those without, each in array order.
 */
export function proyectarInventarioAdmin(productos: EntradaGrilla[]): FilaGrilla[] {
  const filas: FilaGrilla[] = [];

  for (const e of productos) {
    if (tieneMovimiento(e)) filas.push(...filasConMovimiento(e));
  }
  for (const e of productos) {
    if (!tieneMovimiento(e)) filas.push(...filasSinMovimiento(e));
  }

  return filas;
}
