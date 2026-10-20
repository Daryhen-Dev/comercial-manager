import {
  CsDecimal,
  CsDivideByZeroError,
  CsOverflowError,
} from "@/lib/cs-decimal/cs-decimal";

export type PasoCierre = "compra-del-dia" | "venta-del-dia" | "inventario";

export class CierreCalculoError extends Error {
  readonly idProducto: number;
  readonly producto: string;
  readonly paso: PasoCierre;
  readonly causa: unknown;

  constructor(idProducto: number, producto: string, paso: PasoCierre, causa: unknown) {
    super(
      `Error calculating the closing for product "${producto}" (id ${idProducto}) at step "${paso}"`,
    );
    this.name = "CierreCalculoError";
    this.idProducto = idProducto;
    this.producto = producto;
    this.paso = paso;
    this.causa = causa;
  }
}

/** Turns ONLY the two decimal-domain errors into zero; anything else propagates. */
export function oCero(fn: () => CsDecimal): CsDecimal {
  try {
    return fn();
  } catch (e) {
    if (e instanceof CsDivideByZeroError || e instanceof CsOverflowError) {
      return CsDecimal.ZERO;
    }
    throw e;
  }
}

export function divOCero(a: CsDecimal, b: CsDecimal): CsDecimal {
  if (b.isZero) return CsDecimal.ZERO;
  return oCero(() => a.div(b));
}

/** Wraps one engine step so a failure names the product and the step. */
export function envolver<T>(
  idProducto: number,
  producto: string,
  paso: PasoCierre,
  fn: () => T,
): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof CierreCalculoError) throw e;
    throw new CierreCalculoError(idProducto, producto, paso, e);
  }
}

export const CIEN = CsDecimal.parse("100");
