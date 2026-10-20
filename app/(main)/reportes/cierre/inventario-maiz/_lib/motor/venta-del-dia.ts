import { CsDecimal } from "@/lib/cs-decimal/cs-decimal";

import type { DatoProducto } from "../datos/tipos";
import type { DatoVentaConjunto } from "../datos/tipos-insumos";
import { CIEN, divOCero, oCero } from "./comun";

/** Fixed reference humidity for sales: a legacy literal (bug B-20, copied). */
const HUMEDAD_REFERENCIA_VENTA = CsDecimal.parse("13");

export type DatosVentaDelDia = {
  qqBrutoTotal: CsDecimal;
  qqNetoTotal: CsDecimal;
  efectivoTotal: CsDecimal;
  /** The sale's `deposito` is exposed as `transferencia`. */
  transferencia: CsDecimal;
  chequeTotal: CsDecimal;
  retencionTotal: CsDecimal;
  pendienteTotal: CsDecimal;
  vTotalTotal: CsDecimal;
  humedadTotal: CsDecimal;
  impurezaTotal: CsDecimal;
  porcentajeTotal: CsDecimal;
  mermaTotal: CsDecimal;
  precio: CsDecimal;
  /** Stays at zero and is not used by the report. */
  precioDelDia: CsDecimal;
};

function vacio(): DatosVentaDelDia {
  return {
    qqBrutoTotal: CsDecimal.ZERO,
    qqNetoTotal: CsDecimal.ZERO,
    efectivoTotal: CsDecimal.ZERO,
    transferencia: CsDecimal.ZERO,
    chequeTotal: CsDecimal.ZERO,
    retencionTotal: CsDecimal.ZERO,
    pendienteTotal: CsDecimal.ZERO,
    vTotalTotal: CsDecimal.ZERO,
    humedadTotal: CsDecimal.ZERO,
    impurezaTotal: CsDecimal.ZERO,
    porcentajeTotal: CsDecimal.ZERO,
    mermaTotal: CsDecimal.ZERO,
    precio: CsDecimal.ZERO,
    precioDelDia: CsDecimal.ZERO,
  };
}

export function calcularVentaDelDia(
  producto: DatoProducto,
  ventas: DatoVentaConjunto[],
): DatosVentaDelDia {
  const datos = vacio();
  if (ventas.length === 0) return datos;

  for (const v of ventas) {
    datos.qqBrutoTotal = datos.qqBrutoTotal.add(v.qqBruto);
    datos.qqNetoTotal = datos.qqNetoTotal.add(v.qqNeto);
    datos.efectivoTotal = datos.efectivoTotal.add(v.efectivo);
    datos.transferencia = datos.transferencia.add(v.deposito);
    datos.chequeTotal = datos.chequeTotal.add(v.cheque);
    datos.retencionTotal = datos.retencionTotal.add(v.retencion);
    datos.pendienteTotal = datos.pendienteTotal.add(v.pendiente);
    datos.vTotalTotal = datos.vTotalTotal.add(v.vTotal);
  }

  // Ponderación sin protección: qqBrutoTotal == 0 propaga (B-9).
  for (const v of ventas) {
    const peso = v.qqBruto.div(datos.qqBrutoTotal);
    datos.humedadTotal = datos.humedadTotal.add(peso.mul(v.humedad));
    datos.impurezaTotal = datos.impurezaTotal.add(peso.mul(v.impureza));
  }

  datos.porcentajeTotal = oCero(() =>
    datos.humedadTotal.sub(HUMEDAD_REFERENCIA_VENTA).mul(producto.mermaAgua),
  );

  // Multiplica ANTES de dividir.
  datos.mermaTotal = oCero(() =>
    datos.qqNetoTotal.mul(datos.porcentajeTotal).div(CIEN),
  );

  datos.precio = divOCero(datos.vTotalTotal, datos.qqNetoTotal);

  return datos;
}
