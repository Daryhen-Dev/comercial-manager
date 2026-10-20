import "server-only";

import { cargarInsumosProducto } from "./datos/cargar-insumos";
import type { CargaVistaInventarioMaiz, DatoProducto } from "./datos/tipos";
import { calcularProducto } from "./motor/calcular-producto";
import type { ResultadoInventario } from "./motor/inventario";
import { resumirMaiz, type ResumenMaizDTO } from "./sesion/mapeo-dto";

export const MENSAJE_INVENTARIO_NEGATIVO = "ERROR, Inventario en negativo.";
export const MENSAJE_COMPRAS_VENTAS_POR_LIQUIDAR = "ERROR, Compras o ventas por liquidar.";

export type ProductoCalculadoMaiz = {
  producto: DatoProducto;
  calculo: ResultadoInventario;
};

export type VistaInventarioMaiz =
  | { estado: "inventario-negativo"; mensaje: typeof MENSAJE_INVENTARIO_NEGATIVO }
  | { estado: "faltantes-pendientes"; mensaje: typeof MENSAJE_COMPRAS_VENTAS_POR_LIQUIDAR }
  | { estado: "calculado"; productos: ProductoCalculadoMaiz[]; resumen: ResumenMaizDTO };

/**
 * Blocks first, in the legacy order and with a single message: negative
 * inventory wins over pending documents because the first `if` returns.
 */
export async function calcularVistaInventarioMaiz(
  carga: CargaVistaInventarioMaiz,
): Promise<VistaInventarioMaiz> {
  if (carga.estadoInventario) {
    return { estado: "inventario-negativo", mensaje: MENSAJE_INVENTARIO_NEGATIVO };
  }
  if (carga.estadoFaltantes) {
    return {
      estado: "faltantes-pendientes",
      mensaje: MENSAJE_COMPRAS_VENTAS_POR_LIQUIDAR,
    };
  }

  const productos: ProductoCalculadoMaiz[] = [];

  // Same order as the load; the grid renders in this order.
  for (const { producto, fechaCierre } of carga.productos) {
    const insumos = await cargarInsumosProducto(producto, fechaCierre);
    const calculo = calcularProducto(
      producto,
      insumos.compras,
      insumos.ventas,
      insumos.emboAnti,
    );
    productos.push({ producto, calculo });
  }

  const resumen = resumirMaiz(
    productos.map(({ calculo }) => ({
      stock: calculo.inventarioNuevo.stock,
      inversion: calculo.inventarioNuevo.inversion,
    })),
  );

  return { estado: "calculado", productos, resumen };
}
