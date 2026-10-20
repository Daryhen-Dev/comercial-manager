import "server-only";

import { CsDecimal } from "@/lib/cs-decimal/cs-decimal";

import {
  traerFechaCierre,
  traerProductosFormulaMaiz,
  traerSucursales,
  traerValidacionCompra,
  traerValidacionVenta,
} from "./datos/consultas";
import { entero } from "./datos/errores";
import {
  mapearFechaCierre,
  mapearProductoFormulaMaiz,
  mapearValidacionCompra,
  mapearValidacionVenta,
} from "./datos/mapeadores";
import type {
  CargaVistaInventarioMaiz,
  DatoValidacionCyV,
  ProductoCierreMaiz,
} from "./datos/tipos";

const CONSULTA_LOCALES = "CbllenarTableAdapter.FillByTodasSinPiladoraSinMenu (Anexo A §A.B)";

/**
 * Level 1 of the load: branches, products of each branch, closing date of each
 * branch, and the pending purchase/sale documents.
 *
 * The order is part of the contract: branches in the order SQL Server returns
 * them (no ORDER BY), and per branch the products first and the closing date
 * after. The product order is what the grid renders, so it is preserved.
 */
export async function cargarVistaInventarioMaiz(): Promise<CargaVistaInventarioMaiz> {
  const filasLocales = await traerSucursales();

  const productos: ProductoCierreMaiz[] = [];

  for (const filaLocal of filasLocales) {
    const idLocal = entero(filaLocal.IDLocal, "IDLocal", { consulta: CONSULTA_LOCALES });

    const crudos = await traerProductosFormulaMaiz(idLocal);
    const productosLocal = crudos.map(mapearProductoFormulaMaiz);

    // Queried for EVERY branch, even one without MAIZ: a branch with no previous
    // closing aborts the load, exactly like the legacy.
    const fechaCierre = mapearFechaCierre(await traerFechaCierre(idLocal));

    for (const producto of productosLocal) {
      productos.push({ producto, fechaCierre });
    }
  }

  const compras: DatoValidacionCyV[] = [];
  const ventas: DatoValidacionCyV[] = [];

  // Re-queried per product and accumulated without deduplication, as inherited.
  for (const { producto, fechaCierre } of productos) {
    const c = await traerValidacionCompra(producto.idLocal, fechaCierre);
    compras.push(...c.map(mapearValidacionCompra));

    const v = await traerValidacionVenta(producto.idLocal, fechaCierre);
    ventas.push(...v.map(mapearValidacionVenta));
  }

  return {
    productos,
    faltantes: { compras, ventas },
    // Legacy B-19: this validates the PREVIOUS stock, not the resulting one.
    estadoInventario: productos.some(({ producto }) => producto.stock.lt(CsDecimal.ZERO)),
    estadoFaltantes: compras.length !== 0 || ventas.length !== 0,
  };
}
