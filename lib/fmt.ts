/**
 * Fixed-locale number formatting: `en-US`, always exactly two decimals.
 * Parity with the legacy report depends on this never using the browser locale.
 */
export function fmt(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
