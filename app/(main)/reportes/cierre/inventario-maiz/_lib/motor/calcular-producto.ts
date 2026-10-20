import type { DatoProducto } from "../datos/tipos";
import type { DatoCompraConjunto, DatoVentaConjunto, EmboAnti } from "../datos/tipos-insumos";
import { envolver } from "./comun";
import { calcularCompraDelDia } from "./compra-del-dia";
import { pasarValoresACV, type ResultadoInventario } from "./inventario";
import { calcularVentaDelDia } from "./venta-del-dia";

/**
 * The three engine steps, each wrapped so a failure names the product and the
 * step. No I/O: everything arrives already loaded.
 */
export function calcularProducto(
  producto: DatoProducto,
  compras: DatoCompraConjunto[],
  ventas: DatoVentaConjunto[],
  emboAnti: EmboAnti,
): ResultadoInventario {
  const compra = envolver(producto.idProducto, producto.producto, "compra-del-dia", () =>
    calcularCompraDelDia(producto, compras, emboAnti),
  );

  const venta = envolver(producto.idProducto, producto.producto, "venta-del-dia", () =>
    calcularVentaDelDia(producto, ventas),
  );

  return envolver(producto.idProducto, producto.producto, "inventario", () =>
    pasarValoresACV(producto, compra, venta),
  );
}
