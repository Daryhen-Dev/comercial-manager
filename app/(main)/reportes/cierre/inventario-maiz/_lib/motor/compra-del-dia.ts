import { CsDecimal } from "@/lib/cs-decimal/cs-decimal";

import type { DatoProducto } from "../datos/tipos";
import type { DatoCompraConjunto, EmboAnti } from "../datos/tipos-insumos";
import { CIEN, divOCero, oCero } from "./comun";

export type DatosCompraDelDia = {
  qqBrutoTotal: CsDecimal;
  qqNetoTotal: CsDecimal;
  mermaTotal: CsDecimal;
  efectivoTotal: CsDecimal;
  chequeTotal: CsDecimal;
  retencionTotal: CsDecimal;
  comisionTotal: CsDecimal;
  pendienteTotal: CsDecimal;
  vTotalTotal: CsDecimal;
  porcentajeTotal: CsDecimal;
  precio: CsDecimal;
  humedadTotal: CsDecimal;
  impurezaTotal: CsDecimal;
  precioDelDia: CsDecimal;
  anticipoTotal: CsDecimal;
  embodegadoTotal: CsDecimal;
};

const cero = () => CsDecimal.ZERO;

function vacio(): DatosCompraDelDia {
  return {
    qqBrutoTotal: cero(),
    qqNetoTotal: cero(),
    mermaTotal: cero(),
    efectivoTotal: cero(),
    chequeTotal: cero(),
    retencionTotal: cero(),
    comisionTotal: cero(),
    pendienteTotal: cero(),
    vTotalTotal: cero(),
    porcentajeTotal: cero(),
    precio: cero(),
    humedadTotal: cero(),
    impurezaTotal: cero(),
    precioDelDia: cero(),
    anticipoTotal: cero(),
    embodegadoTotal: cero(),
  };
}

/** Totales y precio: suma en el orden de las filas recibidas. */
function datosProductoLlenar(compras: DatoCompraConjunto[], datos: DatosCompraDelDia): void {
  for (const c of compras) {
    datos.qqBrutoTotal = datos.qqBrutoTotal.add(c.qqBruto);
    datos.qqNetoTotal = datos.qqNetoTotal.add(c.qqNeto);
    datos.mermaTotal = datos.mermaTotal.add(c.merma);
    datos.efectivoTotal = datos.efectivoTotal.add(c.efectivo);
    datos.chequeTotal = datos.chequeTotal.add(c.cheque);
    datos.retencionTotal = datos.retencionTotal.add(c.retencion);
    datos.comisionTotal = datos.comisionTotal.add(c.comision);
    datos.pendienteTotal = datos.pendienteTotal.add(c.pendiente);
    datos.vTotalTotal = datos.vTotalTotal.add(c.vTotal);
  }

  // Literal del C#: cero solo cuando AMBOS son cero. Si merma != 0 y qqBruto == 0,
  // la división propaga (bug B-9, copiado).
  datos.porcentajeTotal =
    datos.mermaTotal.isZero && datos.qqBrutoTotal.isZero
      ? cero()
      : datos.mermaTotal.div(datos.qqBrutoTotal).mul(CIEN);

  datos.precio = divOCero(datos.vTotalTotal, datos.qqBrutoTotal);
}

/** Humedad e impureza ponderadas por quintales brutos. Sin protección (B-9). */
function ponderarHeI(compras: DatoCompraConjunto[], datos: DatosCompraDelDia): void {
  for (const c of compras) {
    const peso = c.qqBruto.div(datos.qqBrutoTotal);
    datos.humedadTotal = datos.humedadTotal.add(peso.mul(c.humedad));
    datos.impurezaTotal = datos.impurezaTotal.add(peso.mul(c.impureza));
  }
}

/** Always the normal branch here: `mmEstado` is forced false by the loader. */
function sacarPrecioDelDia(producto: DatoProducto, datos: DatosCompraDelDia): void {
  datos.precioDelDia = datos.humedadTotal
    .sub(producto.humedadSeco)
    .mul(producto.mermaAgua)
    .mul(producto.servBasico)
    .add(datos.precio);
}

export function calcularCompraDelDia(
  producto: DatoProducto,
  compras: DatoCompraConjunto[],
  emboAnti: EmboAnti,
): DatosCompraDelDia {
  const datos = vacio();

  if (compras.length !== 0) {
    datosProductoLlenar(compras, datos);
    ponderarHeI(compras, datos);
    sacarPrecioDelDia(producto, datos);
  }

  // Siempre, aunque no haya compras.
  datos.anticipoTotal = emboAnti.anticipo;
  datos.embodegadoTotal = emboAnti.embo;

  return datos;
}

export { oCero };
