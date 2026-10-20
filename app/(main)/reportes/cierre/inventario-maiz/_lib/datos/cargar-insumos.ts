import { CsDecimal } from "@/lib/cs-decimal/cs-decimal";

import {
  traerCompraBascula,
  traerCompraEmbodegado,
  traerCompraGeneral,
  traerCompraRomana,
  traerEmboAnti,
  traerVentaBascula,
  traerVentaBodeguita,
  traerVentaGeneral,
} from "./consultas-insumos";
import {
  mapearCompraBascula,
  mapearCompraEmbodegado,
  mapearCompraGeneral,
  mapearCompraRomana,
  mapearEmboAnti,
  mapearVenta,
} from "./mapeadores-insumos";
import type { DatoProducto } from "./tipos";
import type { CargaInsumosProducto } from "./tipos-insumos";

const ids = (filas: { idBoletoDetalle: number }[]) => filas.map((f) => f.idBoletoDetalle);

/**
 * Level 2: the day's purchases and sales for one product, cut at that product's
 * own closing date.
 *
 * Two parallel batches, then a conditional eighth query. The order of the
 * concatenation matters for fidelity: purchases are báscula ++ romana ++ general
 * and sales are báscula ++ bodeguita ++ general.
 */
export async function cargarInsumosProducto(
  producto: DatoProducto,
  fechaCierre: Date,
): Promise<CargaInsumosProducto> {
  const idProducto = producto.idProducto;

  const [basculaCrudo, romanaCrudo, generalCrudo, emboAntiCrudo] = await Promise.all([
    traerCompraBascula(idProducto, fechaCierre),
    traerCompraRomana(idProducto, fechaCierre),
    traerCompraGeneral(idProducto, fechaCierre),
    traerEmboAnti(idProducto, fechaCierre),
  ]);

  const [ventaBasculaCrudo, ventaBodeguitaCrudo, ventaGeneralCrudo] = await Promise.all([
    traerVentaBascula(idProducto, fechaCierre),
    traerVentaBodeguita(idProducto, fechaCierre),
    traerVentaGeneral(idProducto, fechaCierre),
  ]);

  const compraBascula = basculaCrudo.map(mapearCompraBascula);
  const compraRomana = romanaCrudo.map(mapearCompraRomana);
  const compraGeneral = generalCrudo.map(mapearCompraGeneral);

  const ventaBascula = ventaBasculaCrudo.map(mapearVenta);
  const ventaBodeguita = ventaBodeguitaCrudo.map(mapearVenta);
  const ventaGeneral = ventaGeneralCrudo.map(mapearVenta);

  const emboAnti = mapearEmboAnti(emboAntiCrudo);

  // The eighth query only runs when there is anticipation or storage.
  let embodegadoIds: number[] = [];
  if (!emboAnti.anticipo.eq(CsDecimal.ZERO) || !emboAnti.embo.eq(CsDecimal.ZERO)) {
    const embodegado = await traerCompraEmbodegado(idProducto, fechaCierre);
    embodegadoIds = embodegado.map(mapearCompraEmbodegado).map((f) => f.idBoletoDetalle);
  }

  return {
    compras: [...compraBascula, ...compraRomana, ...compraGeneral],
    ventas: [...ventaBascula, ...ventaBodeguita, ...ventaGeneral],
    emboAnti,
    embodegadoIds,
    idsPorTipo: {
      compraBascula: ids(compraBascula),
      compraRomana: ids(compraRomana),
      compraGeneral: ids(compraGeneral),
      ventaBascula: ids(ventaBascula),
      ventaBodeguita: ids(ventaBodeguita),
      ventaGeneral: ids(ventaGeneral),
    },
  };
}
