import { CsDecimal } from "@/lib/cs-decimal/cs-decimal";

export interface ResumenMaizDTO {
  /** Already formatted as `N2`, like `MostrarTextBoxParaAdministrador`. */
  stock: string;
  precio: string;
  inversion: string;
}

/**
 * Totals for the three cards. PRECIO is a weighted average by quintales, not an
 * average of prices. Nothing is rounded before dividing: the division is exact
 * and rounding happens only in `format("N2")`.
 */
export function resumirMaiz(
  items: { stock: CsDecimal; inversion: CsDecimal }[],
): ResumenMaizDTO {
  let stock = CsDecimal.ZERO;
  let inversion = CsDecimal.ZERO;
  for (const item of items) {
    stock = stock.add(item.stock);
    inversion = inversion.add(item.inversion);
  }

  let precio = CsDecimal.ZERO;
  try {
    precio = inversion.div(stock);
  } catch {
    // Catches divide-by-zero AND overflow, both to zero.
    precio = CsDecimal.ZERO;
  }

  return {
    stock: stock.format("N2"),
    precio: precio.format("N2"),
    inversion: inversion.format("N2"),
  };
}
